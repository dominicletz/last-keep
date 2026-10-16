defmodule LastKeepWeb.GameChannel do
  use LastKeepWeb, :channel

  alias LastKeep.Game.Room

  @impl true
  def join("game:" <> code, params, socket) do
    token = params["token"]

    if is_binary(token) and LastKeep.Game.Rooms.exists?(code) do
      case Room.connect(code, token) do
        {:ok, public_id, generation, snap} ->
          Phoenix.PubSub.subscribe(LastKeep.PubSub, Room.topic(code))

          socket =
            socket
            |> assign(:code, code)
            |> assign(:player_id, token)
            |> assign(:public_id, public_id)
            |> assign(:generation, generation)

          {:ok, Map.put(snap, :self, public_id), socket}

        {:error, reason} ->
          {:error, %{reason: Atom.to_string(reason)}}
      end
    else
      {:error, %{reason: "not_found"}}
    end
  end

  @impl true
  def handle_in("input", payload, socket) when is_map(payload) do
    Room.input(socket.assigns.code, socket.assigns.player_id, payload)
    {:reply, :ok, socket}
  end

  def handle_in("start", _payload, socket) do
    Room.start(socket.assigns.code, socket.assigns.player_id)
    {:reply, :ok, socket}
  end

  def handle_in("restart", _payload, socket) do
    Room.restart(socket.assigns.code)
    {:reply, :ok, socket}
  end

  def handle_in(_event, _payload, socket), do: {:noreply, socket}

  @impl true
  def handle_info({:snap, snap}, socket) do
    push(socket, "snap", Map.put(snap, :self, socket.assigns.public_id))
    {:noreply, socket}
  end

  def handle_info(_message, socket), do: {:noreply, socket}

  @impl true
  def terminate(_reason, socket) do
    if socket.assigns[:code] && socket.assigns[:player_id] do
      Room.disconnect(socket.assigns.code, socket.assigns.player_id, socket.assigns[:generation])
    end

    :ok
  end
end
