defmodule LastKeep.Game.SimTest do
  use ExUnit.Case, async: true

  alias LastKeep.Game.Rules
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

  test "the six concept monsters are in the nights" do
    assert Rules.monsters() == [:goblin, :skeleton, :wolf, :troll, :bat, :boss]
    assert Rules.bounty(:bat) == 2

    state = Sim.spawn_monster(Sim.new("KEEP01", seed: 1), %{kind: :bat, x: 220, y: 0, wave: 6})
    [bat] = Sim.monsters(state)
    assert bat.kind == :bat
    assert bat.r == 12
    assert bat.speed > Rules.monster(:goblin).speed

    rng = :rand.seed_s(:exsss, {3, 4, 5})

    kinds =
      Enum.flat_map(1..12, fn wave ->
        {groups, _} = Waves.plan(wave, rng)
        Enum.map(groups, & &1.kind)
      end)

    assert Enum.sort(Enum.uniq(kinds)) == [:bat, :boss, :goblin, :skeleton, :troll, :wolf]
    {one, _} = Waves.plan(1, rng)
    assert Enum.map(one, & &1.kind) == [:goblin]
    assert Enum.map(one, & &1.count) == [2]

    {two, _} = Waves.plan(2, rng)
    assert Enum.any?(two, &(&1.kind == :wolf))
    {three, _} = Waves.plan(3, rng)
    assert Enum.any?(three, &(&1.kind == :troll))
    assert Enum.any?(three, &(&1.kind == :bat))
    {four, _} = Waves.plan(4, rng)
    assert Enum.any?(four, &(&1.kind == :boss))

    parade = Sim.parade(Sim.new("KEEP01", seed: 1))
    kinds = parade |> Sim.monsters() |> Enum.map(& &1.kind) |> Enum.sort()
    assert kinds == [:bat, :boss, :goblin, :skeleton, :troll, :wolf]

    for monster <- Sim.monsters(parade) do
      dx = monster.x - 120.0
      assert :math.sqrt(dx * dx + monster.y * monster.y) < 70
    end
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

  test "two goblins that share a spot step apart" do
    state = Sim.new("KEEP01", seed: 1)
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 200.0, y: 40.0, wave: 2})
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 200.0, y: 40.0, wave: 2})
    state = Sim.tick(state)
    [a, b] = Sim.monsters(state)
    gap = :math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
    assert gap >= a.r + b.r - 0.1
  end

  test "wave 1 goblins spawn well outside the yard" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 1, hold: false)
    state = Sim.tick(state)

    assert state.wave == 1
    assert length(Sim.monsters(state)) == 2

    for monster <- Sim.monsters(state) do
      dist = :math.sqrt(monster.x * monster.x + monster.y * monster.y)
      assert dist > 600
      assert dist < 680
      assert monster.speed < 30
      assert monster.damage <= 2
    end
  end

  test "wave 2 does not spawn in the yard" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 1, hold: false)
    state = Sim.tick(state)

    state = %{
      state
      | entities: Map.reject(state.entities, fn {_id, entity} -> entity.type == :monster end)
    }

    state = Sim.tick(state)
    assert match?({:build, _}, state.phase)

    state =
      Enum.reduce_while(1..800, state, fn _, state ->
        state = Sim.tick(state)

        if state.wave == 2 and match?({:wave, _}, state.phase) do
          {:halt, state}
        else
          {:cont, state}
        end
      end)

    assert state.wave == 2
    assert Sim.monsters(state) != []

    for monster <- Sim.monsters(state) do
      dist = :math.sqrt(monster.x * monster.x + monster.y * monster.y)
      assert dist > 740
      assert dist < 900
    end
  end

  test "wave 1 is a smaller slower bite than the next night" do
    rng = :rand.seed_s(:exsss, {3, 4, 5})
    {one, _} = Waves.plan(1, rng)
    {two, _} = Waves.plan(2, rng)
    assert Enum.sum(Enum.map(one, & &1.count)) < Enum.sum(Enum.map(two, & &1.count))

    state = Sim.new("KEEP01", seed: 1)
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 140, y: 0, wave: 1})
    state = Sim.spawn_monster(state, %{kind: :goblin, x: -140, y: 0, wave: 2})
    [later, early] = Enum.sort_by(Sim.monsters(state), & &1.x)
    assert early.speed < later.speed
    assert early.damage < later.damage
  end

  test "two idle heroes who keep swinging clear wave 1 with the keep still high" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 1, hold: false)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    {:ok, state} = Sim.join(state, player("bo", :mage))
    state = Sim.tick(state)

    state =
      Enum.reduce_while(1..4_000, state, fn _, state ->
        cond do
          state.phase == :over -> {:halt, state}
          match?({:build, _}, state.phase) and state.wave >= 1 -> {:halt, state}
          true -> {:cont, defend_in_place(state)}
        end
      end)

    assert {:build, _} = state.phase
    assert state.kills >= 2
    assert state.keep.hp >= 700

    for id <- ["ada", "bo"] do
      hero = hero(state, id)
      assert hero.alive
      assert hero.hp > div(hero.max_hp, 2)
    end
  end

  test "a couple of wave 1 bites do not down the warrior" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")
    before = ada.hp

    state =
      Sim.spawn_monster(state, %{
        kind: :goblin,
        x: ada.x + 18,
        y: ada.y,
        hp: 200,
        wave: 1
      })

    state = Enum.reduce(1..45, state, fn _, state -> Sim.tick(state) end)
    ada = hero(state, "ada")
    assert ada.alive
    assert ada.hp > before - 30
    assert ada.hp > 100
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
    assert state.kills >= 2
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
      |> Sim.input("ada", %{"build" => "wall", "place" => true, "ax" => ax, "ay" => ay})
      |> Sim.input("ada", %{"build" => "wall", "place" => false, "ax" => ax, "ay" => ay})
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

  test "a refused wall does not spend wood, and an attack does not build" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")
    wood = state.resources.wood

    refused =
      state
      |> Sim.input("ada", %{"build" => "wall", "place" => true, "ax" => 0, "ay" => 0})
      |> Sim.tick()

    assert refused.resources.wood == wood
    assert buildings(refused) == []

    assert Enum.any?(
             refused.events,
             &(&1.type == "deny" and &1.reason == "Too close to the keep")
           )

    swung =
      state
      |> Sim.input("ada", %{"attack" => true, "ax" => ada.x + 40, "ay" => ada.y})
      |> Sim.tick()

    assert swung.resources.wood == wood
    assert buildings(swung) == []
  end

  test "the spire unlocks the meteor" do
    locked = cast_meteor(false)
    refute Enum.any?(projectiles(locked), &(&1.kind == :meteor))

    opened = cast_meteor(true)
    assert Enum.any?(projectiles(opened), &(&1.kind == :meteor))
  end

  test "an elite drops a relic and a plain goblin does not" do
    elite = slay(%{kind: :goblin, elite: :fast, hp: 10})
    assert length(elite.relics) == 1
    assert Enum.any?(elite.events, &(&1.type == "relic"))

    plain = slay(%{kind: :goblin, elite: nil, hp: 10})
    assert plain.relics == []
    refute Enum.any?(plain.events, &(&1.type == "relic"))

    boss = slay(%{kind: :boss, elite: nil, hp: 10})
    assert length(boss.relics) == 1
  end

  test "a held fireball still casts after a tick the mage could not act" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :mage))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(state, %{kind: :goblin, x: ada.x + 80, y: ada.y, hp: 40, wave: 1})

    state = Sim.input(state, "ada", %{"q" => true, "ax" => ada.x + 80, "ay" => ada.y})
    ada = %{ada | alive: false, hp: 0, respawn: 5}
    state = %{state | entities: Map.put(state.entities, ada.id, ada)}
    state = Sim.tick(state)
    refute Enum.any?(projectiles(state), &(&1.kind == :fireball))

    ada = %{hero(state, "ada") | alive: true, hp: 90, respawn: 0}
    state = %{state | entities: Map.put(state.entities, ada.id, ada)}
    state = Sim.tick(state)
    assert Enum.any?(projectiles(state), &(&1.kind == :fireball))
  end

  test "an idle mage is dead when both goblins reach the host" do
    idle = wave_until_host_sees(1, false)
    closed = wave_until_host_sees(1, true)

    refute idle.alive
    assert idle.hp == 0
    assert closed.alive
    assert closed.hp == 90
  end

  test "a mage fireball damages a goblin and bursts" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :mage))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(state, %{
        kind: :goblin,
        x: ada.x + 80,
        y: ada.y,
        hp: 40,
        wave: 1
      })

    state =
      state
      |> Sim.input("ada", %{"q" => true, "ax" => ada.x + 80, "ay" => ada.y})
      |> Sim.input("ada", %{"q" => false, "ax" => ada.x + 80, "ay" => ada.y})

    {state, saw_boom} =
      Enum.reduce(1..40, {state, false}, fn _, {state, saw} ->
        state = Sim.tick(state)
        {state, saw or Enum.any?(state.events, &(&1.type == "boom"))}
      end)

    [monster] = Sim.monsters(state)
    assert monster.hp < 40
    assert saw_boom
  end

  test "a stock wave-1 goblin does not survive one fireball" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :mage))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(state, %{
        kind: :goblin,
        x: ada.x + 80,
        y: ada.y,
        wave: 1
      })

    [monster] = Sim.monsters(state)
    assert monster.hp == 22

    state =
      state
      |> Sim.input("ada", %{"q" => true, "ax" => ada.x + 80, "ay" => ada.y})
      |> Sim.input("ada", %{"q" => false, "ax" => ada.x + 80, "ay" => ada.y})

    state =
      Enum.reduce(1..40, state, fn _, state ->
        Sim.tick(state)
      end)

    assert Sim.monsters(state) == []
    assert state.kills == 1
  end

  test "the shown wave moves forward once when a wave clears" do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 1, hold: false)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    state = Sim.tick(state)
    assert Snapshot.render(state).shown_wave == 1

    state = %{
      state
      | entities: Map.reject(state.entities, fn {_id, entity} -> entity.type == :monster end)
    }

    assert Snapshot.render(state).shown_wave == 1
    state = Sim.tick(state)
    assert {:build, _} = state.phase
    assert Snapshot.render(state).shown_wave == 2
    state = Sim.tick(state)
    assert Snapshot.render(state).shown_wave == 2
  end

  test "armor, a fast lunge, a forge, and a boss slam are different" do
    plain = hit_goblin(nil)
    armored = hit_goblin(:armored)
    assert armored.hp > plain.hp

    state = Sim.new("KEEP01", seed: 1)

    state =
      Sim.spawn_monster(state, %{kind: :goblin, x: 200, y: 0, hp: 50, elite: :fast, wave: 1})

    state = Enum.reduce(1..8, state, fn _, state -> Sim.tick(state) end)
    [fast] = Sim.monsters(state)
    assert fast.x < 180

    boss = Sim.new("KEEP01", seed: 1, keep_hp: 200)
    boss = Sim.spawn_monster(boss, %{kind: :boss, x: 70, y: 0, hp: 400, damage: 10, wave: 10})
    boss = Enum.reduce(1..25, boss, fn _, state -> Sim.tick(state) end)
    assert boss.keep.hp <= 200 - 18

    forged = Sim.new("KEEP01", seed: 1)
    forged = Sim.spawn_building(forged, %{kind: :forge, x: 180, y: 0})
    {:ok, forged} = Sim.join(forged, player("ada", :warrior))
    ada = hero(forged, "ada")
    forged = Sim.spawn_monster(forged, %{kind: :goblin, x: ada.x + 30, y: ada.y, hp: 80, wave: 1})
    forged = Sim.input(forged, "ada", %{"attack" => true, "ax" => ada.x + 30, "ay" => ada.y})
    forged = Sim.tick(forged)
    [hurt] = Sim.monsters(forged)
    assert hurt.hp <= 80 - 29
  end

  defp cast_meteor(spire) do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :mage))

    state =
      if spire do
        %{state | upgrades: %{state.upgrades | mage_tower: true}}
      else
        state
      end

    ada = hero(state, "ada")

    state
    |> Sim.input("ada", %{"r" => true, "ax" => ada.x + 40, "ay" => ada.y})
    |> Sim.tick()
  end

  defp projectiles(state) do
    for {_id, %{type: :projectile} = shot} <- state.entities, do: shot
  end

  defp slay(attrs) do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(
        state,
        Map.merge(%{x: ada.x + 30, y: ada.y, wave: 5}, attrs)
      )

    state
    |> Sim.input("ada", %{"attack" => true, "ax" => ada.x + 30, "ay" => ada.y})
    |> Sim.tick()
  end

  defp hit_goblin(elite) do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")

    state =
      Sim.spawn_monster(state, %{
        kind: :goblin,
        x: ada.x + 30,
        y: ada.y,
        hp: 80,
        elite: elite,
        wave: 1
      })

    state = Sim.input(state, "ada", %{"attack" => true, "ax" => ada.x + 30, "ay" => ada.y})
    state = Sim.tick(state)
    hd(Sim.monsters(state))
  end

  test "a gap in a long wall lets goblins through one at a time" do
    state = Sim.new("KEEP01", seed: 1)

    state =
      Enum.reduce(-45..44, state, fn i, state ->
        y = if i < 0, do: -40 + (i + 1) * 28, else: 40 + i * 28
        Sim.spawn_building(state, %{kind: :wall, x: 320, y: y})
      end)

    state = Sim.spawn_monster(state, %{kind: :goblin, x: 400, y: 0, hp: 400, wave: 2})
    state = Enum.reduce(1..160, state, fn _, state -> Sim.tick(state) end)
    [alone] = Sim.monsters(state)
    assert alone.x < 280
    assert abs(alone.y) < 48

    state = Sim.new("KEEP01", seed: 1)

    state =
      Enum.reduce(-45..44, state, fn i, state ->
        y = if i < 0, do: -40 + (i + 1) * 28, else: 40 + i * 28
        Sim.spawn_building(state, %{kind: :wall, x: 320, y: y})
      end)

    state = Sim.spawn_monster(state, %{kind: :goblin, x: 460, y: 0, hp: 400, wave: 2})
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 400, y: 0, hp: 400, wave: 2})

    {state, crowded} =
      Enum.reduce(1..220, {state, 0}, fn _, {state, crowded} ->
        state = Sim.tick(state)

        in_gap =
          Enum.count(Sim.monsters(state), fn monster ->
            monster.x < 340 and monster.x > 300 and abs(monster.y) < 24
          end)

        {state, max(crowded, in_gap)}
      end)

    [a, b] = Sim.monsters(state)
    gap = :math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
    assert gap >= a.r + b.r - 0.1
    assert abs(a.y) < 48
    assert abs(b.y) < 48
    assert a.x < 290
    assert b.x < 290
    assert crowded <= 1
  end

  test "heroes and monsters stop on each other, and only the warrior dash passes" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    {:ok, state} = Sim.join(state, player("lux", :mage))

    state =
      Enum.reduce(1..80, state, fn _, state ->
        ada = hero(state, "ada")
        lux = hero(state, "lux")
        {mx, my} = dir(ada.x - lux.x, ada.y - lux.y)

        state
        |> Sim.input("lux", %{"mx" => mx, "my" => my, "ax" => ada.x, "ay" => ada.y})
        |> Sim.tick()
      end)

    ada = hero(state, "ada")
    lux = hero(state, "lux")
    assert :math.sqrt((ada.x - lux.x) ** 2 + (ada.y - lux.y) ** 2) >= ada.r + lux.r - 0.5

    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")
    state = Sim.spawn_monster(state, %{kind: :goblin, x: ada.x + 48, y: ada.y, hp: 400, wave: 2})

    state =
      Enum.reduce(1..30, state, fn _, state ->
        state
        |> Sim.input("ada", %{"mx" => 1, "my" => 0, "ax" => ada.x + 80, "ay" => ada.y})
        |> Sim.tick()
      end)

    warrior = hero(state, "ada")
    [goblin] = Sim.monsters(state)

    assert :math.sqrt((warrior.x - goblin.x) ** 2 + (warrior.y - goblin.y) ** 2) >=
             warrior.r + goblin.r - 0.5

    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")
    state = Sim.spawn_monster(state, %{kind: :goblin, x: ada.x + 50, y: ada.y, hp: 400, wave: 2})

    state =
      push(state, "ada", %{"q" => true, "ax" => ada.x + 200, "ay" => ada.y})
      |> Sim.tick()

    dasher = hero(state, "ada")
    [body] = Sim.monsters(state)
    assert dasher.x > body.x + body.r

    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("pip", :scout))
    pip = hero(state, "pip")
    state = Sim.spawn_monster(state, %{kind: :goblin, x: pip.x + 40, y: pip.y, hp: 400, wave: 2})

    state =
      push(state, "pip", %{"q" => true, "ax" => pip.x + 200, "ay" => pip.y})
      |> Sim.tick()

    scout = hero(state, "pip")
    [blocked] = Sim.monsters(state)
    assert scout.x < blocked.x

    assert :math.sqrt((scout.x - blocked.x) ** 2 + (scout.y - blocked.y) ** 2) >=
             scout.r + blocked.r - 0.5
  end

  test "the keep is solid and a monster bites it from the edge" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))

    state =
      Enum.reduce(1..40, state, fn _, state ->
        state
        |> Sim.input("ada", %{"mx" => -1, "my" => 0})
        |> Sim.tick()
      end)

    ada = hero(state, "ada")
    assert :math.sqrt(ada.x * ada.x + ada.y * ada.y) >= state.keep.r + ada.r - 0.5

    state = Sim.new("KEEP01", seed: 1, keep_hp: 900)
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 240, y: 0, hp: 500, wave: 2})
    state = Enum.reduce(1..220, state, fn _, state -> Sim.tick(state) end)
    [biter] = Sim.monsters(state)
    dist = :math.sqrt(biter.x * biter.x + biter.y * biter.y)
    assert dist >= state.keep.r + biter.r - 8
    assert state.keep.hp < 900
  end

  test "the wave timer keeps moving from frenzy in 43s with the keep at 291" do
    state = Sim.new("KEEP01", seed: 3, hold: false)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")

    state =
      put_hero(state, %{ada | x: -232.0, y: -396.0})
      |> Map.put(:wave, 3)
      |> Map.put(:kills, 15)
      |> Map.put(:hold, false)
      |> Map.put(:phase, {:wave, 860})
      |> Map.put(:keep, %{state.keep | hp: 291, max_hp: 900})
      |> Map.put(:resources, %{state.resources | wood: 72, gold: 12})

    state = Sim.spawn_monster(state, %{kind: :troll, x: 80.0, y: 0.0, hp: 1_000_000, wave: 3})
    state = %{state | keep: %{state.keep | hp: 100_000, max_hp: 100_000}}

    snap = Snapshot.render(state)
    assert snap.phase == "wave"
    assert snap.phase_ms == 43_000
    assert snap.enraged == false
    assert snap.kills == 15
    assert Jason.encode!(snap)

    state =
      Enum.reduce(1..900, state, fn _, state ->
        previous = state.phase
        state = Sim.tick(state)
        assert state.keep.hp > 0
        assert state.phase != previous
        assert match?({:wave, _}, state.phase)
        state
      end)

    assert state.enraged
    assert Sim.monsters(state) != []
    snap = Snapshot.render(state)
    assert snap.phase_ms < 0
    assert Jason.encode!(snap)
  end

  test "a raise from the reported woods spends the purse and stakes houses" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    ada = hero(state, "ada")
    state = put_hero(state, %{ada | x: -232.0, y: -396.0})
    state = %{state | resources: %{state.resources | wood: 72, gold: 12}}

    state =
      push(state, "ada", %{"raise" => true})
      |> Sim.tick()

    assert state.town == 1
    assert state.resources.wood == 48
    assert state.resources.gold == 4
    assert length(of_kind(state, :house)) == 4
    refute Enum.any?(state.events, &(&1.type == "deny" and &1.reason == "Stand by the keep"))

    snap = Snapshot.render(state)
    assert snap.town == 1
    assert snap.camera == 186
    assert Jason.encode!(snap)
  end

  test "raising the keep spends wood and gold and widens the town" do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", :warrior))
    state = %{state | resources: %{state.resources | wood: 200, gold: 80}}

    state =
      push(state, "ada", %{"raise" => true})
      |> Sim.tick()

    assert state.town == 1
    assert state.resources.wood == 176
    assert state.resources.gold == 72
    snap = Snapshot.render(state)
    assert snap.town == 1
    assert snap.camera == 186
    assert snap.dirt == 190
    assert_in_delta snap.view_scale, 1.12, 0.000_1
    assert snap.upgrade.wood == 36
    assert hd(snap.players).range == 228

    ada = hero(state, "ada")

    state =
      push(state, "ada", %{
        "build" => "wall",
        "place" => true,
        "ax" => ada.x + 190,
        "ay" => ada.y
      })
      |> Sim.tick()

    assert Enum.any?(buildings(state), &(&1.kind == :wall))

    state =
      Enum.reduce(1..3, state, fn _, state ->
        state
        |> Sim.input("ada", %{"raise" => false})
        |> Sim.tick()
        |> Sim.input("ada", %{"raise" => true})
        |> Sim.tick()
      end)

    assert state.town == 4
    assert Snapshot.render(state).upgrade == nil

    state =
      state
      |> Sim.input("ada", %{"raise" => false})
      |> Sim.tick()
      |> Sim.input("ada", %{"raise" => true})
      |> Sim.tick()

    assert state.town == 4
  end

  test "a wounded hero keeps that health when the keep falls, and a downed hero is not refilled" do
    wounded = fall_beside(fn bram -> %{bram | hp: 81, x: 800.0, y: 800.0} end)
    me = bram_snap(wounded)
    assert wounded.phase == :over
    assert wounded.keep.hp == 0
    assert me.hp == 81
    assert me.max == 125
    assert me.alive

    downed =
      fall_beside(fn bram -> %{bram | hp: 0, alive: false, respawn: 1, x: 800.0, y: 800.0} end)

    me = bram_snap(downed)
    assert downed.phase == :over
    assert downed.keep.hp == 0
    assert me.hp == 0
    assert me.max == 125
    assert me.alive == false

    standing =
      fall_beside(
        fn bram -> %{bram | hp: 0, alive: false, respawn: 1, x: 800.0, y: 800.0} end,
        900
      )

    me = bram_snap(standing)
    assert standing.phase != :over
    assert me.hp == 125
    assert me.alive
  end

  defp fall_beside(change, keep_hp \\ 6) do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 50, hold: false)
    {:ok, state} = Sim.join(state, player("bram", :engineer))
    state = put_hero(state, change.(hero(state, "bram")))
    state = %{state | phase: {:wave, 400}, wave: 1, keep: %{state.keep | hp: keep_hp}}
    state = Sim.spawn_monster(state, %{kind: :goblin, x: 70, y: 0, damage: 20, wave: 1})
    Sim.tick(state)
  end

  defp bram_snap(state) do
    Snapshot.render(state).players |> Enum.find(&(&1.name == "bram"))
  end

  defp put_hero(state, hero), do: %{state | entities: Map.put(state.entities, hero.id, hero)}

  # The co-op page is 1280 by 800. The yard camera is the orthographic frame
  # from that window, and a monster is on screen inside 0.72 by 0.62.
  defp host_sees_both?(state) do
    host = hero(state, "bob")
    half_w = 268.8
    half_h = 168.0

    goblins =
      Sim.monsters(state)
      |> Enum.filter(&(&1.kind == :goblin))

    length(goblins) >= 2 and
      Enum.all?(goblins, fn goblin ->
        fx = host.x * 0.72
        fz = host.y * 0.72
        dx = goblin.x - (fx + 150)
        dy = 16 - 135
        dz = goblin.y - (fz + 150)
        nx = (dx * 0.707107 + dz * -0.707107) / half_w
        ny = (dx * -0.379642 + dy * 0.843649 + dz * -0.379642) / half_h
        abs(nx) < 0.72 and abs(ny) < 0.62
      end)
  end

  defp wave_until_host_sees(seed, close_on_host) do
    state = Sim.new("KEEP01", seed: seed)
    {:ok, state} = Sim.join(state, player("bob", :warrior))
    {:ok, state} = Sim.join(state, player("lll", :mage))
    bob = hero(state, "bob")
    state = Sim.spawn_building(state, %{kind: :wall, x: bob.x + 100, y: bob.y + 36})
    state = Sim.release(state, "bob")

    {_state, mage} =
      Enum.reduce_while(1..2_000, {state, nil}, fn _, {state, _} ->
        state =
          if close_on_host do
            warrior = hero(state, "bob")
            mage = hero(state, "lll")
            dx = warrior.x - mage.x
            dy = warrior.y - mage.y
            dist = :math.sqrt(dx * dx + dy * dy)

            {mx, my} =
              if mage.alive and dist > 36, do: {dx / dist, dy / dist}, else: {0.0, 0.0}

            state
            |> Sim.input("lll", %{"mx" => mx, "my" => my})
            |> Sim.tick()
          else
            Sim.tick(state)
          end

        mage = hero(state, "lll")

        if host_sees_both?(state) or state.tick > 1_800 do
          {:halt, {state, mage}}
        else
          {:cont, {state, mage}}
        end
      end)

    mage
  end

  test "a raised keep stakes houses and farmer labor stakes crofts" do
    state = approach_and_raise(:warrior, 200, 80)
    assert state.town == 1
    assert state.resources.wood == 176
    assert state.resources.gold == 72

    houses = of_kind(state, :house)
    ring = MapSet.new([{108.0, 108.0}, {-108.0, 108.0}, {-108.0, -108.0}, {108.0, -108.0}])
    assert length(houses) == 4
    assert of_kind(state, :field) == []
    assert cells(houses) == ring

    for house <- houses do
      dist = :math.sqrt(house.x * house.x + house.y * house.y)
      assert dist > 140
      assert dist < 190
    end

    state =
      Enum.reduce(1..2, state, fn _, state ->
        state
        |> push("ada", %{"raise" => false, "mx" => 0, "my" => 0})
        |> Sim.tick()
      end)

    assert length(of_kind(state, :house)) == 4
    assert cells(of_kind(state, :house)) == ring
    assert state.resources.wood == 176
    assert of_kind(state, :field) == []

    state = %{state | tick: 119}
    state = state |> push("ada", %{"raise" => false, "mx" => 0, "my" => 0}) |> Sim.tick()
    assert state.resources.gold == 73
    assert of_kind(state, :field) == []

    wood = state.resources.wood
    gold = state.resources.gold

    state =
      state
      |> push("ada", %{"raise" => true, "mx" => 0, "my" => 0})
      |> Sim.tick()

    assert state.tick == 121
    assert state.resources.wood == wood - 36
    assert state.resources.gold == gold - 14
    assert state.town == 2
    houses = of_kind(state, :house)
    assert length(houses) == 8

    furthest =
      houses
      |> Enum.map(fn house -> :math.sqrt(house.x * house.x + house.y * house.y) end)
      |> Enum.max()

    assert furthest > 200
    assert of_kind(state, :field) == []

    state = approach_and_raise(:farmer, 80, 40)
    assert state.town == 1
    assert state.resources.wood == 56
    assert state.resources.gold == 32
    assert length(of_kind(state, :house)) == 4
    assert of_kind(state, :field) == []

    state = %{state | tick: 10}

    state =
      state
      |> push("ada", %{
        "q" => true,
        "ax" => 144,
        "ay" => 0,
        "mx" => 0,
        "my" => 0,
        "raise" => false
      })
      |> Sim.tick()

    assert state.tick == 11
    assert rem(state.tick, 80) != 0
    assert rem(state.tick, 120) != 0
    assert state.resources.wood == 55
    fields = of_kind(state, :field)
    assert length(fields) == 2
    assert Enum.any?(fields, &(&1.x == 108.0 and &1.y == 36.0))
    assert Enum.any?(fields, &(&1.x == 144.0 and &1.y == 0.0))
    standing = cells(of_kind(state, :house))

    state =
      state
      |> push("ada", %{"q" => false, "mx" => 0, "my" => 0, "raise" => false})
      |> Sim.tick()

    assert state.tick == 12
    assert length(of_kind(state, :field)) == 2
    assert state.resources.wood == 55
    assert cells(of_kind(state, :house)) == standing

    food = state.resources.food

    state =
      state
      |> push("ada", %{"e" => true, "q" => false, "mx" => 0, "my" => 0, "raise" => false})
      |> Sim.tick()

    assert state.resources.food > food
    assert state.resources.wood == 54
    assert length(of_kind(state, :field)) == 3
    assert Enum.any?(of_kind(state, :field), &(&1.x == -108.0 and &1.y == 36.0))

    state = approach_and_raise(:farmer, 80, 40)
    state = %{state | resources: %{state.resources | wood: 0}, tick: 10}

    state =
      state
      |> push("ada", %{
        "q" => true,
        "ax" => 144,
        "ay" => 0,
        "mx" => 0,
        "my" => 0,
        "raise" => false
      })
      |> Sim.tick()

    assert state.tick == 11
    assert state.resources.wood == 0
    assert Enum.any?(of_kind(state, :field), &(&1.x == 144.0 and &1.y == 0.0))
    refute Enum.any?(of_kind(state, :field), &(&1.x == 108.0 and &1.y == 36.0))

    state = %{state | resources: %{state.resources | wood: 1}}

    state =
      state
      |> push("ada", %{"q" => false, "mx" => 0, "my" => 0, "raise" => false})
      |> Sim.tick()

    assert state.tick == 12
    assert rem(state.tick, 80) != 0
    assert state.resources.wood == 0
    assert Enum.any?(of_kind(state, :field), &(&1.x == 108.0 and &1.y == 36.0))

    state = approach_and_raise(:farmer, 80, 40)
    assert of_kind(state, :field) == []
    assert length(of_kind(state, :house)) == 4
    assert state.resources.wood == 56
    state = %{state | resources: %{state.resources | wood: 10}, tick: 79}

    state =
      state
      |> push("ada", %{"q" => false, "e" => false, "mx" => 0, "my" => 0, "raise" => false})
      |> Sim.tick()

    assert state.tick == 80
    assert state.resources.wood == 9
    assert length(of_kind(state, :field)) == 1
    assert Enum.any?(of_kind(state, :field), &(&1.x == 108.0 and &1.y == 36.0))

    state =
      state
      |> push("ada", %{"mx" => 0, "my" => 0, "raise" => false})
      |> Sim.tick()

    assert length(of_kind(state, :field)) == 1
    assert state.resources.wood == 9
    assert length(of_kind(state, :house)) == 4
  end

  defp approach_and_raise(hero, wood, gold) do
    state = Sim.new("KEEP01", seed: 1)
    {:ok, state} = Sim.join(state, player("ada", hero))
    state = %{state | resources: %{state.resources | wood: wood, gold: gold}, tick: 1}

    state =
      Enum.reduce(1..20, state, fn _, state ->
        state
        |> push("ada", %{"mx" => -1, "my" => 0})
        |> Sim.tick()
      end)

    state
    |> push("ada", %{"raise" => true, "mx" => 0, "my" => 0})
    |> Sim.tick()
  end

  defp of_kind(state, kind), do: Enum.filter(buildings(state), &(&1.kind == kind))

  defp cells(rows), do: MapSet.new(Enum.map(rows, &{&1.x, &1.y}))

  defp place_wall(hero) do
    state = Sim.new("KEEP01", seed: 1, build_ticks: 400)
    {:ok, state} = Sim.join(state, player("ada", hero))
    ada = hero(state, "ada")

    state =
      push(state, "ada", %{
        "build" => "wall",
        "place" => true,
        "ax" => ada.x + 40,
        "ay" => ada.y
      })

    Sim.tick(state)
  end

  defp defend_in_place(state) do
    state =
      Enum.reduce(["ada", "bo"], state, fn id, state ->
        me = hero(state, id)

        case Sim.monsters(state) do
          [] ->
            Sim.input(state, id, %{"mx" => 0, "my" => 0, "attack" => false})

          monsters ->
            monster =
              Enum.min_by(monsters, fn monster ->
                :math.sqrt(
                  (monster.x - me.x) * (monster.x - me.x) +
                    (monster.y - me.y) * (monster.y - me.y)
                )
              end)

            Sim.input(state, id, %{
              "mx" => 0,
              "my" => 0,
              "ax" => monster.x,
              "ay" => monster.y,
              "attack" => true,
              "q" => id == "bo"
            })
        end
      end)

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

  defp dir(dx, dy) do
    length = max(:math.sqrt(dx * dx + dy * dy), 0.001)
    {dx / length, dy / length}
  end

  defp player(id, hero), do: %{id: id, name: id, hero: hero, connected: true}

  defp push(state, id, input), do: Sim.input(state, id, input)

  defp hero(state, id), do: state.entities[state.players[id].hero_id]

  defp heroes(state), do: for({_id, %{type: :hero} = hero} <- state.entities, do: hero)

  defp buildings(state),
    do: for({_id, %{type: :building} = building} <- state.entities, do: building)
end
