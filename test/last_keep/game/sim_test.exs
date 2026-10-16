defmodule LastKeep.Game.SimTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Sim
  alias LastKeep.Game.Snapshot
  alias LastKeep.Game.Waves

  test "a room starts in the build phase with a living keep and trees" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 40)

    assert {:build, 40} = state.phase
    assert state.keep.hp == state.keep.max_hp
    assert state.hints != []
    assert Enum.any?(state.entities, fn {_id, entity} -> entity.type == :tree end)
  end

  test "joining twice resumes the same hero" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    hero_id = state.players["ada"].hero_id

    {:ok, state} = Sim.join(state, %{id: "ada", name: "Ada", hero: :mage, connected: true})

    assert map_size(state.players) == 1
    assert state.players["ada"].hero == :warrior
    assert state.players["ada"].hero_id == hero_id
    assert state.players["ada"].name == "Ada"
    assert Enum.count(Sim.monsters(state)) == 0
    assert Enum.count(heroes(state)) == 1
  end

  test "the sixteenth player is turned away" do
    state =
      Enum.reduce(1..15, Sim.new("KEEP01", seed: 1), fn i, state ->
        {:ok, state} = Sim.join(state, player("p#{i}", :scout))
        state
      end)

    assert {:error, :full} = Sim.join(state, player("extra", :mage))
  end

  test "a disconnected hero stays on the field and ignores input" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    x = hero(state, "ada").x

    state = Sim.disconnect(state, "ada")
    state = Sim.input(state, "ada", %{"mx" => 1})
    state = Sim.tick(state)

    assert state.players["ada"].connected == false
    assert hero(state, "ada").x == x

    {:ok, state} = Sim.join(state, player("ada", :farmer))
    assert state.players["ada"].connected
    assert state.players["ada"].hero == :warrior
  end

  test "holding forward moves the hero" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :scout))
    before = hero(state, "ada")

    state = push(state, "ada", %{"mx" => 1, "my" => 0, "ax" => before.x + 50, "ay" => before.y})
    state = Sim.tick(state)

    assert hero(state, "ada").x > before.x
  end

  test "a warrior strike hurts a monster standing in front" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(state, %{
        kind: :goblin,
        x: ada.x + 36,
        y: ada.y,
        hp: 40,
        wave: 1
      })

    [monster] = Sim.monsters(state)

    state =
      push(state, "ada", %{
        "attack" => true,
        "ax" => monster.x,
        "ay" => monster.y
      })

    state = Sim.tick(state)
    [hurt] = Sim.monsters(state)
    assert hurt.hp < monster.hp
  end

  test "a mage bolt reaches a distant monster" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :mage))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(state, %{
        kind: :skeleton,
        x: ada.x + 220,
        y: ada.y,
        hp: 80,
        wave: 1
      })

    [monster] = Sim.monsters(state)

    state =
      push(state, "ada", %{
        "attack" => true,
        "ax" => monster.x,
        "ay" => monster.y
      })

    state = Enum.reduce(1..15, state, fn _, state -> Sim.tick(state) end)
    [hurt] = Sim.monsters(state)
    assert hurt.hp < monster.hp
  end

  test "the build timer opens a wave from the revealed directions" do
    state = Sim.new("KEEP01", seed: 4, build_ticks: 1, hold: false)
    hints = state.hints
    state = Sim.tick(state)

    assert {:wave, _} = state.phase
    assert state.wave == 1
    assert Sim.monsters(state) != []
    assert length(Sim.monsters(state)) == Enum.sum(Enum.map(hints, & &1.count))
  end

  test "every fifth wave is an elite or a boss" do
    assert Waves.elite(1) == nil
    assert Waves.elite(5) in [:fast, :armored, :enraged]
    assert Waves.elite(10) == :boss
    assert Waves.elite(15) in [:fast, :armored, :enraged]
    assert Waves.elite(20) == :boss

    {groups, _rng} = Waves.plan(10, :rand.seed_s(:exsss, {3, 4, 5}))
    assert Enum.any?(groups, &(&1.kind == :boss))
  end

  test "a monster at the gate bites the keep, and the keep can fall" do
    state = Sim.new("KEEP01", seed: 1, keep_hp: 30)

    state =
      Sim.spawn_monster(state, %{
        kind: :troll,
        x: 70,
        y: 0,
        hp: 400,
        damage: 40,
        wave: 1
      })

    state = Enum.reduce(1..30, state, fn _, state -> Sim.tick(state) end)
    assert state.keep.hp < 30

    state = Sim.new("KEEP01", seed: 1, keep_hp: 10)

    state =
      Sim.spawn_monster(state, %{
        kind: :boss,
        x: 80,
        y: 0,
        hp: 500,
        damage: 200,
        wave: 10
      })

    state = Enum.reduce(1..5, state, fn _, state -> Sim.tick(state) end)
    assert state.phase == :over
    assert state.keep.hp == 0
  end

  test "a wall stops a monster that is walking at the keep" do
    state = Sim.new("KEEP01", seed: 1)
    state = Sim.spawn_building(state, %{kind: :wall, x: 216, y: 0})

    state =
      Sim.spawn_monster(state, %{
        kind: :goblin,
        x: 420,
        y: 0,
        hp: 80,
        wave: 1
      })

    state = Enum.reduce(1..80, state, fn _, state -> Sim.tick(state) end)
    [monster] = Sim.monsters(state)
    assert monster.x > 180
  end

  test "fields feed the stockpile during the build" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 80)
    {:ok, state} = Sim.join(state, player("ada", :farmer))
    ada = hero(state, "ada")
    before = state.resources.food

    state =
      push(state, "ada", %{
        "q" => true,
        "ax" => ada.x + 36,
        "ay" => ada.y
      })

    state = Sim.tick(state)
    assert Enum.any?(buildings(state), &(&1.kind == :field))

    state = Enum.reduce(1..40, state, fn _, state -> Sim.tick(state) end)
    assert state.resources.food > before
  end

  test "an engineer spends less wood on a wall than a warrior" do
    engineer = place_wall(:engineer)
    warrior = place_wall(:warrior)
    assert engineer.resources.wood > warrior.resources.wood
  end

  test "wave 1 goblins spawn on the visible field" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 1, hold: false)
    state = Sim.tick(state)

    assert state.wave == 1
    assert Sim.monsters(state) != []

    for monster <- Sim.monsters(state) do
      dist = :math.sqrt(monster.x * monster.x + monster.y * monster.y)
      assert dist > 100
      assert dist < 140
    end
  end

  test "a warrior who chases the nearest goblin survives wave 1" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 1, hold: false)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    state = Sim.tick(state)

    state =
      Enum.reduce_while(1..4_000, state, fn _, state ->
        cond do
          state.phase == :over -> {:halt, state}
          match?({:build, _}, state.phase) -> {:halt, state}
          true -> {:cont, chase_nearest(state, "ada")}
        end
      end)

    assert {:build, _} = state.phase
    assert state.keep.hp > 0
    assert state.kills >= 3
  end

  test "the night waits until the host starts" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    {:ok, state} = Sim.join(state, player("bo", :mage))
    state = Enum.reduce(1..40, state, fn _, state -> Sim.tick(state) end)

    assert state.hold
    assert {:build, _} = state.phase
    assert Sim.monsters(state) == []

    state = Sim.release(state, "bo")
    assert state.hold

    state = Sim.release(state, "ada")
    refute state.hold
    state = Enum.reduce(1..199, state, fn _, state -> Sim.tick(state) end)
    assert {:build, _} = state.phase
    state = Sim.tick(state)
    assert {:wave, _} = state.phase
  end

  test "a click that ends before the tick still places a wall" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")
    ax = ada.x + 40
    ay = ada.y

    state =
      state
      |> Sim.input("ada", %{"build" => "wall", "attack" => true, "ax" => ax, "ay" => ay})
      |> Sim.input("ada", %{"build" => "wall", "attack" => false, "ax" => ax, "ay" => ay})
      |> Sim.tick()

    assert state.resources.wood < 48
    assert Enum.any?(buildings(state), &(&1.kind == :wall))
  end

  test "restart keeps the same party and waits again" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("Ada", :warrior))
    {:ok, state} = Sim.join(state, player("Bo", :mage))
    state = %{state | phase: :over, kills: 3}
    state = Sim.restart(state)

    assert state.hold
    assert {:build, _} = state.phase
    assert state.players["Ada"].name == "Ada"
    assert state.players["Ada"].hero == :warrior
    assert state.players["Bo"].hero == :mage
    assert state.players["Ada"].public_id == "p1"
  end

  test "a living scout reveals the next wave before the last five seconds" do
    hidden = Sim.new("KEEP01", seed: 1, build_ticks: 400)
    snap = Snapshot.render(hidden)
    assert snap.hints == []

    {:ok, revealed} = Sim.join(hidden, player("ada", :scout))
    assert Snapshot.render(revealed).hints != []

    late = Sim.new("KEEP01", seed: 1, build_ticks: 40)
    assert Snapshot.render(late).hints != []
  end

  defp place_wall(hero) do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 400)
    {:ok, state} = Sim.join(state, player("ada", hero))
    ada = hero(state, "ada")

    state =
      push(state, "ada", %{
        "build" => "wall",
        "attack" => true,
        "ax" => ada.x + 40,
        "ay" => ada.y
      })

    Sim.tick(state)
  end

  defp chase_nearest(state, id) do
    me = hero(state, id)

    case Sim.monsters(state) do
      [] ->
        Sim.tick(state)

      monsters ->
        monster =
          Enum.min_by(monsters, fn monster ->
            :math.sqrt(
              (monster.x - me.x) * (monster.x - me.x) + (monster.y - me.y) * (monster.y - me.y)
            )
          end)

        dx = monster.x - me.x
        dy = monster.y - me.y
        length = max(:math.sqrt(dx * dx + dy * dy), 0.001)

        state
        |> Sim.input(id, %{
          "mx" => dx / length,
          "my" => dy / length,
          "ax" => monster.x,
          "ay" => monster.y,
          "attack" => true
        })
        |> Sim.tick()
    end
  end

  defp player(id, hero), do: %{id: id, name: id, hero: hero, connected: true}

  defp push(state, id, input), do: Sim.input(state, id, input)

  defp hero(state, id), do: state.entities[state.players[id].hero_id]

  defp heroes(state), do: for({_id, %{type: :hero} = hero} <- state.entities, do: hero)

  defp buildings(state),
    do: for({_id, %{type: :building} = building} <- state.entities, do: building)
end
