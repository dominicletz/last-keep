defmodule LastKeep.Game.World do
  @moduledoc false

  @radius 7200
  @chunk 512
  @cell 36
  @keep 400
  @min_chunk -14
  @max_chunk 14
  # Cell indices that can hold a world cell: the radius over the cell, with room.
  @span 220
  @side 2 * @span + 1
  # :erlang.phash2/1 hashes into 0..2^27 - 1.
  @hash_range 134_217_728
  @kinds [
    portal: 6,
    chest: 8,
    camp: 4,
    quarry: 3,
    shrine: 2,
    merchant: 1,
    hermit: 1
  ]

  # A room used to build every cell of the map and park it in
  # :persistent_term. That held about 15 MB per seed until the node stopped,
  # and every put copied the term table. Cells are a pure function of the seed
  # and the layout attempt, so only the layout is kept: the attempt and the
  # points of interest. It lives in the calling process, which is the room,
  # and goes away with it. A chunk's cells are built when a hero reaches it.
  def generate(seed) when is_integer(seed) do
    key = {__MODULE__, seed}

    case Process.get(key) do
      nil ->
        world = build(seed)
        Process.put(key, world)
        Process.put(built_key(seed), built(seed) + 1)
        world

      world ->
        world
    end
  end

  # Layout builds in this process for the seed. The room counts its own.
  def built(seed) when is_integer(seed) do
    Process.get(built_key(seed), 0)
  end

  def keep_disc, do: @keep

  def chunk_coord(x, y) when is_number(x) and is_number(y) do
    {Integer.floor_div(trunc(x), @chunk), Integer.floor_div(trunc(y), @chunk)}
  end

  def chunk_in_bounds?({cx, cy}) when is_integer(cx) and is_integer(cy) do
    cx >= @min_chunk and cx <= @max_chunk and cy >= @min_chunk and cy <= @max_chunk
  end

  defp built_key(seed), do: {__MODULE__, :built, seed}

  defp build(seed) do
    {attempt, pois} = layout(seed)

    %{
      seed: seed,
      attempt: attempt,
      radius: @radius,
      chunk_size: @chunk,
      pois: pois
    }
  end

  def chunk(seed, cx, cy) when is_integer(seed) do
    if chunk_in_bounds?({cx, cy}), do: %{cells: chunk_cells(seed, generate(seed).attempt, cx, cy)}
  end

  # The cells whose centre falls in chunk {cx, cy}, the same split the full
  # grid used: floor(i * cell / chunk) == cx.
  defp chunk_cells(seed, attempt, cx, cy) do
    for i <- cell_span(cx), j <- cell_span(cy), in_world?(i, j), into: %{} do
      {{i, j}, cell(seed, attempt, i, j)}
    end
  end

  defp cell_span(c) do
    first = div_ceil(c * @chunk, @cell)
    last = div_ceil((c + 1) * @chunk, @cell) - 1
    first..last//1
  end

  defp div_ceil(a, b), do: -Integer.floor_div(-a, b)

  def cell_index(x, y) when is_number(x) and is_number(y) do
    {round(x / @cell), round(y / @cell)}
  end

  def biome(seed, x, y) when is_integer(seed) and is_number(x) and is_number(y) do
    {i, j} = cell_index(x, y)
    if in_world?(i, j), do: cell(seed, generate(seed).attempt, i, j).biome, else: :void
  end

  def picture(seed, x, y) when is_integer(seed) and is_number(x) and is_number(y) do
    {i, j} = cell_index(x, y)
    world = generate(seed)

    if in_world?(i, j) do
      cell = cell(seed, world.attempt, i, j)
      %{biome: cell.biome, blocked: cell.blocked}
    else
      %{biome: skirt_biome(seed, i, j, world.attempt), blocked: true}
    end
  end

  def open?(x, y) when is_number(x) and is_number(y) do
    {i, j} = cell_index(x, y)
    in_world?(i, j)
  end

  defp skirt_biome(seed, i, j, attempt) do
    band = rem(:erlang.phash2({seed, i, j, attempt}), 100)

    cond do
      band <= 40 -> :pine
      band <= 70 -> :cliff
      band <= 88 -> :hill
      true -> :mountain
    end
  end

  defp layout(seed) do
    Enum.find_value(0..7, fn attempt ->
      case place(seed, attempt, reachable(seed, attempt)) do
        {:ok, pois} -> {attempt, pois}
        :short -> nil
      end
    end) || raise ArgumentError, "seed #{seed} has no reachable world"
  end

  defp place(seed, attempt, reached) do
    {pois, status} = Enum.reduce(@kinds, {[], :ok}, &take_kind(&1, &2, seed, attempt, reached))

    case status do
      :ok -> {:ok, number(pois)}
      :short -> :short
    end
  end

  defp take_kind(_kind, {pois, :short}, _seed, _attempt, _reached), do: {pois, :short}

  defp take_kind({kind, count}, {pois, :ok}, seed, attempt, reached) do
    taken = take(seed, attempt, kind, count, reached, pois)

    if length(taken) == count do
      {pois ++ taken, :ok}
    else
      {pois, :short}
    end
  end

  # Sites are tried in hash order, ties in the order of the reached set. Only
  # the head of that order is ever used, so the sort covers the sites under a
  # hash bound and widens the bound when the head runs out before `count`.
  # Any prefix of the full order comes out the same.
  defp take(seed, attempt, kind, count, reached, placed) do
    bound = max(div(@hash_range * 64, max(MapSet.size(reached), 1)), 1)
    take_under(seed, attempt, kind, count, reached, placed, bound)
  end

  defp take_under(seed, attempt, kind, count, reached, placed, bound) do
    {_at, keyed} =
      Enum.reduce(reached, {0, []}, fn {i, j}, {at, keyed} ->
        if site?(kind, i, j) do
          hash = :erlang.phash2({seed, attempt, kind, i, j})
          {at + 1, if(hash < bound, do: [{hash, at, i, j} | keyed], else: keyed)}
        else
          {at, keyed}
        end
      end)

    {taken, _placed} =
      keyed
      |> Enum.sort()
      |> Enum.reduce_while({[], placed}, fn {_hash, _at, i, j}, {taken, placed} ->
        cond do
          length(taken) == count ->
            {:halt, {taken, placed}}

          apart?(i, j, placed) ->
            poi = %{id: 0, kind: kind, x: i * @cell, y: j * @cell, i: i, j: j}
            {:cont, {[poi | taken], [poi | placed]}}

          true ->
            {:cont, {taken, placed}}
        end
      end)

    if length(taken) == count or bound >= @hash_range do
      Enum.reverse(taken)
    else
      take_under(seed, attempt, kind, count, reached, placed, min(bound * 4, @hash_range))
    end
  end

  defp number(pois) do
    pois
    |> Enum.with_index(1)
    |> Enum.map(fn {poi, id} -> %{poi | id: id} end)
  end

  defp site?(:portal, i, j) do
    distance = dist2(i, j)
    distance >= 1_400 * 1_400 and distance <= 5_200 * 5_200
  end

  defp site?(_kind, i, j), do: dist2(i, j) > @keep * @keep

  defp apart?(i, j, placed) do
    Enum.all?(placed, fn poi ->
      di = i - poi.i
      dj = j - poi.j
      di * di + dj * dj >= 100
    end)
  end

  # The open cells as one byte each, row i, column j, over -@span..@span.
  defp walkable(seed, attempt) do
    for i <- -@span..@span, j <- -@span..@span, into: <<>> do
      if in_world?(i, j) and not cell(seed, attempt, i, j).blocked, do: <<1>>, else: <<0>>
    end
  end

  # Flood fill from the keep over the open cells. Same set as a MapSet walk
  # over the full cell map, without building that map.
  defp reachable(seed, attempt) do
    open = walkable(seed, attempt)
    seen = :atomics.new(@side * @side, signed: false)
    :atomics.put(seen, slot(0, 0), 1)
    fill([{0, 0}], open, seen, [{0, 0}]) |> MapSet.new()
  end

  defp fill([], _open, _seen, acc), do: acc

  defp fill([{i, j} | rest], open, seen, acc) do
    {stack, acc} = visit(i + 1, j, open, seen, {rest, acc})
    {stack, acc} = visit(i - 1, j, open, seen, {stack, acc})
    {stack, acc} = visit(i, j + 1, open, seen, {stack, acc})
    {stack, acc} = visit(i, j - 1, open, seen, {stack, acc})
    fill(stack, open, seen, acc)
  end

  defp visit(i, j, open, seen, {stack, acc}) do
    if abs(i) > @span or abs(j) > @span do
      {stack, acc}
    else
      at = slot(i, j)

      if :binary.at(open, at - 1) == 1 and :atomics.compare_exchange(seen, at, 0, 1) == :ok do
        {[{i, j} | stack], [{i, j} | acc]}
      else
        {stack, acc}
      end
    end
  end

  defp slot(i, j), do: (i + @span) * @side + (j + @span) + 1

  defp in_world?(i, j) do
    x = i * @cell
    y = j * @cell
    cx = Integer.floor_div(x, @chunk)
    cy = Integer.floor_div(y, @chunk)

    cx in @min_chunk..@max_chunk and cy in @min_chunk..@max_chunk and
      dist2(i, j) <= @radius * @radius
  end

  defp cell(seed, attempt, i, j) do
    if dist2(i, j) <= @keep * @keep do
      %{biome: :meadow, blocked: false}
    else
      hash = :erlang.phash2({seed, i, j, attempt})
      band = rem(hash, 100)

      cond do
        band <= 7 and rem(hash, 5) == 0 -> %{biome: :ford, blocked: false}
        band <= 7 -> %{biome: :river, blocked: true}
        band <= 13 -> %{biome: :cliff, blocked: true}
        band <= 39 -> %{biome: :pine, blocked: false}
        band <= 51 -> %{biome: :ruins, blocked: false}
        true -> %{biome: :meadow, blocked: false}
      end
    end
  end

  defp dist2(i, j) do
    x = i * @cell
    y = j * @cell
    x * x + y * y
  end
end
