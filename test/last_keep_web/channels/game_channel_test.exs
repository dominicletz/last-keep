defmodule LastKeepWeb.GameChannelTest do
  use LastKeepWeb.ChannelCase, async: false

  alias LastKeep.Game.Room
  alias LastKeep.Game.Rooms

  test "several clients join, move, and one reconnects the same hero" do
    {:ok, code} = Rooms.create(auto_tick: false, seed: 3, build_ticks: 40)

    players =
      for name <- ["Ada", "Bo", "Cy"] do
        {:ok, token, public_id, _snap} =
          Rooms.enlist(code, %{name: name, hero: "scout" |> hero_of(name)})

        {:ok, reply, socket} =
          LastKeepWeb.UserSocket
          |> socket("user:#{name}", %{})
          |> subscribe_and_join(LastKeepWeb.GameChannel, "game:" <> code, %{"token" => token})

        assert reply.self == public_id
        assert length(reply.players) >= 1
        {name, token, public_id, socket}
      end

    {_name, token, public_id, socket} = hd(players)
    before = Room.snapshot(code)
    me = Enum.find(before.players, &(&1.id == public_id))

    ref = push(socket, "input", %{"mx" => 1, "my" => 0, "ax" => me.x + 40, "ay" => me.y})
    assert_reply ref, :ok
    snap = Room.step(code)
    assert_push "snap", %{phase: "build"}
    moved = Enum.find(snap.players, &(&1.id == public_id))
    assert moved.x > me.x

    Process.unlink(socket.channel_pid)
    down = Process.monitor(socket.channel_pid)
    leave(socket)
    assert_receive {:DOWN, ^down, _, _, _}
    assert Enum.find(Room.snapshot(code).players, &(&1.id == public_id)).connected == false

    {:ok, reply, _socket} =
      LastKeepWeb.UserSocket
      |> socket("user:again", %{})
      |> subscribe_and_join(LastKeepWeb.GameChannel, "game:" <> code, %{"token" => token})

    assert reply.self == public_id
    assert Enum.find(reply.players, &(&1.id == public_id)).connected
    assert length(Room.snapshot(code).players) == 3
  end

  test "an unknown token cannot take a hero" do
    {:ok, code} = Rooms.create(auto_tick: false, seed: 1)

    assert {:error, %{reason: "unknown"}} =
             LastKeepWeb.UserSocket
             |> socket("ghost", %{})
             |> subscribe_and_join(LastKeepWeb.GameChannel, "game:" <> code, %{
               "token" => "not-a-real-token"
             })
  end

  defp hero_of(_scout, "Ada"), do: :warrior
  defp hero_of(_scout, "Bo"), do: :mage
  defp hero_of(_scout, "Cy"), do: :farmer
end
