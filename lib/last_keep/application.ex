defmodule LastKeep.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      LastKeepWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:last_keep, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: LastKeep.PubSub},
      {Registry, keys: :unique, name: LastKeep.Game.Registry},
      {DynamicSupervisor, name: LastKeep.Game.Supervisor, strategy: :one_for_one},
      LastKeep.Game.Highscores,
      LastKeepWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: LastKeep.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    LastKeepWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
