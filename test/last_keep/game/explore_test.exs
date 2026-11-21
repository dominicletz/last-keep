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

  test "a hero stops on the skirt and on a river, and crosses a ford" do
    state = fresh() |> stand(7000, 0)

    state =
      Enum.reduce(1..80, state, fn _, state ->
        state
        |> Sim.input("ada", %{"mx" => 1, "my" => 0})
        |> Sim.tick()
      end)

    ada = hero(state)
    assert ada.x > 7000
    assert ada.x < Rules.walk_backstop()
    assert World.open?(ada.x, ada.y)

    # Find an open cell immediately west of a blocking river cell on seed 1
    {rx, ry} =
      Enum.find_value(-80..80, fn i ->
        Enum.find_value(-80..80, fn j ->
          x = i * 36
          y = j * 36
          distance = :math.sqrt(x * x + y * y)

          if World.biome(1, x, y) == :river and World.open?(1, x - 36, y) and distance > 500 and
               distance < 3000 do
            {x, y}
          end
        end)
      end)

    stopped =
      fresh()
      |> stand(rx - 36, ry)
      |> then(fn s ->
        Enum.reduce(1..16, s, fn _, acc ->
          acc
          |> Sim.input("ada", %{"mx" => 1, "my" => 0})
          |> Sim.tick()
        end)
      end)

    assert hero(stopped).x < rx - 14
    assert World.open?(1, hero(stopped).x, hero(stopped).y)

    # Find an open cell immediately west of a walkable ford cell on seed 1
    {fx, fy} =
      Enum.find_value(-80..80, fn i ->
        Enum.find_value(-80..80, fn j ->
          x = i * 36
          y = j * 36
          distance = :math.sqrt(x * x + y * y)

          if World.biome(1, x, y) == :ford and World.open?(1, x - 36, y) and
               World.open?(1, x + 36, y) and distance > 500 and distance < 3000 do
            {x, y}
          end
        end)
      end)

    crossed =
      fresh()
      |> stand(fx - 36, fy)
      |> then(fn s ->
        Enum.reduce(1..20, s, fn _, acc ->
          acc
          |> Sim.input("ada", %{"mx" => 1, "my" => 0})
          |> Sim.tick()
        end)
      end)

    assert hero(crossed).x > fx + 8

    state = fresh() |> stand(20_000, 0)
    state = state |> Sim.input("ada", %{"mx" => 0, "my" => 0}) |> Sim.tick()
    parked = hero(state)

    assert_in_delta :math.sqrt(parked.x * parked.x + parked.y * parked.y),
                    Rules.walk_backstop(),
                    1
  end

  test "a monster funnels around a river through a ford while a bat flies over it" do
    {rx, ry} =
      Enum.find_value(10..70, fn i ->
        Enum.find_value(-40..40, fn j ->
          x = i * 36
          y = j * 36

          if World.biome(1, x, y) == :river and World.open?(1, x + 72, y) and
               World.open?(1, x - 72, y) do
            {x, y}
          end
        end)
      end)

    # Bat flies directly across the river toward the keep
    bat_state =
      Sim.new("RIV001", seed: 1, hold: false)
      |> Sim.spawn_monster(%{kind: :bat, x: rx + 64, y: ry, wave: 3})

    bat_after = Enum.reduce(1..45, bat_state, fn _, acc -> Sim.tick(acc) end)
    [bat] = Sim.monsters(bat_after)
    assert bat.x < rx - 20

    # Ground wolf skirts the river bank instead of freezing on the bank
    wolf_state =
      Sim.new("RIV002", seed: 1, hold: false)
      |> Sim.spawn_monster(%{kind: :wolf, x: rx + 64, y: ry, wave: 3})

    wolf_after = Enum.reduce(1..80, wolf_state, fn _, acc -> Sim.tick(acc) end)
    [wolf] = Sim.monsters(wolf_after)
    dx = wolf.x - (rx + 64)
    dy = wolf.y - ry
    assert :math.sqrt(dx * dx + dy * dy) > 80
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

  test "a hero stopped on a camp or shrine footprint wakes it" do
    camp = nearest(pois(5), :camp)

    state =
      Sim.new("KEEP01", seed: 5, build_ticks: 400, hold: false)
      |> then(fn s ->
        {:ok, s} = Sim.join(s, %{id: "ada", name: "ada", hero: :warrior, connected: true})
        %{s | resources: %{s.resources | gold: 24}}
      end)
      # Outside center radius 36 (hypot 37.07), where the camp footprint blocks the next step
      |> stand(camp.x + 36.5, camp.y + 6.5)

    woke = Sim.tick(state)
    assert woke.resources.gold == 16
    refute Enum.any?(woke.world.camps, &(&1.id == camp.id))
    assert Enum.any?(woke.entities, fn {_id, entity} -> entity.type == :vagrant end)

    shrine = nearest(pois(5), :shrine)

    shrine_state =
      Sim.new("KEEP01", seed: 5, build_ticks: 400, hold: false)
      |> then(fn s ->
        {:ok, s} = Sim.join(s, %{id: "ada", name: "ada", hero: :warrior, connected: true})
        s
      end)
      |> stand(shrine.x + 38.0, shrine.y)

    taken = Sim.tick(shrine_state)
    refute Enum.any?(taken.world.shrines, &(&1.id == shrine.id))
    assert length(taken.relics) == 1
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
