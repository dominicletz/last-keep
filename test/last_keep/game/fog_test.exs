defmodule LastKeep.Game.FogTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Sim
  alias LastKeep.Game.Snapshot
  alias LastKeep.Game.World

  test "seed 5 places the yard chest and the west portal" do
    pois = World.generate(5).pois

    assert Enum.any?(pois, &(&1.kind == :chest and &1.x == 216 and &1.y == 720))
    assert Enum.any?(pois, &(&1.kind == :portal and &1.x == -1116 and &1.y == -1044))
    assert Enum.any?(pois, &(&1.kind == :portal and &1.x == 360 and &1.y == -1692))
    assert Enum.any?(pois, &(&1.kind == :portal and &1.x == 144 and &1.y == 1944))
  end

  test "a scout's ring is on the shared map and stays out of the farmer's terrain" do
    state =
      "FOG"
      |> Sim.new(seed: 5)
      |> join("ada", :farmer)
      |> join("bo", :scout)
      |> put_hero("ada", 120.0, 0.0)
      |> put_hero("bo", 3000.0, 0.0)
      |> Sim.tick()

    assert MapSet.member?(state.world.discovered, {0, 1})
    refute MapSet.member?(state.world.discovered, {2, 0})
    assert MapSet.member?(state.world.discovered, {5, 0})
    assert MapSet.member?(state.world.discovered, {7, 0})
    refute MapSet.member?(state.world.discovered, {8, 0})

    snap = Snapshot.deliver(state)
    farmer = Snapshot.for_viewer(snap, "p1")
    scout = Snapshot.for_viewer(snap, "p2")

    assert Enum.any?(farmer.chunks, &(&1.cx == 0 and &1.cy == 1))
    refute Enum.any?(farmer.chunks, &(&1.cx == 5))
    assert Enum.any?(scout.chunks, &(&1.cx == 5 and &1.cy == 0))
    assert Enum.any?(scout.chunks, &(&1.cx == 7 and &1.cy == 0))
    refute Enum.any?(scout.chunks, &(&1.cx == 8))
    assert farmer.map == nil
    assert scout.map == nil

    assert Enum.any?(snap.chests, &(&1.x == 216 and &1.y == 720))
    refute Enum.any?(snap.chests, &(&1.x == 3312))
    refute Enum.any?(snap.portals, &(&1.x == -1116))
    assert Enum.any?(farmer.land, &(&1.kind == "chest" and &1.x == 216 and &1.y == 720))

    at_table =
      state
      |> put_hero("ada", 0.0, 160.0)
      |> Snapshot.deliver()
      |> Snapshot.for_viewer("p1")

    assert at_table.map.x == 0
    assert at_table.map.y == 160
    assert Enum.any?(at_table.map.chunks, &(&1.cx == 5 and &1.cy == 0))
    refute Enum.any?(at_table.chunks, &(&1.cx == 5))
    assert Jason.encode!(at_table)
  end

  test "a hero past the last chunk does not discover the void" do
    state =
      "EDGE"
      |> Sim.new(seed: 5)
      |> join("ada", :farmer)
      |> put_hero("ada", 7200.0, 0.0)
      |> Sim.tick()

    assert MapSet.member?(state.world.discovered, {14, 0})
    refute MapSet.member?(state.world.discovered, {15, 0})
  end

  defp join(state, id, hero) do
    {:ok, state} = Sim.join(state, %{id: id, name: id, hero: hero, connected: true})
    state
  end

  defp put_hero(state, id, x, y) do
    player = state.players[id]
    hero = state.entities[player.hero_id]
    %{state | entities: Map.put(state.entities, hero.id, %{hero | x: x, y: y})}
  end
end
