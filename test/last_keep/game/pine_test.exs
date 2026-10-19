defmodule LastKeep.Game.PineTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.{Rules, Sim, World}

  test "a pine pays wood and a yard tree wins when it is in reach" do
    {x, y} = {432.0, 0.0}
    assert World.biome(5, x, y) == :pine
    assert hypot(x, y) > World.keep_disc()
    assert World.cell_index(x, y) == {12, 0}

    state = stand(:warrior, x, y)
    wood = state.resources.wood
    state = tick(state, Rules.kit(:warrior).chop)
    assert state.resources.wood == wood + 1
    assert state.world.cut[{12, 0}] == Rules.pine_wood() - 1

    state = %{state | world: %{state.world | cut: %{{12, 0} => 1}}}
    state = tick(state, Rules.kit(:warrior).chop)
    assert state.resources.wood == wood + 2
    assert state.world.cut[{12, 0}] == 0

    held = state.resources.wood
    state = tick(state, Rules.kit(:warrior).chop)
    assert state.resources.wood == held
    assert state.world.cut[{12, 0}] == 0

    meadow = stand(:warrior, 120, 0)
    wood = meadow.resources.wood
    meadow = tick(meadow, Rules.kit(:warrior).chop)
    assert meadow.resources.wood == wood
    assert meadow.world.cut == %{}

    yard = stand(:warrior, 200, 0)
    {_, tree} = Enum.find(yard.entities, fn {_id, entity} -> entity.type == :tree end)
    yard = stand_on(yard, tree.x, tree.y)
    wood = yard.resources.wood
    yard = tick(yard, Rules.kit(:warrior).chop)
    assert yard.resources.wood == wood + 1
    assert yard.world.cut == %{}
    assert tree_wood(yard, tree.id) == tree.wood - 1
  end

  defp stand(hero, x, y) do
    state = Sim.new("PINE1", seed: 5, build_ticks: 400, hold: false)
    {:ok, state} = Sim.join(state, %{id: "ada", name: "ada", hero: hero, connected: true})
    stand_on(state, x, y)
  end

  defp stand_on(state, x, y) do
    ada = state.entities[state.players["ada"].hero_id]
    %{state | entities: Map.put(state.entities, ada.id, %{ada | x: x * 1.0, y: y * 1.0, chop: 0})}
  end

  defp tick(state, n) do
    Enum.reduce(1..n, state, fn _, state -> Sim.tick(state) end)
  end

  defp tree_wood(state, id) do
    case state.entities[id] do
      %{wood: wood} -> wood
      nil -> 0
    end
  end

  defp hypot(x, y), do: :math.sqrt(x * x + y * y)
end
