defmodule LastKeepWeb.PageController do
  use LastKeepWeb, :controller

  alias LastKeep.Game.Rooms

  def home(conn, _params) do
    conn
    |> assign(:page_title, "Last Keep")
    |> assign(:page, "home")
    |> assign(:code, "")
    |> render(:home)
  end

  def room(conn, %{"code" => code}) do
    if Rooms.valid_code?(code) and Rooms.exists?(code) do
      conn
      |> assign(:page_title, "Last Keep")
      |> assign(:page, "room")
      |> assign(:code, code)
      |> render(:room)
    else
      conn
      |> put_status(:not_found)
      |> assign(:page_title, "Last Keep")
      |> assign(:page, "missing")
      |> assign(:code, code)
      |> render(:missing)
    end
  end
end
