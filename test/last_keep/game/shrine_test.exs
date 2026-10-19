defmodule LastKeep.Game.ShrineTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Sim

  @relics [:heartwood, :whetstone, :swiftness, :banner, :granary]

  test "a shrine grants one relic once" do
    state = stand("ada", :warrior)
    shrine = hd(state.world.shrines)
    state = move_player(state, "ada", shrine.x, shrine.y)
    state = Sim.tick(state)

    assert length(state.relics) == 1
    assert length(state.world.shrines) == 1
    assert hd(state.relics) in @relics
    assert map_size(state.players) == 1
    assert state.resources.gold == 0

    state = Sim.tick(state)
    assert length(state.relics) == 1
    assert length(state.world.shrines) == 1
    assert map_size(state.players) == 1
    assert state.resources.gold == 0
  end

  test "a shrine with every relic already held is still once" do
    state = stand("ada", :warrior)
    state = %{state | relics: @relics}
    shrine = hd(state.world.shrines)
    state = move_player(state, "ada", shrine.x, shrine.y)
    state = Sim.tick(state)

    assert state.relics == @relics
    assert length(state.world.shrines) == 1
  end

  defp stand(id, hero) do
    party([{id, hero}])
  end

  defp party(seats) do
    Enum.reduce(seats, Sim.new("SHRINE1", seed: 5, build_ticks: 400, hold: false), fn {id, hero},
                                                                                      state ->
      {:ok, state} = Sim.join(state, %{id: id, name: id, hero: hero, connected: true})
      state
    end)
  end

  defp move_player(state, player_id, x, y) do
    move(state, state.players[player_id].hero_id, x, y)
  end

  defp move(state, id, x, y) do
    entity = state.entities[id]
    %{state | entities: Map.put(state.entities, id, %{entity | x: x * 1.0, y: y * 1.0})}
  end
end
