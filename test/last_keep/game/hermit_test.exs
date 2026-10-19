defmodule LastKeep.Game.HermitTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.{Sim, World}

  test "a hermit reveals the next chunk ring and a scout does not add another" do
    state = stand("ada", :warrior)
    hermit = state.world.hermit
    {cx, cy} = World.chunk_coord(hermit.x, hermit.y)
    extra = {cx - 2, cy}
    beyond = {cx, cy + 3}

    state = Sim.tick(state)
    refute MapSet.member?(state.world.discovered, extra)

    state = move_player(state, "ada", hermit.x, hermit.y)
    state = Sim.tick(state)
    assert MapSet.member?(state.world.discovered, extra)
    refute MapSet.member?(state.world.discovered, beyond)
    assert state.world.hermit == hermit

    state = Sim.tick(state)
    refute MapSet.member?(state.world.discovered, beyond)

    scout = stand("pip", :scout)
    scout = move_player(scout, "pip", scout.world.hermit.x, scout.world.hermit.y)
    scout = Sim.tick(scout)
    refute MapSet.member?(scout.world.discovered, beyond)
  end

  defp stand(id, hero) do
    state = Sim.new("HERMIT1", seed: 5, build_ticks: 400, hold: false)
    {:ok, state} = Sim.join(state, %{id: id, name: id, hero: hero, connected: true})
    state
  end

  defp move_player(state, player_id, x, y) do
    id = state.players[player_id].hero_id
    entity = state.entities[id]
    %{state | entities: Map.put(state.entities, id, %{entity | x: x * 1.0, y: y * 1.0})}
  end
end
