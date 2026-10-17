defmodule LastKeep.Game.Rooms do
  @moduledoc false

  alias LastKeep.Game.Room

  @alphabet "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  def create(opts \\ []) do
    code = Keyword.get(opts, :code, fresh_code())
    opts = Keyword.put(opts, :code, code)

    case DynamicSupervisor.start_child(LastKeep.Game.Supervisor, {Room, opts}) do
      {:ok, _pid} ->
        {:ok, code}

      {:error, {:already_started, _pid}} ->
        create(Keyword.delete(opts, :code))

      other ->
        other
    end
  end

  def exists?(code) do
    Registry.lookup(LastKeep.Game.Registry, code) != []
  end

  def count do
    %{active: active} = DynamicSupervisor.count_children(LastKeep.Game.Supervisor)
    active
  end

  def enlist(code, attrs) do
    token = token(attrs[:token])

    case Room.join(code, %{
           id: token,
           name: attrs.name,
           hero: attrs.hero,
           connected: Map.get(attrs, :connected, false)
         }) do
      {:ok, public_id, snap} -> {:ok, token, public_id, snap}
      {:error, reason} -> {:error, reason}
    end
  end

  def valid_code?(code) when is_binary(code) do
    String.length(code) == 6 and String.match?(code, ~r/^[A-Z2-9]+$/)
  end

  def valid_code?(_), do: false

  defp fresh_code do
    code =
      1..6
      |> Enum.map(fn _ -> String.at(@alphabet, :rand.uniform(String.length(@alphabet)) - 1) end)
      |> Enum.join()

    if exists?(code), do: fresh_code(), else: code
  end

  defp token(value) when is_binary(value) do
    if String.length(value) in 16..64 and String.match?(value, ~r/^[A-Za-z0-9_-]+$/) do
      value
    else
      new_token()
    end
  end

  defp token(_), do: new_token()

  defp new_token, do: Base.url_encode64(:crypto.strong_rand_bytes(18), padding: false)
end
