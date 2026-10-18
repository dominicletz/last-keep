defmodule LastKeep.Game.ExploreTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Rules
  alias LastKeep.Game.Sim
  alias LastKeep.Game.World

  test "a chest at a known coordinate pays 24 gold once" do
    chest = nearest(pois(1), :chest)
    state = stand(fresh(), chest.x, chest.y)
    before = state.resources.gold

    state = Sim.tick(state)
    assert state.resources.gold == before + 24

    state = Sim.tick(state)
    assert state.resources.gold == before + 24
    refute Enum.any?(state.world.chests, &(&1.id == chest.id))
  end

  test "a hero keeps walking past the old map edge" do
    state = stand(fresh(), 2400, 0)
    state = Sim.tick(state)
    ada = hero(state)

    assert ada.x > 2000
    assert Rules.map_radius() == 7200
  end

  test "a broken portal leaves the night, and night 1 is still two goblins" do
    portals = pois(1) |> Enum.filter(&(&1.kind == :portal))
    dead = unique_angle(portals)

    survivors =
      portals
      |> Enum.reject(&(&1.id == dead.id))
      |> Enum.sort_by(fn poi -> {poi.x * poi.x + poi.y * poi.y, poi.id} end)
      |> Enum.take(2)

    kept = MapSet.new(Enum.map(survivors, & &1.id))
    doomed = Enum.reject(portals, &MapSet.member?(kept, &1.id))
    state = break_portals(fresh(), doomed)

    assert length(state.world.portals) == 2
    refute Enum.any?(state.world.portals, &(&1.id == dead.id))

    state =
      Enum.reduce_while(1..400, state, fn _, state ->
        state = Sim.tick(state)

        if state.wave == 1 and match?({:wave, _}, state.phase) do
          {:halt, state}
        else
          {:cont, state}
        end
      end)

    goblins = Enum.filter(Sim.monsters(state), &(&1.kind == :goblin))
    assert length(goblins) == 2

    angles = Enum.map(goblins, &angle/1)
    living = Enum.map(state.world.portals, &angle/1)

    for got <- angles do
      assert Enum.any?(living, &(gap(got, &1) < 0.05))
      assert gap(got, angle(dead)) > 0.25
    end
  end

  defp fresh do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 400, hold: false)
    {:ok, state} = Sim.join(state, %{id: "ada", name: "ada", hero: :warrior, connected: true})
    state
  end

  defp stand(state, x, y) do
    ada = hero(state)
    %{state | entities: Map.put(state.entities, ada.id, %{ada | x: x * 1.0, y: y * 1.0})}
  end

  defp break_portals(state, doomed) do
    Enum.reduce(doomed, state, fn portal, state ->
      state =
        state
        |> stand(portal.x, portal.y)
        |> Sim.input("ada", %{"attack" => true, "ax" => portal.x, "ay" => portal.y})

      Enum.reduce(1..24, state, fn _, state -> Sim.tick(state) end)
    end)
  end

  defp pois(seed) do
    World.generate(seed).pois
  end

  defp nearest(pois, kind) do
    pois
    |> Enum.filter(&(&1.kind == kind))
    |> Enum.min_by(fn poi -> poi.x * poi.x + poi.y * poi.y end)
  end

  defp unique_angle(portals) do
    Enum.find(portals, fn portal ->
      Enum.all?(portals, fn other ->
        other.id == portal.id or gap(angle(portal), angle(other)) > 0.3
      end)
    end)
  end

  defp hero(state), do: state.entities[state.players["ada"].hero_id]

  defp angle(%{x: x, y: y}), do: :math.atan2(y, x)

  defp gap(a, b) do
    diff = abs(a - b)
    min(diff, 2 * :math.pi() - diff)
  end
end
