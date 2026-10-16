defmodule LastKeep.Game.Highscores do
  @moduledoc false

  use GenServer

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def submit(entry), do: GenServer.call(__MODULE__, {:submit, entry})

  def list, do: GenServer.call(__MODULE__, :list)

  def reset, do: GenServer.call(__MODULE__, :reset)

  @impl true
  def init(_opts) do
    {:ok, load()}
  end

  @impl true
  def handle_call({:submit, entry}, _from, scores) do
    scores =
      [normalize(entry) | scores]
      |> Enum.sort_by(& &1.score, :desc)
      |> Enum.take(20)

    save(scores)
    {:reply, :ok, scores}
  end

  def handle_call(:list, _from, scores), do: {:reply, scores, scores}

  def handle_call(:reset, _from, _scores) do
    save([])
    {:reply, :ok, []}
  end

  defp normalize(entry) do
    %{
      score: entry.score,
      wave: entry.wave,
      kills: entry.kills,
      names: entry.names,
      at: entry.at
    }
  end

  defp load do
    case path() do
      nil ->
        []

      path ->
        case File.read(path) do
          {:ok, body} ->
            case Jason.decode(body) do
              {:ok, list} when is_list(list) -> Enum.map(list, &atomize/1)
              _ -> []
            end

          _ ->
            []
        end
    end
  end

  defp save(scores) do
    case path() do
      nil ->
        :ok

      path ->
        File.mkdir_p!(Path.dirname(path))
        tmp = path <> ".tmp"
        File.write!(tmp, Jason.encode!(scores))
        File.rename!(tmp, path)
    end
  end

  defp atomize(row) do
    %{
      score: row["score"],
      wave: row["wave"],
      kills: row["kills"],
      names: row["names"] || [],
      at: row["at"]
    }
  end

  defp path, do: Application.get_env(:last_keep, :highscore_path)
end
