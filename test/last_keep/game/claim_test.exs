defmodule LastKeep.Game.ClaimTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.{Sim, World}

  test "the keep disc is held and a far chunk is not" do
    state = stand(:warrior, 120, 0)
    wood = state.resources.wood
    near = place(state, 200, 0)

    assert walls(near) == 1
    assert near.resources.wood == wood - 8

    state = stand(:warrior, 120, 0)
    far = place(state, 120 + 500, 0)
    assert walls(far) == 0
    assert reason(far) == "Too far"

    portal = west_portal(5)
    {cx, cy} = World.chunk_coord(portal.x, portal.y)
    state = stand(:warrior, portal.x, portal.y)
    {x, y} = beside(portal)
    assert World.chunk_coord(x, y) == {cx, cy}
    assert hypot(x, y) > World.keep_disc()

    refused = place(state, x, y)
    assert walls(refused) == 0
    assert refused.resources.wood == state.resources.wood
    assert reason(refused) == "The land is not held."
    assert refused.world.claimed == MapSet.new()

    raised = %{refused | town: 4}
    raised = place(raised, x, y)
    assert walls(raised) == 0
    assert reason(raised) == "The land is not held."
    assert raised.town == 4
    assert raised.world.claimed == MapSet.new()
  end

  test "a dead portal claims its chunk and a field there still needs meadow" do
    portal = portal_with_pine(5)
    {cx, cy} = World.chunk_coord(portal.x, portal.y)
    {px, py} = pine_in_chunk(5, {cx, cy})
    assert World.biome(5, px, py) == :pine

    state =
      stand(:warrior, portal.x, portal.y)
      |> weaken(portal.id)
      |> Sim.input("ada", %{"attack" => true, "ax" => portal.x, "ay" => portal.y})

    state = Enum.reduce(1..8, state, fn _, state -> Sim.tick(state) end)
    refute Enum.any?(state.world.portals, &(&1.id == portal.id))
    assert MapSet.member?(state.world.claimed, {cx, cy})

    {x, y} = beside(portal)
    held = place(state, x, y)
    assert walls(held) == 1
    assert held.resources.wood == state.resources.wood - 8

    farmer = stand(:farmer, px, py)
    farmer = %{farmer | world: %{farmer.world | claimed: state.world.claimed}}
    wood = farmer.resources.wood

    farmer =
      farmer
      |> Sim.input("ada", %{"q" => true, "ax" => px, "ay" => py})
      |> Sim.tick()

    assert fields(farmer) == 0
    assert farmer.resources.wood == wood
    assert reason(farmer) == "Not meadow"
  end

  test "a barricade on unheld land spends nothing" do
    portal = west_portal(5)
    state = stand(:engineer, portal.x, portal.y)
    wood = state.resources.wood
    refused = barricade(state, portal.x + 80, portal.y)

    assert walls(refused) == 0
    assert refused.resources.wood == wood
    assert reason(refused) == "The land is not held."
    assert hero_cd(refused, :r) == 0

    held = stand(:engineer, 0, 160)
    wood = held.resources.wood
    placed = barricade(held, 0, 260)
    assert walls(placed) == 3
    assert placed.resources.wood == wood - 10
    assert hero_cd(placed, :r) == 240

    claimed = %{
      state
      | world: %{state.world | claimed: MapSet.new([World.chunk_coord(portal.x, portal.y)])}
    }

    wood = claimed.resources.wood
    outward = barricade(claimed, portal.x + 80, portal.y)
    assert walls(outward) >= 1
    assert outward.resources.wood == wood - 10
    assert hero_cd(outward, :r) == 240
  end

  defp place(state, x, y) do
    state
    |> Sim.input("ada", %{"build" => "wall", "place" => true, "ax" => x, "ay" => y})
    |> Sim.input("ada", %{"build" => "wall", "place" => false, "ax" => x, "ay" => y})
    |> Sim.tick()
  end

  defp stand(hero, x, y) do
    state = Sim.new("CLAIM1", seed: 5, build_ticks: 400, hold: false)
    {:ok, state} = Sim.join(state, %{id: "ada", name: "ada", hero: hero, connected: true})
    ada = state.entities[state.players["ada"].hero_id]
    %{state | entities: Map.put(state.entities, ada.id, %{ada | x: x * 1.0, y: y * 1.0})}
  end

  defp weaken(state, id) do
    portals =
      Enum.map(state.world.portals, fn
        %{id: ^id} = row -> %{row | hp: 1}
        row -> row
      end)

    %{state | world: %{state.world | portals: portals}}
  end

  defp portal_with_pine(seed) do
    seed
    |> World.generate()
    |> Map.fetch!(:pois)
    |> Enum.filter(&(&1.kind == :portal))
    |> Enum.find(fn portal -> pine_in_chunk(seed, World.chunk_coord(portal.x, portal.y)) end)
  end

  defp west_portal(seed) do
    seed
    |> World.generate()
    |> Map.fetch!(:pois)
    |> Enum.filter(&(&1.kind == :portal))
    |> Enum.min_by(fn poi -> poi.x * poi.x + poi.y * poi.y end)
  end

  defp beside(portal) do
    x = Float.round((portal.x + 40) / 36.0) * 36.0
    y = Float.round(portal.y / 36.0) * 36.0
    {x, y}
  end

  defp pine_in_chunk(seed, {cx, cy}) do
    seed
    |> World.chunk(cx, cy)
    |> Map.fetch!(:cells)
    |> Enum.find_value(fn {{i, j}, cell} ->
      if cell.biome == :pine, do: {i * 36.0, j * 36.0}
    end)
  end

  defp barricade(state, ax, ay) do
    state
    |> Sim.input("ada", %{"r" => true, "ax" => ax, "ay" => ay})
    |> Sim.input("ada", %{"r" => false, "ax" => ax, "ay" => ay})
    |> Sim.tick()
  end

  defp hero_cd(state, slot) do
    hero = state.entities[state.players["ada"].hero_id]
    hero.cooldowns[slot]
  end

  defp walls(state) do
    Enum.count(state.entities, fn {_id, entity} ->
      entity.type == :building and entity.kind in [:wall, :stone_wall]
    end)
  end

  defp fields(state) do
    Enum.count(state.entities, fn {_id, entity} ->
      entity.type == :building and entity.kind == :field
    end)
  end

  defp reason(state) do
    Enum.find_value(state.events, fn
      %{type: "deny", reason: reason} -> reason
      _ -> nil
    end)
  end

  defp hypot(x, y), do: :math.sqrt(x * x + y * y)
end
