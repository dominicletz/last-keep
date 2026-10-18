defmodule LastKeep.Game.World do
  @moduledoc false

  @radius 7200
  @chunk 512
  @cell 36
  @keep 400
  @min_chunk -14
  @max_chunk 14
  @kinds [
    portal: 6,
    chest: 8,
    camp: 4,
    quarry: 3,
    shrine: 2,
    merchant: 1,
    hermit: 1
  ]

  def generate(seed) when is_integer(seed) do
    key = {__MODULE__, seed}

    case :persistent_term.get(key, :miss) do
      :miss ->
        world = build(seed)
        :persistent_term.put(key, world)
        world

      world ->
        world
    end
  end

  defp build(seed) do
    {attempt, pois, grid} = layout(seed)

    %{
      seed: seed,
      attempt: attempt,
      radius: @radius,
      chunk_size: @chunk,
      chunks: chunks(grid),
      pois: pois
    }
  end

  def chunk(seed, cx, cy) when is_integer(seed) do
    generate(seed).chunks[{cx, cy}]
  end

  def biome(seed, x, y) when is_integer(seed) and is_number(x) and is_number(y) do
    i = round(x / @cell)
    j = round(y / @cell)
    cx = Integer.floor_div(i * @cell, @chunk)
    cy = Integer.floor_div(j * @cell, @chunk)

    case get_in(generate(seed).chunks, [{cx, cy}, :cells, {i, j}, :biome]) do
      nil -> :void
      biome -> biome
    end
  end

  defp layout(seed) do
    Enum.find_value(0..7, fn attempt ->
      grid = grid(seed, attempt)

      case place(seed, attempt, grid) do
        {:ok, pois} -> {attempt, pois, grid}
        :short -> nil
      end
    end) || raise ArgumentError, "seed #{seed} has no reachable world"
  end

  defp grid(seed, attempt) do
    for i <- -220..220, j <- -220..220, in_world?(i, j), into: %{} do
      {{i, j}, cell(seed, attempt, i, j)}
    end
  end

  defp place(seed, attempt, grid) do
    reached = reachable(grid)
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

  defp take(seed, attempt, kind, count, reached, placed) do
    reached
    |> Enum.filter(fn {i, j} -> site?(kind, i, j) end)
    |> Enum.sort_by(fn {i, j} -> :erlang.phash2({seed, attempt, kind, i, j}) end)
    |> Enum.reduce_while({[], placed}, fn {i, j}, {taken, placed} ->
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
    |> elem(0)
    |> Enum.reverse()
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

  defp reachable(grid) do
    walkable =
      for {{i, j}, cell} <- grid, not cell.blocked, into: MapSet.new(), do: {i, j}

    fill(:queue.from_list([{0, 0}]), MapSet.new([{0, 0}]), walkable)
  end

  defp fill(queue, seen, walkable) do
    case :queue.out(queue) do
      {:empty, _} ->
        seen

      {{:value, {i, j}}, queue} ->
        {queue, seen} =
          Enum.reduce([{1, 0}, {-1, 0}, {0, 1}, {0, -1}], {queue, seen}, fn {di, dj},
                                                                            {queue, seen} ->
            next = {i + di, j + dj}

            if MapSet.member?(seen, next) or not MapSet.member?(walkable, next) do
              {queue, seen}
            else
              {:queue.in(next, queue), MapSet.put(seen, next)}
            end
          end)

        fill(queue, seen, walkable)
    end
  end

  defp chunks(grid) do
    grouped =
      Enum.reduce(grid, %{}, fn {{i, j}, cell}, acc ->
        cx = Integer.floor_div(i * @cell, @chunk)
        cy = Integer.floor_div(j * @cell, @chunk)
        Map.update(acc, {cx, cy}, %{{i, j} => cell}, &Map.put(&1, {i, j}, cell))
      end)

    for cx <- @min_chunk..@max_chunk, cy <- @min_chunk..@max_chunk, into: %{} do
      {{cx, cy}, %{cells: Map.get(grouped, {cx, cy}, %{})}}
    end
  end

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
