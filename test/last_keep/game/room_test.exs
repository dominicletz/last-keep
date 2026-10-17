defmodule LastKeep.Game.RoomTest do
  use ExUnit.Case, async: false

  alias LastKeep.Game.Highscores
  alias LastKeep.Game.Room
  alias LastKeep.Game.Rooms

  setup do
    Highscores.reset()
    :ok
  end

  test "create, join, leave, and reconnect keep one hero" do
    {:ok, code} = Rooms.create(auto_tick: false, seed: 2, build_ticks: 30)
    assert Rooms.exists?(code)

    {:ok, token, public_id, snap} =
      Rooms.enlist(code, %{name: "Brynn", hero: :engineer, token: "token-token-token"})

    assert snap.phase == "build"
    assert public_id == "p1"
    assert length(snap.players) == 1

    Room.disconnect(code, token)
    gone = Room.snapshot(code)
    assert hd(gone.players).connected == false

    {:ok, ^token, ^public_id, back} =
      Rooms.enlist(code, %{name: "Brynn", hero: :mage, token: token})

    assert hd(back.players).hero == "engineer"
    assert hd(back.players).connected == false
    assert length(back.players) == 1
  end

  test "two rooms do not share a wave" do
    {:ok, left} = Rooms.create(auto_tick: false, seed: 1, build_ticks: 1, hold: false)
    {:ok, right} = Rooms.create(auto_tick: false, seed: 9, build_ticks: 50)

    Room.step(left)
    assert Room.snapshot(left).phase == "wave"
    assert Room.snapshot(right).phase == "build"
  end

  test "a scoreless fall is not listed, and a real score is recorded once" do
    {:ok, blank} = Rooms.create(auto_tick: false, seed: 1, keep_hp: 5)
    {:ok, _token, _id, _snap} = Rooms.enlist(blank, %{name: "Io", hero: :warrior})

    :ok =
      GenServer.call(
        Room.via(blank),
        {:spawn_monster, %{kind: :boss, x: 80, y: 0, hp: 400, damage: 50}}
      )

    Enum.each(1..8, fn _ -> Room.step(blank) end)
    assert Room.snapshot(blank).phase == "over"
    assert Highscores.list() == []

    {:ok, code} = Rooms.create(auto_tick: false, seed: 2, keep_hp: 30)

    {:ok, token, public_id, snap} =
      Rooms.enlist(code, %{name: "Io", hero: :warrior, connected: true})

    me = Enum.find(snap.players, &(&1.id == public_id))

    :ok =
      GenServer.call(
        Room.via(code),
        {:spawn_monster, %{kind: :goblin, x: me.x + 36, y: me.y, hp: 10, damage: 0}}
      )

    Room.input(code, token, %{"attack" => true, "ax" => me.x + 36, "ay" => me.y})
    Room.input(code, token, %{"attack" => false, "ax" => me.x + 36, "ay" => me.y})
    snap = Room.step(code)
    assert snap.kills >= 1

    :ok =
      GenServer.call(
        Room.via(code),
        {:spawn_monster, %{kind: :boss, x: 80, y: 0, hp: 400, damage: 80}}
      )

    Enum.each(1..8, fn _ -> Room.step(code) end)
    assert Room.snapshot(code).phase == "over"
    assert length(Highscores.list()) == 1

    Enum.each(1..3, fn _ -> Room.step(code) end)
    assert length(Highscores.list()) == 1
  end

  test "five abandoned rooms stop and the count returns to baseline" do
    baseline = Rooms.count()

    codes =
      for n <- 1..5 do
        {:ok, code} = Rooms.create(idle_ms: 500, lobby_ms: 500, seed: n)

        {:ok, token, _id, _snap} =
          Rooms.enlist(code, %{
            name: "P#{n}",
            hero: :warrior,
            token: "token-token-token",
            connected: true
          })

        Room.disconnect(code, token)
        code
      end

    assert Rooms.count() == baseline + 5
    deadline = System.monotonic_time(:millisecond) + 2_000
    until(fn -> Enum.all?(codes, &(not Rooms.exists?(&1))) end, deadline)
    assert Rooms.count() == baseline
  end

  test "an empty room stops ticking and the room count returns to baseline" do
    baseline = Rooms.count()
    {:ok, code} = Rooms.create(idle_ms: 800, lobby_ms: 800, seed: 4)

    {:ok, token, _id, snap} =
      Rooms.enlist(code, %{
        name: "Ada",
        hero: :warrior,
        token: "token-token-token",
        connected: true
      })

    assert Rooms.exists?(code)
    assert Rooms.count() == baseline + 1
    Room.disconnect(code, token)

    frozen = stable_tick(code)
    assert frozen <= snap.tick + 3
    {:ok, _id, _generation, _snap} = Room.connect(code, token)
    Process.sleep(250)
    assert Rooms.exists?(code)
    assert Room.snapshot(code).tick > frozen

    Room.disconnect(code, token)
    deadline = System.monotonic_time(:millisecond) + 2_000
    until(fn -> not Rooms.exists?(code) end, deadline)

    refute Rooms.exists?(code)
    assert Rooms.count() == baseline
  end

  defp stable_tick(code, left \\ 6) do
    first = Room.snapshot(code).tick
    Process.sleep(100)
    second = Room.snapshot(code).tick

    cond do
      second == first -> first
      left == 0 -> flunk("empty room kept ticking, last tick #{second}")
      true -> stable_tick(code, left - 1)
    end
  end

  defp until(fun, deadline) do
    cond do
      fun.() ->
        :ok

      System.monotonic_time(:millisecond) > deadline ->
        flunk("room did not stop within 2 seconds")

      true ->
        Process.sleep(40)
        until(fun, deadline)
    end
  end
end
