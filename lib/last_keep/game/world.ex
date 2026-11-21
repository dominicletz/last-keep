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
        {world, flow} = build(seed)
        Process.put(key, world)
        Process.put(flow_key(seed), flow)
        Process.put(built_key(seed), built(seed) + 1)
        world

      world ->
        world
    end
  end

  # Shortest-path BFS direction toward the keep around rivers and cliffs.
  def flow_dir(seed, x, y) when is_integer(seed) and is_number(x) and is_number(y) do
    generate(seed)

    case Process.get(flow_key(seed)) do
      nil ->
        nil

      flow ->
        {i, j} = cell_index(x, y)

        if abs(i) > @span or abs(j) > @span do
          nil
        else
          case :binary.at(flow, slot(i, j) - 1) do
            1 -> {1.0, 0.0}
            2 -> {-1.0, 0.0}
            3 -> {0.0, 1.0}
            4 -> {0.0, -1.0}
            5 -> {1.0, 1.0}
            6 -> {-1.0, 1.0}
            7 -> {1.0, -1.0}
            8 -> {-1.0, -1.0}
            _ -> nil
          end
        end
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
  defp flow_key(seed), do: {__MODULE__, :flow, seed}

  defp build(seed) do
    {attempt, pois, flow} = layout(seed)

    world = %{
      seed: seed,
      attempt: attempt,
      radius: @radius,
      chunk_size: @chunk,
      pois: pois
    }

    {world, flow}
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

  def open?(seed, x, y) when is_integer(seed) and is_number(x) and is_number(y) do
    {i, j} = cell_index(x, y)
    in_world?(i, j) and not cell(seed, generate(seed).attempt, i, j).blocked
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
      {reached, flow} = reachable(seed, attempt)

      case place(seed, attempt, reached) do
        {:ok, pois} -> {attempt, pois, flow}
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

  # Shortest-path 8-way BFS from the keep over the open cells. Diagonal steps
  # require both adjacent cardinal cells to be open, so the reachable set is
  # identical to 4-connected fill and monsters never clip river/cliff corners.
  # Flow codes point toward {0, 0}:
  #   0=keep/blocked, 1=+i, 2=-i, 3=+j, 4=-j, 5=+i+j, 6=-i+j, 7=+i-j, 8=-i-j.
  defp reachable(seed, attempt) do
    open = walkable(seed, attempt)
    total = @side * @side
    seen = :atomics.new(total, signed: false)
    :atomics.put(seen, slot(0, 0), 9)
    acc = bfs(:queue.from_list([{0, 0}]), open, seen, [{0, 0}])

    flow =
      for idx <- 1..total, into: <<>> do
        val = :atomics.get(seen, idx)
        if val in 1..8, do: <<val>>, else: <<0>>
      end

    {MapSet.new(acc), flow}
  end

  defp bfs(queue, open, seen, acc) do
    case :queue.out(queue) do
      {:empty, _} ->
        acc

      {{:value, {i, j}}, queue} ->
        # Parent direction code stored in child points BACK to {i, j}.
        {queue, acc} = visit(i + 1, j, 2, open, seen, {queue, acc})
        {queue, acc} = visit(i - 1, j, 1, open, seen, {queue, acc})
        {queue, acc} = visit(i, j + 1, 4, open, seen, {queue, acc})
        {queue, acc} = visit(i, j - 1, 3, open, seen, {queue, acc})
        {queue, acc} = visit_diag(i, j, 1, 1, 8, open, seen, {queue, acc})
        {queue, acc} = visit_diag(i, j, -1, 1, 7, open, seen, {queue, acc})
        {queue, acc} = visit_diag(i, j, 1, -1, 6, open, seen, {queue, acc})
        {queue, acc} = visit_diag(i, j, -1, -1, 5, open, seen, {queue, acc})
        bfs(queue, open, seen, acc)
    end
  end

  defp visit_diag(i, j, di, dj, dir_to_parent, open, seen, state) do
    ni = i + di
    nj = j + dj

    if abs(ni) > @span or abs(nj) > @span do
      state
    else
      if :binary.at(open, slot(ni, j) - 1) == 1 and :binary.at(open, slot(i, nj) - 1) == 1 do
        visit(ni, nj, dir_to_parent, open, seen, state)
      else
        state
      end
    end
  end

  defp visit(i, j, dir_to_parent, open, seen, {queue, acc}) do
    if abs(i) > @span or abs(j) > @span do
      {queue, acc}
    else
      at = slot(i, j)

      if :binary.at(open, at - 1) == 1 and
           :atomics.compare_exchange(seen, at, 0, dir_to_parent) == :ok do
        {:queue.in({i, j}, queue), [{i, j} | acc]}
      else
        {queue, acc}
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

  @smooth {0, 3, 10, 20, 32, 44, 54, 61}

  defp cell(seed, attempt, i, j) do
    if dist2(i, j) <= @keep * @keep do
      %{biome: :meadow, blocked: false}
    else
      gx = Integer.floor_div(i, 8)
      gy = Integer.floor_div(j, 8)
      fx = i - gx * 8
      fy = j - gy * 8
      wx = elem(@smooth, fx)
      wy = elem(@smooth, fy)

      h00 = :erlang.phash2({seed, attempt, gx, gy})
      h10 = :erlang.phash2({seed, attempt, gx + 1, gy})
      h01 = :erlang.phash2({seed, attempt, gx, gy + 1})
      h11 = :erlang.phash2({seed, attempt, gx + 1, gy + 1})

      biome_val = interp9(h00, h10, h01, h11, 0, wx, wy)
      warp_val = interp9(h00, h10, h01, h11, 9, wx, wy)
      cliff_val = interp9(h00, h10, h01, h11, 18, wx, wy)

      r_meta = :erlang.phash2({seed, attempt, 999})
      {coord, along} = if rem(r_meta, 2) == 0, do: {i, j}, else: {j, i}
      r1 = 28 + rem(div(r_meta, 2), 18)
      r2 = -(28 + rem(div(r_meta, 32), 18))
      warp = div(warp_val - 256, 24)
      d1 = abs(coord + warp - r1)
      d2 = abs(coord + warp - r2)
      outside_ring = dist2(i, j) > 740 * 740

      cond do
        outside_ring and (d1 <= 1 or d2 <= 1) ->
          ford_phase = rem(div(r_meta, 512), 12)

          if Integer.mod(along + ford_phase, 12) <= 3 do
            %{biome: :ford, blocked: false}
          else
            %{biome: :river, blocked: true}
          end

        outside_ring and cliff_val >= 415 ->
          %{biome: :cliff, blocked: true}

        biome_val < 230 ->
          %{biome: :pine, blocked: false}

        biome_val > 345 ->
          %{biome: :ruins, blocked: false}

        true ->
          %{biome: :meadow, blocked: false}
      end
    end
  end

  defp interp9(h00, h10, h01, h11, shift, wx, wy) do
    c00 = Bitwise.band(Bitwise.bsr(h00, shift), 511)
    c10 = Bitwise.band(Bitwise.bsr(h10, shift), 511)
    c01 = Bitwise.band(Bitwise.bsr(h01, shift), 511)
    c11 = Bitwise.band(Bitwise.bsr(h11, shift), 511)
    top = c00 * (64 - wx) + c10 * wx
    bot = c01 * (64 - wx) + c11 * wx
    div(top * (64 - wy) + bot * wy, 4096)
  end

  defp dist2(i, j) do
    x = i * @cell
    y = j * @cell
    x * x + y * y
  end
end
