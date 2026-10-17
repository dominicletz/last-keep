defmodule LastKeep.Game.Room do
  @moduledoc false

  use GenServer

  alias LastKeep.Game.Highscores
  alias LastKeep.Game.Sim
  alias LastKeep.Game.Snapshot

  # A closed browser used to leave the sim ticking for ten minutes. Smoke and
  # playtests open a room per scenario, so those abandoned sims stacked on the
  # box and the next room's inputs stalled. An empty room freezes the sim at
  # once. After a player has connected, it terminates a few seconds later so a
  # reload can rejoin. A room that nobody ever opened lasts @lobby_ms.
  @empty_ms 4_000
  @lobby_ms 60_000

  def child_spec(opts) do
    code = Keyword.fetch!(opts, :code)

    %{
      id: {__MODULE__, code},
      start: {__MODULE__, :start_link, [opts]},
      restart: :transient
    }
  end

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

    state = %{
      sim: sim,
      scored: false,
      empty_since: System.monotonic_time(:millisecond),
      saw_connection: false,
      empty_ms: Keyword.get(opts, :idle_ms, @empty_ms),
      lobby_ms: Keyword.get(opts, :lobby_ms, @lobby_ms),
      auto_tick: Keyword.get(opts, :auto_tick, true),
      timer: nil
    }

    state = if Keyword.get(opts, :auto_tick, true), do: schedule_tick(state), else: state
    {:ok, state}
  end

  @impl true
  def handle_call({:join, attrs}, _from, state) do
    case Sim.join(state.sim, attrs) do
      {:ok, sim} ->
        player = sim.players[attrs.id]
        state = note_presence(%{state | sim: sim})
        {:reply, {:ok, player.public_id, Snapshot.render(sim)}, follow_presence(state)}

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
        state = note_presence(%{state | sim: sim})

        {:reply, {:ok, player.public_id, generation, Snapshot.render(sim)},
         follow_presence(state)}
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
  # A timer that already fired cannot be cancelled. Dropping its ref and
  # starting another clock left both running, so every join could double the
  # tick. Only the ref stored in state is the live clock.
  def handle_info({:tick, ref}, %{timer: {ref, _timer}} = state) do
    state = advance(%{state | timer: nil})
    state = note_presence(state)

    if connected?(state) do
      {:noreply, schedule_tick(%{state | empty_since: nil})}
    else
      case park(state) do
        {:stop, state} -> {:stop, :normal, state}
        state -> {:noreply, state}
      end
    end
  end

  def handle_info({:tick, _ref}, state), do: {:noreply, state}

  def handle_info({:reap, ref}, %{timer: {ref, _timer}} = state) do
    state = note_presence(%{state | timer: nil})

    cond do
      connected?(state) ->
        {:noreply, schedule_tick(%{state | empty_since: nil})}

      true ->
        case park(state) do
          {:stop, state} -> {:stop, :normal, state}
          state -> {:noreply, state}
        end
    end
  end

  def handle_info({:reap, _ref}, state), do: {:noreply, state}

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

  defp connected?(state) do
    Enum.any?(state.sim.players, fn {_id, player} -> player.connected end)
  end

  defp note_presence(state) do
    if connected?(state), do: %{state | saw_connection: true}, else: state
  end

  # Someone is here: run the sim. A seat that has not opened the socket yet
  # keeps the longer lobby wait, measured from this join.
  defp follow_presence(%{auto_tick: false} = state), do: state

  defp follow_presence(state) do
    if connected?(state) do
      schedule_tick(%{state | empty_since: nil})
    else
      now = System.monotonic_time(:millisecond)
      limit = if state.saw_connection, do: state.empty_ms, else: state.lobby_ms
      schedule_reap(%{state | empty_since: now}, limit)
    end
  end

  defp park(state) do
    now = System.monotonic_time(:millisecond)
    empty_since = state.empty_since || now
    limit = if state.saw_connection, do: state.empty_ms, else: state.lobby_ms
    waited = now - empty_since

    if waited >= limit do
      {:stop, %{state | empty_since: empty_since}}
    else
      schedule_reap(%{state | empty_since: empty_since}, limit - waited)
    end
  end

  defp broadcast(sim) do
    Phoenix.PubSub.broadcast(LastKeep.PubSub, topic(sim.code), {:snap, Snapshot.render(sim)})
  end

  def topic(code), do: "room:" <> code

  defp schedule_tick(state) do
    state = cancel_timer(state)
    ref = make_ref()
    %{state | timer: {ref, Process.send_after(self(), {:tick, ref}, 50)}}
  end

  defp schedule_reap(state, delay) do
    state = cancel_timer(state)
    ref = make_ref()
    %{state | timer: {ref, Process.send_after(self(), {:reap, ref}, max(delay, 0))}}
  end

  defp cancel_timer(%{timer: nil} = state), do: state

  defp cancel_timer(%{timer: {_ref, timer}} = state) do
    Process.cancel_timer(timer)
    %{state | timer: nil}
  end
end
