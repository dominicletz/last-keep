defmodule LastKeepWeb.UserSocket do
  use Phoenix.Socket

  channel "game:*", LastKeepWeb.GameChannel

  @impl true
  def connect(_params, socket, _connect_info), do: {:ok, socket}

  @impl true
  def id(_socket), do: nil
end
