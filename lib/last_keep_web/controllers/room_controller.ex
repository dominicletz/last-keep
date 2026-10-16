defmodule LastKeepWeb.RoomController do
  use LastKeepWeb, :controller

  alias LastKeep.Game.Highscores
  alias LastKeep.Game.Rooms
  alias LastKeep.Game.Rules

  def create(conn, params) do
    with {:ok, name} <- parse_name(params["name"]),
         {:ok, hero} <- parse_hero(params["hero"]),
         {:ok, code} <- Rooms.create([]),
         {:ok, token, public_id, _snap} <-
           Rooms.enlist(code, %{name: name, hero: hero, token: params["token"]}) do
      json(conn, %{code: code, token: token, player: public_id, path: "/r/#{code}"})
    else
      {:error, reason} ->
        conn |> put_status(422) |> json(%{error: to_string(reason)})
    end
  end

  def join(conn, %{"code" => code} = params) do
    with true <- Rooms.valid_code?(code) and Rooms.exists?(code),
         {:ok, name} <- parse_name(params["name"]),
         {:ok, hero} <- parse_hero(params["hero"]),
         {:ok, token, public_id, _snap} <-
           Rooms.enlist(code, %{name: name, hero: hero, token: params["token"]}) do
      json(conn, %{code: code, token: token, player: public_id, path: "/r/#{code}"})
    else
      false -> conn |> put_status(404) |> json(%{error: "not_found"})
      {:error, reason} -> conn |> put_status(422) |> json(%{error: to_string(reason)})
    end
  end

  def show(conn, %{"code" => code}) do
    if Rooms.valid_code?(code) and Rooms.exists?(code) do
      snap = LastKeep.Game.Room.snapshot(code)

      json(conn, %{
        code: code,
        phase: snap.phase,
        wave: snap.wave,
        players: length(snap.players)
      })
    else
      conn |> put_status(404) |> json(%{error: "not_found"})
    end
  end

  def highscores(conn, _params) do
    json(conn, %{scores: Highscores.list()})
  end

  defp parse_name(name) when is_binary(name) do
    cleaned =
      name
      |> String.trim()
      |> String.replace(~r/[\x00-\x1F\x7F]/u, "")
      |> String.slice(0, 16)

    if cleaned == "", do: {:error, :name}, else: {:ok, cleaned}
  end

  defp parse_name(_), do: {:error, :name}

  defp parse_hero(hero) when is_binary(hero) do
    case Enum.find(Rules.heroes(), &(Atom.to_string(&1) == hero)) do
      nil -> {:error, :hero}
      value -> {:ok, value}
    end
  end

  defp parse_hero(_), do: {:error, :hero}
end
