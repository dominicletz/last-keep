defmodule LastKeep.Game.WorldTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Rules
  alias LastKeep.Game.World

  test "the same seed returns the same world" do
    first = World.generate(3)
    second = World.generate(3)

    assert first == second
    assert World.chunk(3, 0, 0) == first.chunks[{0, 0}]
    assert World.chunk(3, -2, 4) == first.chunks[{-2, 4}]

    assert counts(first) == %{
             portal: 6,
             chest: 8,
             camp: 4,
             quarry: 3,
             shrine: 2,
             merchant: 1,
             hermit: 1
           }
  end

  test "the keep disc stays clear" do
    world = World.generate(3)
    near = for {coord, cell} <- cells(world), hypot(coord) <= 400, do: cell

    assert near != []
    assert Enum.all?(near, &(&1.biome == :meadow and &1.blocked == false))
    refute Enum.any?(world.pois, &(hypot({&1.x, &1.y}) <= 400))
    assert Rules.map_radius() == 1800
  end

  test "every point of interest is reachable on foot" do
    for seed <- [1, 3, 9] do
      world = World.generate(seed)
      assert length(world.pois) == 25
      fill = flood(cells(world))

      for poi <- world.pois do
        assert MapSet.member?(fill, {poi.i, poi.j}),
               "#{poi.kind} at #{poi.i},#{poi.j} is off the path"
      end

      for poi <- world.pois, poi.kind == :portal do
        distance = hypot({poi.x, poi.y})
        assert distance >= 1400 and distance <= 5200
      end
    end
  end

  test "the land is not a mirror" do
    for seed <- [1, 3, 9] do
      world = World.generate(seed)
      stored = cells(world)

      for {axis, mirror} <- [
            x: fn x, y -> {-x, y} end,
            y: fn x, y -> {x, -y} end,
            half: fn x, y -> {-x, -y} end
          ] do
        pairs =
          for a <- -50..50,
              b <- -50..50,
              x = a * 144,
              y = b * 144,
              hypot({x, y}) > 400,
              hypot({x, y}) <= 7200,
              Map.has_key?(stored, {x, y}),
              {mx, my} = mirror.(x, y),
              Map.has_key?(stored, {mx, my}),
              do: {stored[{x, y}].biome, stored[{mx, my}].biome}

        assert pairs != [], "#{axis} mirror had no pairs for seed #{seed}"
        disagree = Enum.count(pairs, fn {left, right} -> left != right end)
        assert disagree / length(pairs) >= 0.35
      end
    end
  end

  defp counts(world) do
    Map.new([:portal, :chest, :camp, :quarry, :shrine, :merchant, :hermit], fn kind ->
      {kind, Enum.count(world.pois, &(&1.kind == kind))}
    end)
  end

  defp cells(world) do
    for {_id, %{cells: chunk}} <- world.chunks, {{i, j}, cell} <- chunk, into: %{} do
      {{i * 36, j * 36}, cell}
    end
  end

  defp flood(stored) do
    walkable =
      for {{x, y}, cell} <- stored,
          cell.biome in [:meadow, :pine, :ruins, :ford],
          into: MapSet.new(),
          do: {div(x, 36), div(y, 36)}

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

  defp hypot({x, y}), do: :math.sqrt(x * x + y * y)
end
