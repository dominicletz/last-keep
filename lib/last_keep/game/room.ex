defmodule LastKeep.Game.Room do
  @moduledoc false

  use GenServer

  alias LastKeep.Game.Highscores
  alias LastKeep.Game.Sim
  alias LastKeep.Game.Snapshot

  @idle_ms 600_000

  def start_link(opts) do
    code = Keyword.fetch!(opts, :code)
    GenServer.start_link(__MODULE__, opts, name: via(code))
  end

  def join(code, attrs), do: GenServer.call(via(code), {:join, attrs})

  def connect(code, id), do: GenServer.call(via(code), {:connect, id})

  def disconnect(code, id, generation \\ nil),
    do: GenServer.cast(via(code), {:disconnect, id, generation})

  def input(code, id, payload), do: GenServer.cast(via(code), {:input, id, payload})

  def start(code, id), do: GenServer.cast(via(code), {:start, id})

  def restart(code), do: GenServer.cast(via(code), :restart)

  def step(code), do: GenServer.call(via(code), :step)

  def snapshot(code), do: GenServer.call(via(code), :snapshot)

  def via(code), do: {:via, Registry, {LastKeep.Game.Registry, code}}

  @impl true
  def init(opts) do
    sim = Sim.new(Keyword.fetch!(opts, :code), opts)
    if Keyword.get(opts, :auto_tick, true), do: schedule()
    {:ok, %{sim: sim, scored: false, empty_since: System.monotonic_time(:millisecond)}}
  end

  @impl true
  def handle_call({:join, attrs}, _from, state) do
    case Sim.join(state.sim, attrs) do
      {:ok, sim} ->
        player = sim.players[attrs.id]
        state = %{state | sim: sim, empty_since: nil}
        {:reply, {:ok, player.public_id, Snapshot.render(sim)}, state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  def handle_call({:connect, id}, _from, state) do
    case state.sim.players[id] do
      nil ->
        {:reply, {:error, :unknown}, state}

      player ->
        generation = player.generation + 1

        {:ok, sim} =
          Sim.join(state.sim, %{
            id: id,
            name: player.name,
            hero: player.hero,
            connected: true
          })

        player = %{sim.players[id] | generation: generation}
        sim = %{sim | players: Map.put(sim.players, id, player)}
        state = %{state | sim: sim, empty_since: nil}
        {:reply, {:ok, player.public_id, generation, Snapshot.render(sim)}, state}
    end
  end

  def handle_call(:step, _from, state) do
    state = advance(state)
    {:reply, Snapshot.render(state.sim), state}
  end

  def handle_call(:snapshot, _from, state) do
    {:reply, Snapshot.render(state.sim), state}
  end

  def handle_call({:spawn_monster, attrs}, _from, state) do
    {:reply, :ok, %{state | sim: Sim.spawn_monster(state.sim, attrs)}}
  end

  @impl true
  def handle_cast({:disconnect, id, generation}, state) do
    {:noreply, %{state | sim: Sim.disconnect(state.sim, id, generation)}}
  end

  def handle_cast({:input, id, payload}, state) do
    {:noreply, %{state | sim: Sim.input(state.sim, id, payload)}}
  end

  def handle_cast({:start, id}, state) do
    {:noreply, %{state | sim: Sim.release(state.sim, id)}}
  end

  def handle_cast(:restart, state) do
    {:noreply, %{state | sim: Sim.restart(state.sim), scored: false}}
  end

  @impl true
  def handle_info(:tick, state) do
    state = advance(state)

    case idle(state) do
      {:stop, state} ->
        {:stop, :normal, state}

      state ->
        schedule()
        {:noreply, state}
    end
  end

  defp advance(state) do
    sim = Sim.tick(state.sim)
    state = %{state | sim: sim}

    if sim.phase == :over and not state.scored and Sim.score(sim) > 0 do
      Highscores.submit(%{
        score: Sim.score(sim),
        wave: sim.wave,
        kills: sim.kills,
        names: Enum.map(sim.players, fn {_id, player} -> player.name end),
        at: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()
      })

      broadcast(sim)
      %{state | scored: true}
    else
      broadcast(sim)
      state
    end
  end

  defp idle(state) do
    connected = Enum.any?(state.sim.players, fn {_id, player} -> player.connected end)
    now = System.monotonic_time(:millisecond)

    cond do
      connected ->
        %{state | empty_since: nil}

      state.empty_since == nil ->
        %{state | empty_since: now}

      now - state.empty_since > @idle_ms ->
        {:stop, state}

      true ->
        state
    end
  end

  defp broadcast(sim) do
    Phoenix.PubSub.broadcast(LastKeep.PubSub, topic(sim.code), {:snap, Snapshot.render(sim)})
  end

  def topic(code), do: "room:" <> code

  defp schedule, do: Process.send_after(self(), :tick, 50)
end
