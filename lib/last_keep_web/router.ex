defmodule LastKeepWeb.Router do
  use LastKeepWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {LastKeepWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", LastKeepWeb do
    pipe_through :api

    get "/health", HealthController, :show
  end

  scope "/", LastKeepWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/r/:code", PageController, :room
  end

  scope "/api", LastKeepWeb do
    pipe_through :api

    post "/rooms", RoomController, :create
    post "/rooms/:code/join", RoomController, :join
    get "/rooms/:code", RoomController, :show
    get "/highscores", RoomController, :highscores
  end
end
