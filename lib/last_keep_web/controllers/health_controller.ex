defmodule LastKeepWeb.HealthController do
  use LastKeepWeb, :controller

  def show(conn, _params) do
    json(conn, %{ok: true})
  end
end
