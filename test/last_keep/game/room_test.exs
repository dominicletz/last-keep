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
    {:ok, left} = Rooms.create(auto_tick: false, seed: 1, build_ticks: 1)
    {:ok, right} = Rooms.create(auto_tick: false, seed: 9, build_ticks: 50)

    Room.step(left)
    assert Room.snapshot(left).phase == "wave"
    assert Room.snapshot(right).phase == "build"
  end

  test "a fallen keep is recorded once" do
    {:ok, code} = Rooms.create(auto_tick: false, seed: 1, keep_hp: 5)
    {:ok, _token, _id, _snap} = Rooms.enlist(code, %{name: "Io", hero: :warrior})

    :ok =
      GenServer.call(
        Room.via(code),
        {:spawn_monster, %{kind: :boss, x: 80, y: 0, hp: 400, damage: 50}}
      )

    Enum.each(1..8, fn _ -> Room.step(code) end)
    assert Room.snapshot(code).phase == "over"
    assert length(Highscores.list()) == 1

    Enum.each(1..3, fn _ -> Room.step(code) end)
    assert length(Highscores.list()) == 1
  end
end
