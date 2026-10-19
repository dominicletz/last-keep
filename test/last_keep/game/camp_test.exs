defmodule LastKeep.Game.CampTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.{Rules, Sim}

  test "a camp spends 8 gold once and the ally is not a seat" do
    state = stand("ada", :warrior)
    camp = hd(state.world.camps)
    state = move_player(state, "ada", camp.x, camp.y)
    state = purse(state, 8)
    state = Sim.tick(state)

    assert state.resources.gold == 0
    assert map_size(state.players) == 1
    assert length(state.world.camps) == 3
    allies = vagrants(state)
    assert length(allies) == 1
    assert hd(allies).hero != :warrior

    state = Sim.tick(state)
    assert state.resources.gold == 0
    assert length(vagrants(state)) == 1
    assert length(state.world.camps) == 3
  end

  test "a short purse leaves the camp asleep" do
    state = stand("ada", :warrior)
    camp = hd(state.world.camps)
    state = move_player(state, "ada", camp.x, camp.y)
    state = purse(state, 7)
    state = Sim.tick(state)

    assert length(state.world.camps) == 4
    assert vagrants(state) == []
    assert state.resources.gold == 7
  end

  test "every seated role leaves the camp asleep" do
    seats =
      Rules.heroes() |> Enum.with_index() |> Enum.map(fn {hero, i} -> {"seat#{i}", hero} end)

    state = party(seats)
    {id, _player} = Enum.find(state.players, fn {_id, player} -> player.hero == :warrior end)
    camp = hd(state.world.camps)
    state = move_player(state, id, camp.x, camp.y)
    state = purse(state, 8)
    state = Sim.tick(state)

    assert state.resources.gold == 8
    assert vagrants(state) == []
    assert map_size(state.players) == 5
  end

  test "the ally steps toward the nearest living hero and strikes" do
    # The fifth seat repeats mage so warrior stays the only open role.
    state =
      party([
        {"ada", :mage},
        {"bo", :scout},
        {"cal", :farmer},
        {"dee", :engineer},
        {"ned", :mage}
      ])

    camp = hd(state.world.camps)
    state = move_player(state, "ada", camp.x, camp.y)
    state = purse(state, 8)
    state = Sim.tick(state)
    [ally] = vagrants(state)
    assert ally.hero == :warrior

    state = move_player(state, "ada", 300.0, 80.0)
    state = move(state, ally.id, 300.0, 0.0)
    state = Sim.tick(state)
    ally = entity(state, ally.id)
    assert ally.y > 0.0
    assert_in_delta ally.x, 300.0, 1.0

    state = move(state, ally.id, 300.0, 0.0)
    state = move_player(state, "ada", 300.0, 200.0)
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 340.0, y: 0.0})
    before = goblin(state)
    assert before
    state = Sim.tick(state)
    after_goblin = goblin(state)
    ally = entity(state, ally.id)

    assert is_nil(after_goblin) or after_goblin.hp < before.hp
    assert ally.cooldowns.attack > 0
    assert map_size(state.players) == 5
  end

  defp stand(id, hero) do
    party([{id, hero}])
  end

  defp party(seats) do
    Enum.reduce(seats, Sim.new("CAMP1", seed: 5, build_ticks: 400, hold: false), fn {id, hero},
                                                                                    state ->
      {:ok, state} = Sim.join(state, %{id: id, name: id, hero: hero, connected: true})
      state
    end)
  end

  defp purse(state, gold), do: %{state | resources: %{state.resources | gold: gold}}

  defp move_player(state, player_id, x, y) do
    move(state, state.players[player_id].hero_id, x, y)
  end

  defp move(state, id, x, y) do
    entity = state.entities[id]
    %{state | entities: Map.put(state.entities, id, %{entity | x: x * 1.0, y: y * 1.0})}
  end

  defp entity(state, id), do: state.entities[id]

  defp vagrants(state) do
    for {_id, %{type: :vagrant} = row} <- state.entities, do: row
  end

  defp goblin(state) do
    Enum.find(Sim.monsters(state), &(&1.kind == :goblin))
  end
end
