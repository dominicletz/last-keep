defmodule LastKeep.Game.ResourceTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.{Rules, Sim, World}

  test "an engineer takes two stone a tick and a warrior takes one" do
    quarry = nearest_quarry(1)

    engineer = stand_on(quarry, :engineer)
    engineer = Sim.tick(engineer)
    assert engineer.resources.stone == 2
    assert quarry_stone(engineer, quarry.id) == Rules.quarry_stone() - 2

    warrior = stand_on(quarry, :warrior)
    warrior = Sim.tick(warrior)
    assert warrior.resources.stone == 1
    assert quarry_stone(warrior, quarry.id) == Rules.quarry_stone() - 1
  end

  test "a quarry stops at empty and the purse stops at the stone cap" do
    quarry = nearest_quarry(1)
    state = stand_on(quarry, :warrior)
    state = %{state | resources: %{state.resources | stone: 199}}
    state = Sim.tick(state)

    assert state.resources.stone == Rules.cap(:stone)
    assert quarry_stone(state, quarry.id) == Rules.quarry_stone() - 1

    state = %{state | resources: %{state.resources | stone: 0}}
    left = quarry_stone(state, quarry.id)

    state =
      Enum.reduce(1..(left + 1), state, fn _, state -> Sim.tick(state) end)

    assert state.resources.stone == left
    assert quarry_stone(state, quarry.id) == 0
  end

  test "a sow on pine spends nothing and a sow on meadow plants a field" do
    {x, y} = pine_footing(1)
    assert World.biome(1, x, y) == :pine

    state = stand(:farmer, x, y)
    wood = state.resources.wood

    state =
      state
      |> Sim.input("ada", %{"q" => true, "ax" => x, "ay" => y})
      |> Sim.tick()

    assert state.resources.wood == wood
    assert fields(state) == 0
    assert Enum.any?(state.events, &(&1.type == "deny" and &1.reason == "Not meadow"))

    meadow = stand(:farmer, 200, 0)

    meadow =
      meadow
      |> Sim.input("ada", %{"q" => true, "ax" => 200, "ay" => 0})
      |> Sim.tick()

    assert fields(meadow) == 1
  end

  test "eight stone and four wood raise a stone wall, and a wood wall stays at 170" do
    state = purse(:warrior, %{stone: 8, wood: 8})
    ada = hero(state)
    ax = ada.x + 40
    ay = ada.y

    state =
      state
      |> Sim.input("ada", %{"build" => "wall", "place" => true, "ax" => ax, "ay" => ay})
      |> Sim.input("ada", %{"build" => "wall", "place" => false, "ax" => ax, "ay" => ay})
      |> Sim.tick()

    wall = building(state, :stone_wall)
    assert wall.hp == 280
    assert state.resources.stone == 0
    assert state.resources.wood == 4

    plain = purse(:warrior, %{stone: 0, wood: 48})
    bob = hero(plain)

    plain =
      plain
      |> Sim.input("ada", %{"build" => "wall", "place" => true, "ax" => bob.x + 40, "ay" => bob.y})
      |> Sim.input("ada", %{
        "build" => "wall",
        "place" => false,
        "ax" => bob.x + 40,
        "ay" => bob.y
      })
      |> Sim.tick()

    wood_wall = building(plain, :wall)
    assert wood_wall.hp == Rules.building(:wall).hp
    assert plain.resources.wood == 40
    assert building(plain, :stone_wall) == nil
  end

  defp stand_on(quarry, hero) do
    stand(hero, quarry.x, quarry.y)
  end

  defp stand(hero, x, y) do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 400, hold: false)
    {:ok, state} = Sim.join(state, %{id: "ada", name: "ada", hero: hero, connected: true})
    ada = hero(state)
    %{state | entities: Map.put(state.entities, ada.id, %{ada | x: x * 1.0, y: y * 1.0})}
  end

  defp purse(hero, resources) do
    state = stand(hero, 120, 0)
    %{state | resources: Map.merge(state.resources, resources)}
  end

  defp nearest_quarry(seed) do
    seed
    |> World.generate()
    |> Map.fetch!(:pois)
    |> Enum.filter(&(&1.kind == :quarry))
    |> Enum.min_by(fn poi -> poi.x * poi.x + poi.y * poi.y end)
  end

  defp pine_footing(seed) do
    world = World.generate(seed)
    taken = MapSet.new(world.pois, fn poi -> {poi.i, poi.j} end)

    Enum.find_value(world.chunks, fn {_key, %{cells: cells}} ->
      Enum.find_value(cells, fn {{i, j}, %{biome: biome}} ->
        if biome == :pine and not MapSet.member?(taken, {i, j}) do
          {i * 36.0, j * 36.0}
        end
      end)
    end)
  end

  defp quarry_stone(state, id) do
    Enum.find(state.world.quarries, &(&1.id == id)).stone
  end

  defp fields(state) do
    Enum.count(state.entities, fn {_id, entity} ->
      entity.type == :building and entity.kind == :field
    end)
  end

  defp building(state, kind) do
    Enum.find_value(state.entities, fn {_id, entity} ->
      if entity.type == :building and entity.kind == kind, do: entity
    end)
  end

  defp hero(state) do
    Enum.find_value(state.entities, fn {_id, entity} ->
      if entity.type == :hero, do: entity
    end)
  end
end
