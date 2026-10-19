defmodule LastKeepWeb.PageControllerTest do
  use LastKeepWeb.ConnCase, async: false

  alias LastKeep.Game.Highscores
  alias LastKeep.Game.Rooms

  setup do
    Highscores.reset()
    :ok
  end

  test "a digested favicon name is served", %{conn: conn} do
    path = Path.join(:code.priv_dir(:last_keep), "static/favicon-digesttest.ico")
    File.write!(path, "ico")
    on_exit(fn -> File.rm(path) end)

    conn = get(conn, "/favicon-digesttest.ico")
    assert response(conn, 200) == "ico"
  end

  test "GET /health answers before the game is played", %{conn: conn} do
    conn = get(conn, "/health")
    assert json_response(conn, 200) == %{"ok" => true}
  end

  test "GET /", %{conn: conn} do
    conn = get(conn, ~p"/")
    body = html_response(conn, 200)
    assert body =~ "Last Keep"
    assert body =~ "Create game"
  end

  test "create, invite, join, and reconnect", %{conn: conn} do
    conn =
      post(conn, ~p"/api/rooms", %{
        "name" => "Ada",
        "hero" => "scout",
        "token" => "token-token-token1"
      })

    assert %{
             "code" => code,
             "token" => "token-token-token1",
             "player" => "p1",
             "path" => path
           } = json_response(conn, 200)

    assert path == "/r/#{code}"

    conn = get(build_conn(), path)
    assert html_response(conn, 200) =~ "Join the keep"

    conn = get(build_conn(), ~p"/api/rooms/#{code}")
    assert %{"players" => 1, "phase" => "build"} = json_response(conn, 200)

    conn =
      post(build_conn(), ~p"/api/rooms/#{code}/join", %{
        "name" => "Bo",
        "hero" => "farmer"
      })

    assert %{"token" => token, "player" => "p2"} = json_response(conn, 200)

    conn =
      post(build_conn(), ~p"/api/rooms/#{code}/join", %{
        "name" => "Bo",
        "hero" => "mage",
        "token" => token
      })

    again = json_response(conn, 200)
    assert again["token"] == token
    assert again["player"] == "p2"
    assert Rooms.exists?(code)

    conn = get(build_conn(), ~p"/api/highscores")
    assert json_response(conn, 200)["scores"] == []
  end

  test "a missing room is a 404", %{conn: conn} do
    conn = get(conn, ~p"/r/ZZZZZZ")
    assert html_response(conn, 404) =~ "gone"

    conn = get(build_conn(), ~p"/api/rooms/ZZZZZZ")
    assert json_response(conn, 404)["error"] == "not_found"
  end

  test "a perf keep uses the harness durability and a normal create stays at 900", %{conn: conn} do
    conn =
      post(conn, ~p"/api/rooms", %{
        "name" => "Nia",
        "hero" => "farmer",
        "perf_keep" => true
      })

    code = json_response(conn, 200)["code"]
    assert LastKeep.Game.Room.snapshot(code).keep.max == LastKeep.Game.Rules.perf_keep_hp()

    conn = post(build_conn(), ~p"/api/rooms", %{"name" => "Ada", "hero" => "warrior"})
    plain = json_response(conn, 200)["code"]
    assert LastKeep.Game.Room.snapshot(plain).keep.max == 900

    previous = Application.get_env(:last_keep, :perf_keep)
    Application.delete_env(:last_keep, :perf_keep)

    on_exit(fn ->
      if previous != nil, do: Application.put_env(:last_keep, :perf_keep, previous)
    end)

    conn =
      post(build_conn(), ~p"/api/rooms", %{
        "name" => "Lux",
        "hero" => "mage",
        "perf_keep" => true
      })

    closed = json_response(conn, 200)["code"]
    assert LastKeep.Game.Room.snapshot(closed).keep.max == 900
  end

  test "a bad hero is rejected", %{conn: conn} do
    conn = post(conn, ~p"/api/rooms", %{"name" => "Ada", "hero" => "dragon"})
    assert json_response(conn, 422)["error"] == "hero"
  end
end
