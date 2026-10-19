defmodule LastKeep.Game.Sim do
  @moduledoc false

  alias LastKeep.Game.Rules
  alias LastKeep.Game.State
  alias LastKeep.Game.Waves
  alias LastKeep.Game.World

  @empty_input %{
    mx: 0.0,
    my: 0.0,
    ax: 0.0,
    ay: 0.0,
    attack: false,
    q: false,
    e: false,
    r: false,
    f: false,
    place: false,
    raise: false,
    build: nil
  }

  @empty_pressed %{
    attack: false,
    q: false,
    e: false,
    r: false,
    f: false,
    place: false,
    raise: false
  }

  def new(code, opts \\ []) do
    seed = Keyword.get(opts, :seed, System.unique_integer([:positive]))
    seed = if seed < 1, do: 1, else: seed
    build = Keyword.get(opts, :build_ticks, Rules.first_build_ticks())
    keep_hp = Keyword.get(opts, :keep_hp, 900)
    hold = Keyword.get(opts, :hold, true)
    rng = :rand.seed_s(:exsss, {seed, seed + 3, seed + 11})
    {hints, rng} = Waves.plan(1, rng)

    state = %State{
      code: code,
      rng: rng,
      phase: {:build, build},
      hold: hold,
      hints: hints,
      keep: %{hp: keep_hp, max_hp: keep_hp, r: 54.0},
      world: lay_world(seed)
    }

    place_trees(state, 30)
  end

  def join(%State{} = state, attrs) do
    id = attrs.id
    name = attrs.name
    hero = attrs.hero
    connected = Map.get(attrs, :connected, true)

    cond do
      not Rules.hero?(hero) ->
        {:error, :hero}

      state.phase == :over and not Map.has_key?(state.players, id) ->
        {:error, :over}

      Map.has_key?(state.players, id) ->
        {:ok, reconnect(state, id, name, connected)}

      map_size(state.players) >= Rules.max_players() ->
        {:error, :full}

      true ->
        {:ok, add_player(state, id, name, hero, connected)}
    end
  end

  def disconnect(%State{} = state, id, generation \\ nil) do
    case state.players[id] do
      nil ->
        state

      player ->
        if generation == nil or player.generation == generation do
          put_player(state, %{player | connected: false, input: @empty_input})
        else
          state
        end
    end
  end

  def input(%State{} = state, id, payload) when is_map(payload) do
    case state.players[id] do
      %{connected: true} = player ->
        next = parse_input(payload)

        pressed = %{
          attack: player.pressed.attack or rise(player.input.attack, next.attack),
          q: player.pressed.q or rise(player.input.q, next.q),
          e: player.pressed.e or rise(player.input.e, next.e),
          r: player.pressed.r or rise(player.input.r, next.r),
          f: player.pressed.f or rise(player.input.f, next.f),
          place: player.pressed.place or rise(player.input.place, next.place),
          raise: player.pressed.raise or rise(player.input.raise, next.raise)
        }

        {mx, my} = norm(next.mx, next.my)
        steered = player.steered or mx != 0.0 or my != 0.0
        put_player(state, %{player | input: next, pressed: pressed, steered: steered})

      _ ->
        state
    end
  end

  def tick(%State{phase: :over} = state), do: %{state | tick: state.tick + 1, events: []}

  def tick(%State{} = state) do
    state
    |> bump()
    |> cooldowns()
    |> move_heroes()
    |> survey()
    |> open_chests()
    |> wake_camps()
    |> take_shrines()
    |> step_vagrants()
    |> gather()
    |> mine()
    |> abilities()
    |> remember_input()
    |> projectiles()
    |> towers()
    |> step_monsters()
    |> economy()
    |> advance_phase()
    |> respawns()
  end

  def spawn_monster(%State{} = state, attrs) do
    kind = Map.get(attrs, :kind, :goblin)
    base = Rules.monster(kind)
    wave = Map.get(attrs, :wave, max(state.wave, 1))
    scale_hp = Rules.hp_scale(wave)
    scale_dmg = Rules.dmg_scale(wave)
    hp = Map.get(attrs, :hp, round(base.hp * scale_hp))

    damage =
      Map.get(attrs, :damage, max(round(base.damage * scale_dmg * Rules.bite(kind, wave)), 1))

    speed = base.speed * Rules.pace(kind, wave)
    elite = Map.get(attrs, :elite)

    monster = %{
      type: :monster,
      id: state.next_id,
      kind: kind,
      x: num(Map.get(attrs, :x, 0.0)),
      y: num(Map.get(attrs, :y, 0.0)),
      hp: hp,
      max_hp: hp,
      speed: speed,
      damage: damage,
      r: base.r * 1.0,
      aggro: base.aggro,
      attack_cd: 0,
      slow: 0,
      marked: 0,
      elite: elite,
      enraged: false,
      special: 0
    }

    insert(state, monster)
  end

  # The host stands at angle 0 on the join ring, (120, 0). The camera follows
  # that hero, so these six stand on a ring around the host. The old ring
  # around the keep left the rider outside that frame.
  @parade [
    {:goblin, 120.0, -55.0},
    {:skeleton, 167.63, -27.5},
    {:wolf, 167.63, 27.5},
    {:troll, 120.0, 55.0},
    {:bat, 72.37, 27.5},
    {:boss, 72.37, -27.5}
  ]

  def parade(%State{} = state) do
    Enum.reduce(@parade, state, fn {kind, x, y}, state ->
      id = state.next_id
      state = spawn_monster(state, %{kind: kind, x: x, y: y, wave: 1})
      monster = %{state.entities[id] | speed: 10.0}
      %{state | entities: Map.put(state.entities, id, monster)}
    end)
  end

  def spawn_building(%State{} = state, attrs) do
    kind = attrs.kind
    spec = Rules.building(kind)

    building = %{
      type: :building,
      id: state.next_id,
      kind: kind,
      x: snap(num(attrs.x)),
      y: snap(num(attrs.y)),
      hp: spec.hp,
      max_hp: spec.hp,
      r: spec.r * 1.0,
      cd: 0
    }

    state |> insert(building) |> refresh_upgrades()
  end

  def waves_survived(%State{phase: phase, wave: wave}) when phase in [:over] or is_tuple(phase) do
    case phase do
      {:wave, _} -> max(wave - 1, 0)
      :over -> max(wave - 1, 0)
      _ -> wave
    end
  end

  def score(%State{} = state), do: waves_survived(state) * 1000 + state.kills * 10

  def release(%State{hold: true} = state, id) do
    case state.players[id] do
      %{public_id: "p1"} -> %{state | hold: false}
      _ -> state
    end
  end

  def release(%State{} = state, _id), do: state

  def restart(%State{} = state) do
    fresh = new(state.code, seed: System.unique_integer([:positive]))

    state.players
    |> Enum.sort_by(fn {_id, player} ->
      player.public_id |> String.trim_leading("p") |> String.to_integer()
    end)
    |> Enum.reduce(fresh, fn {id, player}, sim ->
      {:ok, sim} =
        join(sim, %{id: id, name: player.name, hero: player.hero, connected: player.connected})

      sim
    end)
  end

  defp bump(state), do: %{state | tick: state.tick + 1, events: []}

  defp reconnect(state, id, name, connected) do
    player = state.players[id]
    put_player(state, %{player | name: name, connected: connected})
  end

  defp add_player(state, id, name, hero, connected) do
    n = map_size(state.players)
    angle = n * 2.2
    x = :math.cos(angle) * 120
    y = :math.sin(angle) * 120
    stats = Rules.kit(hero)
    public_id = "p#{n + 1}"

    entity = %{
      type: :hero,
      id: state.next_id,
      player_id: id,
      hero: hero,
      x: x,
      y: y,
      facing: angle + :math.pi(),
      hp: stats.hp,
      max_hp: stats.hp,
      r: 14.0,
      alive: true,
      respawn: 0,
      guard: 0,
      chop: 0,
      cooldowns: %{attack: 0, q: 0, e: 0, r: 0}
    }

    player = %{
      id: id,
      public_id: public_id,
      name: name,
      hero: hero,
      hero_id: entity.id,
      connected: connected,
      generation: 0,
      input: @empty_input,
      prev: @empty_input,
      pressed: @empty_pressed,
      steered: false
    }

    state
    |> insert(entity)
    |> put_player(player)
  end

  defp cooldowns(state) do
    entities =
      Map.new(state.entities, fn
        {id, %{type: :hero, cooldowns: cds} = hero} ->
          cds = Map.new(cds, fn {key, value} -> {key, max(value - 1, 0)} end)
          {id, %{hero | cooldowns: cds, guard: max(hero.guard - 1, 0)}}

        {id, %{type: :vagrant, cooldowns: cds} = vagrant} ->
          cds = Map.new(cds, fn {key, value} -> {key, max(value - 1, 0)} end)
          {id, %{vagrant | cooldowns: cds}}

        {id, %{type: :monster} = monster} ->
          {id,
           %{
             monster
             | attack_cd: max(monster.attack_cd - 1, 0),
               slow: max(monster.slow - 1, 0),
               marked: max(monster.marked - 1, 0)
           }}

        other ->
          other
      end)

    %{state | entities: entities}
  end

  defp respawns(%{phase: :over} = state), do: state

  defp respawns(state) do
    Enum.reduce(heroes(state), state, fn hero, state ->
      cond do
        hero.alive ->
          state

        hero.respawn <= 1 ->
          {unit, rng} = :rand.uniform_s(state.rng)
          angle = unit * 2 * :math.pi()
          stats = Rules.kit(hero.hero)

          put_entity(%{state | rng: rng}, %{
            hero
            | alive: true,
              hp: stats.hp,
              respawn: 0,
              x: :math.cos(angle) * 110,
              y: :math.sin(angle) * 110
          })

        true ->
          put_entity(state, %{hero | respawn: hero.respawn - 1})
      end
    end)
  end

  defp move_heroes(state) do
    Enum.reduce(state.players, state, fn {_id, player}, state ->
      hero = state.entities[player.hero_id]

      if player.connected and hero.alive do
        {mx, my, auto} = steer(state, hero, player)
        speed = Rules.kit(hero.hero).speed * speed_mult(state)
        step = speed * 0.05
        dx = mx * step
        dy = my * step
        {x, y} = slide(state, hero.x, hero.y, dx, dy, hero.r, %{ignore: hero.id})

        {x, y} =
          if auto and x == hero.x and y == hero.y do
            around(state, hero, mx, my, step)
          else
            {x, y}
          end

        {x, y} = clamp_map(x, y, Rules.map_radius())
        facing = facing_of(hero, player.input, x, y)
        put_entity(state, %{hero | x: x, y: y, facing: facing})
      else
        state
      end
    end)
  end

  defp steer(state, hero, player) do
    {mx, my} = norm(player.input.mx, player.input.my)

    cond do
      mx != 0.0 or my != 0.0 ->
        {mx, my, false}

      not match?({:wave, _}, state.phase) ->
        {0.0, 0.0, false}

      player.steered ->
        {0.0, 0.0, false}

      true ->
        case approach_target(state, hero) do
          nil ->
            {0.0, 0.0, false}

          monster ->
            {nx, ny} = norm(monster.x - hero.x, monster.y - hero.y)
            {nx, ny, true}
        end
    end
  end

  defp approach_target(state, hero) do
    reach = Rules.approach_reach()

    state
    |> monsters()
    |> Enum.filter(fn monster ->
      hypot(monster.x - hero.x, monster.y - hero.y) <= reach + monster.r
    end)
    |> closest(fn monster -> hypot(monster.x - hero.x, monster.y - hero.y) end)
  end

  defp around(state, hero, mx, my, step) do
    goal_x = hero.x + mx * 400
    goal_y = hero.y + my * 400
    px = -my
    py = mx
    current = hypot(goal_x - hero.x, goal_y - hero.y)

    closer =
      for sign <- [1.0, -1.0],
          scale <- [1.0, 0.5],
          nx = hero.x + (mx * scale + px * sign) * step,
          ny = hero.y + (my * scale + py * sign) * step,
          not body_blocked?(state, nx, ny, hero.r, %{ignore: hero.id}),
          dist = hypot(goal_x - nx, goal_y - ny),
          dist < current,
          do: {nx, ny, dist}

    case closer do
      [] ->
        {hero.x, hero.y}

      options ->
        {nx, ny, _} = Enum.min_by(options, fn {_x, _y, dist} -> dist end)
        {nx, ny}
    end
  end

  defp gather(state) do
    Enum.reduce(living_heroes(state), state, fn hero, state ->
      case nearest(trees(state), hero.x, hero.y, 48) do
        nil ->
          chop_pine(state, hero)

        tree ->
          rate = Rules.kit(hero.hero).chop
          acc = hero.chop + 1

          if acc >= rate and tree.wood > 0 do
            state = add_resource(state, :wood, 1)
            tree = %{tree | wood: tree.wood - 1}
            hero = %{state.entities[hero.id] | chop: 0}

            state =
              if tree.wood <= 0 do
                drop(state, tree.id)
              else
                put_entity(state, tree)
              end

            put_entity(state, hero)
          else
            put_entity(state, %{hero | chop: acc})
          end
      end
    end)
  end

  defp chop_pine(state, hero) do
    {i, j} = World.cell_index(hero.x, hero.y)
    cut = Map.get(state.world, :cut, %{})
    left = Map.get(cut, {i, j}, Rules.pine_wood())

    if World.biome(state.world.seed, hero.x, hero.y) == :pine and left > 0 do
      rate = Rules.kit(hero.hero).chop
      acc = hero.chop + 1

      if acc >= rate do
        state = %{state | world: %{state.world | cut: Map.put(cut, {i, j}, left - 1)}}
        state = add_resource(state, :wood, 1)
        put_entity(state, %{state.entities[hero.id] | chop: 0})
      else
        put_entity(state, %{hero | chop: acc})
      end
    else
      state
    end
  end

  defp mine(state) do
    Enum.reduce(living_heroes(state), state, fn hero, state ->
      case nearest_quarry(state.world.quarries, hero.x, hero.y) do
        nil ->
          state

        quarry ->
          room = Rules.cap(:stone) - state.resources.stone
          take = min(Rules.quarry_take(hero.hero), min(quarry.stone, room))

          if take <= 0 do
            state
          else
            quarries =
              Enum.map(state.world.quarries, fn row ->
                if row.id == quarry.id, do: %{row | stone: row.stone - take}, else: row
              end)

            state = %{state | world: %{state.world | quarries: quarries}}
            add_resource(state, :stone, take)
          end
      end
    end)
  end

  defp nearest_quarry(quarries, x, y) do
    quarries
    |> Enum.filter(&(&1.stone > 0))
    |> nearest(x, y, 48)
  end

  defp lay_world(seed) do
    grouped = seed |> World.generate() |> Map.fetch!(:pois) |> Enum.group_by(& &1.kind)
    hp = Rules.portal_hp()

    %{
      seed: seed,
      chunks: %{},
      discovered: keep_chunks(),
      claimed: MapSet.new(),
      cut: %{},
      portals:
        Enum.map(grouped[:portal] || [], fn poi ->
          Map.merge(poi, %{hp: hp, max_hp: hp, r: 28.0})
        end),
      chests: Enum.map(grouped[:chest] || [], &Map.put(&1, :gold, Rules.chest_gold())),
      camps: grouped[:camp] || [],
      quarries: Enum.map(grouped[:quarry] || [], &Map.put(&1, :stone, Rules.quarry_stone())),
      shrines: grouped[:shrine] || [],
      merchant: List.first(grouped[:merchant] || []),
      hermit: List.first(grouped[:hermit] || [])
    }
  end

  defp keep_chunks do
    for cx <- -1..0, cy <- -1..0, into: MapSet.new(), do: {cx, cy}
  end

  defp survey(state) do
    {discovered, chunks} =
      Enum.reduce(living_heroes(state), {state.world.discovered, state.world.chunks}, fn hero,
                                                                                         {found,
                                                                                          chunks} ->
        {cx, cy} = World.chunk_coord(hero.x, hero.y)
        ring = reveal_ring(hero)

        Enum.reduce(-ring..ring, {found, chunks}, fn dx, {found, chunks} ->
          Enum.reduce(-ring..ring, {found, chunks}, fn dy, {found, chunks} ->
            key = {cx + dx, cy + dy}

            if World.chunk_in_bounds?(key) do
              {MapSet.put(found, key), ensure_chunk(state.world.seed, chunks, key)}
            else
              {found, chunks}
            end
          end)
        end)
      end)

    %{state | world: %{state.world | discovered: discovered, chunks: chunks}}
  end

  defp ensure_chunk(seed, chunks, {cx, cy} = key) do
    cond do
      Map.has_key?(chunks, key) -> chunks
      cx < -14 or cx > 14 or cy < -14 or cy > 14 -> chunks
      true -> Map.put(chunks, key, World.chunk(seed, cx, cy))
    end
  end

  defp reveal_ring(hero) do
    if hero.hero == :scout, do: 2, else: 1
  end

  defp open_chests(state) do
    Enum.reduce(living_heroes(state), state, fn hero, state ->
      case nearest(state.world.chests, hero.x, hero.y, Rules.chest_reach()) do
        nil ->
          state

        chest ->
          chests = Enum.reject(state.world.chests, &(&1.id == chest.id))

          %{state | world: %{state.world | chests: chests}}
          |> add_resource(:gold, chest.gold)
          |> event(%{type: "chest", x: chest.x, y: chest.y, amount: chest.gold})
      end
    end)
  end

  defp wake_camps(state) do
    Enum.reduce(living_heroes(state), state, fn hero, state ->
      case nearest(state.world.camps, hero.x, hero.y, Rules.chest_reach()) do
        nil -> state
        camp -> wake_camp(state, camp)
      end
    end)
  end

  defp take_shrines(state) do
    Enum.reduce(living_heroes(state), state, fn hero, state ->
      case nearest(state.world.shrines, hero.x, hero.y, Rules.chest_reach()) do
        nil ->
          state

        shrine ->
          shrines = Enum.reject(state.world.shrines, &(&1.id == shrine.id))
          state = %{state | world: %{state.world | shrines: shrines}}
          grant_relic(state)
      end
    end)
  end

  defp wake_camp(state, camp) do
    open = Rules.heroes() -- Enum.map(state.players, fn {_id, player} -> player.hero end)
    cost = %{gold: Rules.vagrant_cost()}

    if open == [] or not afford?(state, cost) do
      state
    else
      role = Enum.at(open, rem(state.world.seed + camp.id, length(open)))
      kit = Rules.kit(role)
      camps = Enum.reject(state.world.camps, &(&1.id == camp.id))
      state = %{state | world: %{state.world | camps: camps}}
      state = pay(state, cost)

      insert(state, %{
        type: :vagrant,
        id: state.next_id,
        hero: role,
        x: camp.x * 1.0,
        y: camp.y * 1.0,
        facing: 0.0,
        hp: kit.hp,
        max_hp: kit.hp,
        r: 14.0,
        alive: true,
        cooldowns: %{attack: 0, q: 0, e: 0, r: 0}
      })
    end
  end

  defp step_vagrants(state) do
    ids = for {id, %{type: :vagrant, alive: true}} <- state.entities, do: id

    Enum.reduce(ids, state, fn id, state ->
      case state.entities[id] do
        %{type: :vagrant, alive: true} = vagrant -> step_vagrant(state, vagrant)
        _ -> state
      end
    end)
  end

  defp step_vagrant(state, vagrant) do
    ability = Rules.kit(vagrant.hero).attack

    case prey(monsters(state), vagrant, ability) do
      nil -> follow_hero(state, vagrant)
      monster -> engage(state, vagrant, monster, ability)
    end
  end

  defp prey(monsters, vagrant, %{kind: :melee} = ability) do
    nearest(monsters, vagrant.x, vagrant.y, ability.range)
  end

  defp prey(monsters, vagrant, %{kind: :bolt}) do
    monsters
    |> Enum.filter(fn monster -> hypot(monster.x - vagrant.x, monster.y - vagrant.y) <= 320 end)
    |> closest(fn monster -> hypot(monster.x - vagrant.x, monster.y - vagrant.y) end)
  end

  defp engage(state, vagrant, monster, ability) do
    vagrant = face(vagrant, monster)
    state = put_entity(state, vagrant)

    if vagrant.cooldowns.attack > 0 do
      state
    else
      swing(state, vagrant, monster, ability)
    end
  end

  defp swing(state, vagrant, _aim, %{kind: :melee} = ability) do
    vagrant = start_cd(state, vagrant, :attack, ability.cd)
    state = put_entity(state, vagrant)
    state = event(state, %{type: "swing", x: vagrant.x, y: vagrant.y})
    range = ability.range

    monsters(state)
    |> Enum.filter(fn monster ->
      hypot(monster.x - vagrant.x, monster.y - vagrant.y) <= range + monster.r and
        angle_between(vagrant, monster) <= ability.arc / 2
    end)
    |> Enum.reduce(state, fn monster, state ->
      damage = scaled_damage(ability.damage, state, vagrant.hero, monster)
      hurt_monster(state, monster.id, damage, Rules.kill_bonus(vagrant.hero))
    end)
    |> strike_portals(vagrant, ability)
    |> repair_near(vagrant, Map.get(ability, :repair, 0))
  end

  defp swing(state, vagrant, monster, %{kind: :bolt} = ability) do
    vagrant = start_cd(state, vagrant, :attack, ability.cd)
    state = put_entity(state, vagrant)
    {dx, dy} = aim_dir(vagrant, %{ax: monster.x, ay: monster.y})
    damage = scaled_damage(ability.damage, state, vagrant.hero, nil)

    insert(state, %{
      type: :projectile,
      id: state.next_id,
      kind: :bolt,
      x: vagrant.x + dx * 18,
      y: vagrant.y + dy * 18,
      vx: dx * ability.speed,
      vy: dy * ability.speed,
      damage: damage,
      r: ability.radius * 1.0,
      life: ability.life,
      aoe: 0.0,
      hero: vagrant.hero,
      fresh: true
    })
  end

  defp follow_hero(state, vagrant) do
    case closest(living_heroes(state), fn hero ->
           hypot(hero.x - vagrant.x, hero.y - vagrant.y)
         end) do
      nil ->
        state

      hero ->
        dx = hero.x - vagrant.x
        dy = hero.y - vagrant.y

        if hypot(dx, dy) <= 48 do
          put_entity(state, face(vagrant, hero))
        else
          step_toward(state, vagrant, dx, dy)
        end
    end
  end

  defp step_toward(state, vagrant, dx, dy) do
    speed = Rules.kit(vagrant.hero).speed * speed_mult(state) * 0.05
    {ux, uy} = norm(dx, dy)

    {nx, ny} =
      slide(state, vagrant.x, vagrant.y, ux * speed, uy * speed, vagrant.r, %{
        ignore: vagrant.id,
        pass_monsters: true
      })

    {nx, ny} = clamp_map(nx, ny, Rules.map_radius())
    sx = nx - vagrant.x
    sy = ny - vagrant.y

    facing =
      if hypot(sx, sy) > 1.0e-6 do
        :math.atan2(sy, sx)
      else
        :math.atan2(dy, dx)
      end

    put_entity(state, %{vagrant | x: nx, y: ny, facing: facing})
  end

  defp face(actor, target) do
    %{actor | facing: :math.atan2(target.y - actor.y, target.x - actor.x)}
  end

  defp strike_portals(state, hero, ability) do
    state.world.portals
    |> Enum.filter(fn portal ->
      dist = hypot(portal.x - hero.x, portal.y - hero.y)

      dist <= 48 or
        (dist <= ability.range + portal.r and angle_between(hero, portal) <= ability.arc / 2)
    end)
    |> Enum.reduce(state, fn portal, state -> hurt_portal(state, portal.id, ability.damage) end)
  end

  defp hurt_portal(state, id, amount) do
    case Enum.find(state.world.portals, &(&1.id == id)) do
      nil ->
        state

      portal ->
        left = portal.hp - amount

        portals =
          if left <= 0 do
            Enum.reject(state.world.portals, &(&1.id == id))
          else
            Enum.map(state.world.portals, fn
              %{id: ^id} = row -> %{row | hp: left}
              row -> row
            end)
          end

        claimed =
          if left <= 0 do
            MapSet.put(state.world.claimed, World.chunk_coord(portal.x, portal.y))
          else
            state.world.claimed
          end

        state = %{state | world: %{state.world | portals: portals, claimed: claimed}}

        if left <= 0 do
          event(state, %{type: "death", kind: :portal, x: portal.x, y: portal.y, amount: amount})
        else
          state
        end
    end
  end

  defp abilities(state) do
    Enum.reduce(state.players, state, fn {_id, player}, state ->
      hero = state.entities[player.hero_id]

      if player.connected and hero.alive do
        hero = state.entities[player.hero_id]
        state = maybe_attack(state, player, hero)
        state = maybe_skill(state, player, state.entities[hero.id], :q)
        state = maybe_skill(state, player, state.entities[hero.id], :e)
        state = maybe_skill(state, player, state.entities[hero.id], :r)
        state = maybe_feed(state, player, state.entities[hero.id])
        maybe_raise(state, player, state.entities[hero.id])
      else
        state
      end
    end)
  end

  defp maybe_attack(state, player, hero) do
    clicked = edged?(player, :attack)

    threat =
      if match?({:wave, _}, state.phase) do
        strike_target(state, hero)
      end

    cond do
      edged?(player, :place) ->
        case player.input.build do
          nil ->
            refuse(state, player.input.ax, player.input.ay, "Choose a building")

          kind ->
            {kind, cost} =
              if kind == :wall, do: wall_offer(state, hero), else: {kind, nil}

            try_place(state, hero, kind, player.input.ax, player.input.ay, cost)
        end

      (player.input.attack or clicked) && hero.cooldowns.attack <= 0 ->
        cast(state, player, hero, :attack, Rules.kit(hero.hero).attack)

      threat && hero.cooldowns.attack <= 0 ->
        {state, player, hero} = face_threat(state, player, hero, threat)
        cast(state, player, hero, :attack, Rules.kit(hero.hero).attack)

      true ->
        state
    end
  end

  defp strike_target(state, hero) do
    reach = Rules.strike_reach(Rules.kit(hero.hero).attack)

    state
    |> monsters()
    |> Enum.filter(fn monster ->
      hypot(monster.x - hero.x, monster.y - hero.y) <= reach + monster.r
    end)
    |> closest(fn monster -> hypot(monster.x - hero.x, monster.y - hero.y) end)
  end

  defp face_threat(state, player, hero, monster) do
    facing = :math.atan2(monster.y - hero.y, monster.x - hero.x)
    hero = %{hero | facing: facing}
    player = %{player | input: %{player.input | ax: monster.x, ay: monster.y}}
    state = state |> put_entity(hero) |> put_player(player)
    {state, player, hero}
  end

  defp maybe_skill(state, player, hero, slot) do
    ability = Map.get(Rules.kit(hero.hero), slot)

    if edged?(player, slot) and hero.cooldowns[slot] <= 0 and spell_open?(state, ability) do
      state = cast(state, player, hero, slot, ability)
      event(state, %{type: "shot", x: hero.x, y: hero.y})
    else
      state
    end
  end

  defp spell_open?(%{upgrades: %{mage_tower: true}}, %{kind: :meteor}), do: true
  defp spell_open?(_state, %{kind: :meteor}), do: false
  defp spell_open?(_state, _ability), do: true

  defp maybe_feed(state, player, hero) do
    near = hypot(hero.x, hero.y) < 100

    if edged?(player, :f) and near and state.resources.food >= 5 do
      state = pay(state, %{wood: 0, gold: 0, food: 5})
      heal = 50
      keep = state.keep
      hp = min(keep.hp + heal, keep.max_hp)
      event(%{state | keep: %{keep | hp: hp}}, %{type: "heal", x: 0.0, y: 0.0})
    else
      state
    end
  end

  defp cast(state, _player, hero, slot, %{kind: :melee} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)
    state = event(state, %{type: "swing", x: hero.x, y: hero.y})
    range = ability.range

    monsters(state)
    |> Enum.filter(fn monster ->
      hypot(monster.x - hero.x, monster.y - hero.y) <= range + monster.r and
        angle_between(hero, monster) <= ability.arc / 2
    end)
    |> Enum.reduce(state, fn monster, state ->
      damage = scaled_damage(ability.damage, state, hero.hero, monster)
      hurt_monster(state, monster.id, damage, Rules.kill_bonus(hero.hero))
    end)
    |> strike_portals(hero, ability)
    |> repair_near(hero, Map.get(ability, :repair, 0))
  end

  defp cast(state, _player, hero, slot, %{kind: :bolt} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)
    {dx, dy} = aim_dir(hero, state.players[hero.player_id].input)
    damage = scaled_damage(ability.damage, state, hero.hero, nil)

    state = event(state, %{type: "shot", x: hero.x, y: hero.y})

    insert(state, %{
      type: :projectile,
      id: state.next_id,
      kind: :bolt,
      x: hero.x + dx * 18,
      y: hero.y + dy * 18,
      vx: dx * ability.speed,
      vy: dy * ability.speed,
      damage: damage,
      r: ability.radius * 1.0,
      life: ability.life,
      aoe: 0.0,
      hero: hero.hero,
      fresh: true
    })
  end

  defp cast(state, player, hero, slot, %{kind: :fireball} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)
    {dx, dy} = aim_dir(hero, player.input)
    damage = scaled_damage(ability.damage, state, hero.hero, nil)

    insert(state, %{
      type: :projectile,
      id: state.next_id,
      kind: :fireball,
      x: hero.x + dx * 18,
      y: hero.y + dy * 18,
      vx: dx * ability.speed,
      vy: dy * ability.speed,
      damage: damage,
      r: ability.radius * 1.0,
      life: ability.life,
      aoe: ability.aoe * 1.0,
      hero: hero.hero,
      fresh: true
    })
  end

  defp cast(state, player, hero, slot, %{kind: :meteor} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)
    damage = scaled_damage(ability.damage, state, hero.hero, nil)

    insert(state, %{
      type: :projectile,
      id: state.next_id,
      kind: :meteor,
      x: player.input.ax * 1.0,
      y: player.input.ay * 1.0,
      vx: 0.0,
      vy: 0.0,
      damage: damage,
      r: 12.0,
      life: ability.life,
      aoe: ability.aoe * 1.0,
      hero: hero.hero,
      fresh: true
    })
  end

  defp cast(state, player, hero, slot, %{kind: :volley} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)
    {dx, dy} = aim_dir(hero, player.input)
    base = :math.atan2(dy, dx)
    damage = scaled_damage(ability.damage, state, hero.hero, nil)

    Enum.reduce(0..(ability.count - 1), state, fn i, state ->
      spread = (i - (ability.count - 1) / 2) * 0.18
      ang = base + spread
      vx = :math.cos(ang) * ability.speed
      vy = :math.sin(ang) * ability.speed

      insert(state, %{
        type: :projectile,
        id: state.next_id,
        kind: :arrow,
        x: hero.x + :math.cos(ang) * 18,
        y: hero.y + :math.sin(ang) * 18,
        vx: vx,
        vy: vy,
        damage: damage,
        r: 6.0,
        life: ability.life,
        aoe: 0.0,
        hero: hero.hero,
        fresh: true
      })
    end)
  end

  defp cast(state, player, hero, slot, %{kind: :dash} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    {dx, dy} = aim_dir(hero, player.input)
    pass_monsters = hero.hero == :warrior
    {x, y} = dash_to(state, hero, dx * ability.dist, dy * ability.dist, pass_monsters)
    state = put_entity(state, %{hero | x: x, y: y})

    if ability.damage > 0 do
      monsters(state)
      |> Enum.filter(fn monster ->
        hypot(monster.x - x, monster.y - y) <= ability.radius + monster.r
      end)
      |> Enum.reduce(state, fn monster, state ->
        damage = scaled_damage(ability.damage, state, hero.hero, monster)
        hurt_monster(state, monster.id, damage, Rules.kill_bonus(hero.hero))
      end)
    else
      state
    end
  end

  defp cast(state, _player, hero, slot, %{kind: :guard} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    put_entity(state, %{hero | guard: ability.ticks})
  end

  defp cast(state, _player, hero, slot, %{kind: :nova} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)

    monsters(state)
    |> Enum.filter(fn monster ->
      hypot(monster.x - hero.x, monster.y - hero.y) <= ability.radius + monster.r
    end)
    |> Enum.reduce(state, fn monster, state ->
      damage = scaled_damage(ability.damage, state, hero.hero, monster)
      hurt_monster(state, monster.id, damage, Rules.kill_bonus(hero.hero))
    end)
  end

  defp cast(state, _player, hero, slot, %{kind: :frost} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)

    monsters(state)
    |> Enum.filter(fn monster ->
      hypot(monster.x - hero.x, monster.y - hero.y) <= ability.radius + monster.r
    end)
    |> Enum.reduce(state, fn monster, state ->
      case state.entities[monster.id] do
        nil -> state
        current -> put_entity(state, %{current | slow: ability.ticks})
      end
    end)
  end

  defp cast(state, _player, hero, slot, %{kind: :mark} = ability) do
    hero = start_cd(state, hero, slot, ability.cd)
    state = put_entity(state, hero)

    monsters(state)
    |> Enum.filter(fn monster ->
      hypot(monster.x - hero.x, monster.y - hero.y) <= ability.range and
        angle_between(hero, monster) <= ability.arc
    end)
    |> Enum.reduce(state, fn monster, state ->
      case state.entities[monster.id] do
        nil -> state
        current -> put_entity(state, %{current | marked: ability.ticks})
      end
    end)
  end

  defp cast(state, player, hero, slot, %{kind: :sow}) do
    before = field_count(state)
    hero = start_cd(state, hero, slot, Rules.kit(:farmer).q.cd)
    state = put_entity(state, hero)
    state = try_place(state, hero, :field, player.input.ax, player.input.ay, %{wood: 0, gold: 0})
    if field_count(state) > before, do: bank(state, 1), else: state
  end

  defp cast(state, _player, hero, slot, %{kind: :harvest} = ability) do
    fields =
      buildings(state)
      |> Enum.filter(fn building ->
        building.kind == :field and
          hypot(building.x - hero.x, building.y - hero.y) <= ability.radius
      end)

    if fields == [] do
      state
    else
      hero = start_cd(state, hero, slot, ability.cd)
      state = put_entity(state, hero)
      state = add_resource(state, :food, length(fields) * ability.food)
      bank(state, 1)
    end
  end

  defp cast(state, _player, hero, slot, %{kind: :feast} = ability) do
    spend = min(ability.food, state.resources.food)

    if spend <= 0 do
      state
    else
      hero = start_cd(state, hero, slot, ability.cd)
      state = put_entity(state, hero)
      state = pay(state, %{wood: 0, gold: 0, food: spend})
      heal = spend * ability.heal

      Enum.reduce(living_heroes(state), state, fn current, state ->
        current = state.entities[current.id]
        put_entity(state, %{current | hp: min(current.hp + heal, current.max_hp)})
      end)
    end
  end

  defp cast(state, player, hero, slot, %{kind: :wall}) do
    hero = start_cd(state, hero, slot, Rules.kit(hero.hero).q.cd)
    state = put_entity(state, hero)
    {kind, cost} = wall_offer(state, hero)
    try_place(state, hero, kind, player.input.ax, player.input.ay, cost)
  end

  defp cast(state, player, hero, slot, %{kind: :trap}) do
    hero = start_cd(state, hero, slot, Rules.kit(hero.hero).e.cd)
    state = put_entity(state, hero)
    try_place(state, hero, :trap, player.input.ax, player.input.ay)
  end

  defp cast(state, player, hero, slot, %{kind: :barricade}) do
    cost = Rules.barricade_cost(hero.hero)
    spots = barricade_spots(hero, player.input)

    cond do
      not afford?(state, cost) ->
        refuse(state, player.input.ax, player.input.ay, "Not enough wood")

      Enum.all?(spots, fn {x, y} -> not held?(state, x, y) end) ->
        refuse(state, player.input.ax, player.input.ay, "The land is not held.")

      true ->
        hero = start_cd(state, hero, slot, Rules.kit(hero.hero).r.cd)
        state = put_entity(state, hero)
        state = pay(state, cost)

        Enum.reduce(spots, state, fn {x, y}, state ->
          try_place(state, hero, :wall, x, y, %{wood: 0, gold: 0})
        end)
    end
  end

  defp cast(state, _player, _hero, _slot, _ability), do: state

  defp barricade_spots(hero, input) do
    {dx, dy} = aim_dir(hero, input)
    px = -dy
    py = dx
    cx = hero.x + dx * 70
    cy = hero.y + dy * 70

    Enum.map(-1..1, fn i ->
      {snap(cx + px * i * 36), snap(cy + py * i * 36)}
    end)
  end

  defp wall_offer(state, hero) do
    cost = Rules.cost(:stone_wall, hero.hero)
    if afford?(state, cost), do: {:stone_wall, cost}, else: {:wall, nil}
  end

  defp try_place(state, hero, kind, x, y, cost \\ nil) do
    x = snap(num(x))
    y = snap(num(y))
    cost = cost || Rules.cost(kind, hero.hero)
    limit = build_limit(kind)
    have = Enum.count(buildings(state), &(&1.kind == kind))
    dist = hypot(x - hero.x, y - hero.y)

    cond do
      have >= limit ->
        refuse(state, x, y, "Too many")

      dist > Rules.build_range(hero.hero, state.town) ->
        refuse(state, x, y, "Too far")

      not held?(state, x, y) ->
        refuse(state, x, y, "The land is not held.")

      hypot(x, y) < state.keep.r + 28 ->
        refuse(state, x, y, "Too close to the keep")

      overlap?(state, x, y, Rules.building(kind).r) ->
        refuse(state, x, y, "Blocked")

      kind == :field and World.biome(state.world.seed, x, y) != :meadow ->
        refuse(state, x, y, "Not meadow")

      state.resources.wood < Map.get(cost, :wood, 0) ->
        refuse(state, x, y, "Not enough wood")

      state.resources.gold < Map.get(cost, :gold, 0) ->
        refuse(state, x, y, "Not enough gold")

      state.resources.stone < Map.get(cost, :stone, 0) ->
        refuse(state, x, y, "Not enough stone")

      true ->
        state
        |> pay(cost)
        |> spawn_building(%{kind: kind, x: x, y: y})
        |> event(%{type: "place", kind: kind, x: x, y: y})
    end
  end

  defp held?(state, x, y) do
    hypot(x, y) <= World.keep_disc() or
      MapSet.member?(state.world.claimed, World.chunk_coord(x, y))
  end

  defp build_limit(:wall), do: 80
  defp build_limit(:stone_wall), do: 80
  defp build_limit(:tower), do: 16
  defp build_limit(:trap), do: 40
  defp build_limit(:field), do: 14
  defp build_limit(:forge), do: 1
  defp build_limit(:mage_tower), do: 1

  defp projectiles(state) do
    ids = for {id, %{type: :projectile}} <- state.entities, do: id

    Enum.reduce(ids, state, fn id, state ->
      case state.entities[id] do
        nil -> state
        projectile -> step_projectile(state, projectile)
      end
    end)
  end

  defp step_projectile(state, %{fresh: true} = projectile) do
    put_entity(state, %{projectile | fresh: false})
  end

  defp step_projectile(state, %{kind: :meteor, life: life} = projectile) when life <= 1 do
    explode(state, projectile)
  end

  defp step_projectile(state, %{kind: :meteor} = projectile) do
    put_entity(state, %{projectile | life: projectile.life - 1})
  end

  defp step_projectile(state, projectile) do
    projectile = %{
      projectile
      | x: projectile.x + projectile.vx * 0.05,
        y: projectile.y + projectile.vy * 0.05,
        life: projectile.life - 1
    }

    case nearest(monsters(state), projectile.x, projectile.y, projectile.r + 8) do
      nil ->
        if projectile.life <= 0 do
          if projectile.aoe > 0, do: explode(state, projectile), else: drop(state, projectile.id)
        else
          put_entity(state, projectile)
        end

      monster ->
        if projectile.aoe > 0 do
          explode(state, projectile)
        else
          state
          |> hurt_monster(monster.id, projectile.damage, Rules.kill_bonus(projectile.hero))
          |> drop(projectile.id)
        end
    end
  end

  defp explode(state, projectile) do
    state = drop(state, projectile.id)

    monsters(state)
    |> Enum.filter(fn monster ->
      hypot(monster.x - projectile.x, monster.y - projectile.y) <= projectile.aoe + monster.r
    end)
    |> Enum.reduce(state, fn monster, state ->
      hurt_monster(state, monster.id, projectile.damage, Rules.kill_bonus(projectile.hero))
    end)
    |> event(%{type: "boom", x: projectile.x, y: projectile.y})
  end

  defp towers(state) do
    ids = for {id, %{type: :building, kind: :tower}} <- state.entities, do: id

    Enum.reduce(ids, state, fn id, state ->
      case state.entities[id] do
        nil ->
          state

        %{cd: cd} = tower when cd > 0 ->
          put_entity(state, %{tower | cd: cd - 1})

        tower ->
          case nearest(monsters(state), tower.x, tower.y, 250) do
            nil ->
              state

            monster ->
              {dx, dy} = norm(monster.x - tower.x, monster.y - tower.y)
              damage = scaled_damage(11, state, :tower, nil)

              state
              |> put_entity(%{tower | cd: 18})
              |> insert(%{
                type: :projectile,
                id: state.next_id,
                kind: :arrow,
                x: tower.x,
                y: tower.y,
                vx: dx * 420,
                vy: dy * 420,
                damage: damage,
                r: 6.0,
                life: 30,
                aoe: 0.0,
                hero: :tower,
                fresh: true
              })
          end
      end
    end)
  end

  defp step_monsters(state) do
    ids = for {id, %{type: :monster}} <- state.entities, do: id

    state =
      Enum.reduce(ids, state, fn id, state ->
        case state.entities[id] do
          nil -> state
          monster -> step_monster(state, monster)
        end
      end)

    separate_monsters(state, ids)
  end

  defp separate_monsters(state, ids) do
    Enum.reduce(pairs(ids), state, fn {left, right}, state ->
      push_apart(state, left, right)
    end)
  end

  defp pairs([]), do: []
  defp pairs([_]), do: []
  defp pairs([head | tail]), do: Enum.map(tail, &{head, &1}) ++ pairs(tail)

  defp push_apart(state, left_id, right_id) do
    with %{type: :monster} = left <- state.entities[left_id],
         %{type: :monster} = right <- state.entities[right_id] do
      dx = right.x - left.x
      dy = right.y - left.y
      dist = hypot(dx, dy)
      need = left.r + right.r

      if dist >= need do
        state
      else
        {ux, uy} = if dist < 0.01, do: {1.0, 0.0}, else: {dx / dist, dy / dist}
        gap = (need - dist) / 2

        state
        |> put_entity(%{left | x: left.x - ux * gap, y: left.y - uy * gap})
        |> put_entity(%{right | x: right.x + ux * gap, y: right.y + uy * gap})
      end
    else
      _ -> state
    end
  end

  defp step_monster(state, monster) do
    monster = state.entities[monster.id] || monster
    hero = aggro_hero(state, monster)
    {tx, ty, target} = monster_target(state, monster, hero)
    reach = if target == :hero, do: monster.r + 16, else: state.keep.r + monster.r
    dist = hypot(monster.x - tx, monster.y - ty)

    state =
      if dist <= reach and monster.attack_cd <= 0 do
        strike(state, monster, target, hero)
      else
        chase(state, monster, tx, ty)
      end

    case state.entities[monster.id] do
      nil -> state
      moved -> trigger_trap(state, moved)
    end
  end

  defp monster_target(_state, _monster, nil), do: {0.0, 0.0, :keep}

  defp monster_target(state, monster, hero) do
    to_hero = hypot(monster.x - hero.x, monster.y - hero.y)
    to_keep = hypot(monster.x, monster.y) - state.keep.r

    if to_hero <= monster.aggro and to_hero < to_keep do
      {hero.x, hero.y, :hero}
    else
      {0.0, 0.0, :keep}
    end
  end

  defp aggro_hero(state, monster) do
    living_heroes(state)
    |> Enum.filter(fn hero -> hypot(hero.x - monster.x, hero.y - monster.y) <= monster.aggro end)
    |> closest(fn hero -> hypot(hero.x - monster.x, hero.y - monster.y) end)
  end

  defp strike(state, %{kind: :boss} = monster, :keep, _hero) do
    damage = round(monster_damage(monster) * 1.8)
    keep = state.keep
    hp = max(keep.hp - damage, 0)

    state
    |> Map.put(:keep, %{keep | hp: hp})
    |> put_entity(%{monster | attack_cd: bite_cd(monster)})
    |> event(%{type: "slam", x: monster.x, y: monster.y, amount: damage})
    |> event(%{type: "hit", x: 0.0, y: 0.0, amount: damage})
  end

  defp strike(state, monster, :keep, _hero) do
    damage = monster_damage(monster)
    keep = state.keep
    hp = max(keep.hp - damage, 0)

    state
    |> Map.put(:keep, %{keep | hp: hp})
    |> put_entity(%{monster | attack_cd: bite_cd(monster)})
    |> event(%{type: "hit", x: 0.0, y: 0.0, amount: damage})
  end

  defp strike(state, monster, :hero, hero) do
    case state.entities[hero.id] do
      %{alive: true} = current ->
        damage = monster_damage(monster)
        damage = if current.guard > 0, do: round(damage * 0.4), else: damage
        hp = current.hp - damage

        current =
          if hp <= 0 do
            %{current | hp: 0, alive: false, respawn: respawn_ticks(state)}
          else
            %{current | hp: hp}
          end

        state
        |> put_entity(current)
        |> put_entity(%{monster | attack_cd: bite_cd(monster)})
        |> event(%{type: "hit", x: current.x, y: current.y, amount: damage})

      _ ->
        chase(state, monster, 0.0, 0.0)
    end
  end

  defp chase(state, monster, tx, ty) do
    monster = dash_elite(monster, tx, ty)
    {dx, dy} = norm(tx - monster.x, ty - monster.y)
    speed = monster.speed * slow_mult(monster) * elite_speed(monster)
    step = speed * 0.05
    nx = monster.x + dx * step
    ny = monster.y + dy * step
    opts = %{ignore: monster.id, keep_pad: -6.0}

    cond do
      not body_blocked?(state, nx, ny, monster.r, opts) ->
        put_entity(state, %{monster | x: nx, y: ny})

      not body_blocked?(state, nx, monster.y, monster.r, opts) and abs(nx - monster.x) > 0.2 ->
        put_entity(state, %{monster | x: nx})

      not body_blocked?(state, monster.x, ny, monster.r, opts) and abs(ny - monster.y) > 0.2 ->
        put_entity(state, %{monster | y: ny})

      true ->
        case sidestep(state, monster, tx, ty, dx, dy, step, opts) do
          {:ok, sx, sy} -> put_entity(state, %{monster | x: sx, y: sy})
          :blocked -> chew_wall(state, monster)
        end
    end
  end

  defp sidestep(state, monster, tx, ty, dx, dy, step, opts) do
    px = -dy
    py = dx
    current = hypot(tx - monster.x, ty - monster.y)

    closer =
      for sign <- [1.0, -1.0],
          nx = monster.x + px * sign * step,
          ny = monster.y + py * sign * step,
          not body_blocked?(state, nx, ny, monster.r, opts),
          dist = hypot(tx - nx, ty - ny),
          dist < current,
          do: {nx, ny, dist}

    case closer do
      [] ->
        :blocked

      options ->
        {nx, ny, _} = Enum.min_by(options, fn {_x, _y, dist} -> dist end)
        {:ok, nx, ny}
    end
  end

  defp chew_wall(state, monster) do
    case nearest(blockers(state), monster.x, monster.y, monster.r + 24) do
      nil ->
        state

      wall ->
        if monster.attack_cd > 0 do
          state
        else
          damage = monster_damage(monster)
          hp = wall.hp - damage

          state =
            if hp <= 0 do
              drop(state, wall.id)
            else
              put_entity(state, %{wall | hp: hp})
            end

          state
          |> refresh_upgrades()
          |> put_entity(%{state.entities[monster.id] | attack_cd: 20})
          |> event(%{type: "hit", x: wall.x, y: wall.y})
        end
    end
  end

  defp trigger_trap(state, monster) do
    case Enum.find(buildings(state), fn building ->
           building.kind == :trap and
             hypot(building.x - monster.x, building.y - monster.y) <= building.r + monster.r
         end) do
      nil ->
        state

      trap ->
        state
        |> hurt_monster(monster.id, 44, 0)
        |> drop(trap.id)
        |> event(%{type: "hit", x: trap.x, y: trap.y})
    end
  end

  defp economy(%{phase: {:build, _}} = state) do
    state
    |> field_yield()
    |> settle()
    |> regrow_trees()
  end

  defp economy(state), do: state

  defp settle(state) do
    state
    |> bank_work()
    |> stake()
    |> town_tax()
  end

  defp bank_work(state) do
    if rem(state.tick, Rules.work_every()) == 0 and farmer_present?(state) do
      bank(state, 1)
    else
      state
    end
  end

  defp bank(state, n), do: %{state | labor: min(state.labor + n, Rules.labor_cap())}

  defp farmer_present?(state), do: Enum.any?(living_heroes(state), &(&1.hero == :farmer))

  defp stake(state) do
    Enum.reduce(Rules.plots(state.town, state.labor), state, &claim/2)
  end

  defp claim(%{id: id, kind: kind, x: x, y: y}, state) do
    price = if kind == :field, do: Rules.croft_cost(), else: %{wood: 0, gold: 0}

    cond do
      MapSet.member?(state.staked, id) ->
        state

      hypot(x, y) < state.keep.r + 28 or overlap?(state, x, y, Rules.building(kind).r) ->
        state

      kind == :field and
          (field_count(state) >= build_limit(:field) or not afford?(state, price)) ->
        state

      true ->
        state
        |> pay(price)
        |> spawn_building(%{kind: kind, x: x, y: y})
        |> Map.update!(:staked, &MapSet.put(&1, id))
    end
  end

  defp town_tax(state) do
    if rem(state.tick, 120) == 0 do
      houses = Enum.count(buildings(state), &(&1.kind == :house))
      add_resource(state, :gold, div(houses, 4))
    else
      state
    end
  end

  defp field_count(state), do: Enum.count(buildings(state), &(&1.kind == :field))

  defp field_yield(state) do
    if rem(state.tick, 40) == 0 do
      fields = Enum.count(buildings(state), &(&1.kind == :field))
      farmer = Enum.any?(living_heroes(state), &(&1.hero == :farmer))
      bonus = if farmer, do: fields, else: 0
      granary = if :granary in state.relics, do: div(fields + 1, 2), else: 0
      state = add_resource(state, :food, fields + bonus + granary)
      if rem(state.tick, 120) == 0, do: add_resource(state, :gold, fields), else: state
    else
      state
    end
  end

  defp regrow_trees(state) do
    if rem(state.tick, 80) == 0 and length(trees(state)) < 26 do
      {angle, rng} = angle_of(state.rng)
      {dist, rng} = :rand.uniform_s(rng)
      x = :math.cos(angle) * (460 + dist * 280)
      y = :math.sin(angle) * (460 + dist * 280)

      insert(%{state | rng: rng}, %{type: :tree, id: state.next_id, x: x, y: y, wood: 12, r: 16.0})
    else
      state
    end
  end

  defp advance_phase(%{keep: %{hp: hp}} = state) when hp <= 0 do
    %{state | phase: :over, keep: %{state.keep | hp: 0}}
  end

  defp advance_phase(%{hold: true} = state), do: state

  defp advance_phase(%{phase: {:build, ticks}} = state) when ticks > 1 do
    %{state | phase: {:build, ticks - 1}}
  end

  defp advance_phase(%{phase: {:build, _}} = state), do: start_wave(state)

  defp advance_phase(%{phase: {:wave, ticks}} = state) do
    state = %{state | phase: {:wave, ticks - 1}}
    state = if ticks - 1 <= 0, do: enrage(state), else: state

    if monsters(state) == [] do
      clear_wave(state)
    else
      state
    end
  end

  defp advance_phase(state), do: state

  defp start_wave(state) do
    wave = state.wave + 1

    {hints, rng} =
      if state.hints == [], do: Waves.plan(wave, state.rng), else: {state.hints, state.rng}

    state = %{
      state
      | wave: wave,
        rng: rng,
        phase: {:wave, Rules.wave_ticks()},
        hints: hints,
        enraged: false
    }

    Enum.reduce(hints, state, fn group, state ->
      spawn_group(state, group, wave)
    end)
  end

  defp spawn_group(state, group, wave) do
    group
    |> wave_one_bearings(state, wave)
    |> Enum.with_index(1)
    |> Enum.reduce(state, fn {angle, i}, state ->
      dist = spawn_ring(wave, i)

      spawn_monster(state, %{
        kind: group.kind,
        x: :math.cos(angle) * dist,
        y: :math.sin(angle) * dist,
        elite: group.elite,
        wave: wave
      })
    end)
  end

  defp wave_one_bearings(group, state, wave) do
    portals = nearest_portals(state)

    cond do
      wave == 1 ->
        taken = Enum.take(portals, group.count)
        live = Enum.map(taken, &poi_angle/1)
        start = length(live) + 1

        fillers =
          if start > group.count do
            []
          else
            for i <- start..group.count do
              group.angle + (i - group.count / 2) * 0.45
            end
          end

        live ++ fillers

      portals == [] ->
        []

      true ->
        n = length(portals)

        for i <- 0..(group.count - 1) do
          poi_angle(Enum.at(portals, rem(i, n)))
        end
    end
  end

  defp nearest_portals(state) do
    Enum.sort_by(state.world.portals, fn poi ->
      {poi.x * poi.x + poi.y * poi.y, poi.id}
    end)
  end

  defp poi_angle(poi), do: :math.atan2(poi.y, poi.x)

  defp spawn_ring(wave, i), do: Rules.spawn_distance(wave, i)

  defp clear_wave(state) do
    {hints, rng} = Waves.plan(state.wave + 1, state.rng)
    state = add_resource(state, :gold, Rules.clear_purse(state.town))

    %{
      state
      | phase: {:build, Rules.build_ticks(state.wave)},
        hints: hints,
        rng: rng,
        enraged: false
    }
  end

  defp enrage(state) do
    entities =
      Map.new(state.entities, fn
        {id, %{type: :monster} = monster} -> {id, %{monster | enraged: true}}
        other -> other
      end)

    %{state | entities: entities, enraged: true}
  end

  defp remember_input(state) do
    players =
      Map.new(state.players, fn {id, player} ->
        # A tick that cannot cast must not eat the edge. The key stays down,
        # so the next tick the hero can act still sees it.
        pressed = if keeps_edge?(state, player), do: player.pressed, else: @empty_pressed
        {id, %{player | prev: player.input, pressed: pressed}}
      end)

    %{state | players: players}
  end

  defp keeps_edge?(state, player) do
    hero = state.entities[player.hero_id]
    player.connected and (hero == nil or not hero.alive)
  end

  defp hurt_monster(state, id, amount, bonus_gold) do
    case state.entities[id] do
      %{type: :monster, hp: hp} = monster ->
        marked = if monster.marked > 0, do: 1.4, else: 1.0
        amount = round(amount * armor_mult(monster) * marked)
        left = hp - amount

        if left <= 0 do
          gold = Rules.bounty(monster.kind) + bonus_gold

          state
          |> Map.update!(:kills, &(&1 + 1))
          |> add_resource(:gold, gold)
          |> drop(id)
          |> maybe_relic(monster)
          |> event(%{type: "hit", x: monster.x, y: monster.y, amount: amount})
          |> event(%{
            type: "death",
            kind: monster.kind,
            x: monster.x,
            y: monster.y,
            amount: amount
          })
        else
          state
          |> put_entity(%{monster | hp: left})
          |> event(%{type: "hit", x: monster.x, y: monster.y, amount: amount})
        end

      _ ->
        state
    end
  end

  defp maybe_relic(state, monster) do
    if relic_bearer?(monster), do: grant_relic(state), else: state
  end

  defp relic_bearer?(%{kind: :boss}), do: true
  defp relic_bearer?(%{elite: elite}) when elite in [:fast, :armored, :enraged, :boss], do: true
  defp relic_bearer?(_), do: false

  defp grant_relic(state) do
    pool = [:heartwood, :whetstone, :swiftness, :banner, :granary] -- state.relics

    case pool do
      [] ->
        state

      _ ->
        {relic, rng} = pick(state.rng, pool)
        state = %{state | relics: state.relics ++ [relic], rng: rng}
        state = if relic == :heartwood, do: grow_keep(state), else: state
        event(state, %{type: "relic", relic: relic, x: 0.0, y: 0.0})
    end
  end

  defp grow_keep(state) do
    keep = state.keep

    %{
      state
      | keep: %{keep | max_hp: keep.max_hp + 280, hp: min(keep.hp + 280, keep.max_hp + 280)}
    }
  end

  defp repair_near(state, _hero, repair) when repair <= 0, do: state

  defp repair_near(state, hero, repair) do
    case nearest(buildings(state), hero.x, hero.y, 56) do
      nil ->
        state

      building ->
        put_entity(state, %{building | hp: min(building.hp + repair, building.max_hp)})
    end
  end

  defp start_cd(state, hero, slot, base) do
    hero = state.entities[hero.id]
    cd = round(base * cd_mult(state, hero.hero, slot))
    %{hero | cooldowns: Map.put(hero.cooldowns, slot, cd)}
  end

  defp cd_mult(state, :mage, slot) when slot in [:attack, :q, :e, :r] do
    if state.upgrades.mage_tower, do: 0.85, else: 1.0
  end

  defp cd_mult(_state, _hero, _slot), do: 1.0

  defp scaled_damage(base, state, hero, _monster) do
    mult = 1.0
    mult = if state.upgrades.forge, do: mult * 1.15, else: mult
    mult = if :whetstone in state.relics, do: mult * 1.1, else: mult
    mult = if hero == :mage and state.upgrades.mage_tower, do: mult * 1.25, else: mult
    max(round(base * mult), 1)
  end

  defp armor_mult(%{elite: :armored}), do: 0.65
  defp armor_mult(_), do: 1.0

  defp monster_damage(monster) do
    mult = if monster.enraged or monster.elite == :enraged, do: 1.45, else: 1.0
    max(round(monster.damage * mult), 1)
  end

  defp slow_mult(%{slow: n}) when n > 0, do: 0.5
  defp slow_mult(_), do: 1.0

  defp elite_speed(%{elite: :fast}), do: 1.55
  defp elite_speed(%{elite: :armored}), do: 0.75
  defp elite_speed(%{enraged: true}), do: 1.2
  defp elite_speed(%{elite: :enraged}), do: 1.2
  defp elite_speed(_), do: 1.0

  defp speed_mult(state) do
    if :swiftness in state.relics, do: 1.08, else: 1.0
  end

  defp respawn_ticks(state) do
    base = if match?({:build, _}, state.phase), do: 40, else: 160
    if :banner in state.relics, do: round(base * 0.7), else: base
  end

  defp place_trees(state, count) do
    Enum.reduce(1..count, state, fn i, state ->
      angle = i * 2.399
      dist = 260 + rem(i * 53, 400)

      insert(state, %{
        type: :tree,
        id: state.next_id,
        x: :math.cos(angle) * dist,
        y: :math.sin(angle) * dist,
        wood: 12,
        r: 16.0
      })
    end)
  end

  defp refresh_upgrades(state) do
    kinds = Enum.map(buildings(state), & &1.kind)

    %{
      state
      | upgrades: %{
          forge: :forge in kinds,
          mage_tower: :mage_tower in kinds
        }
    }
  end

  defp overlap?(state, x, y, radius) do
    Enum.any?(buildings(state), fn building ->
      hypot(building.x - x, building.y - y) < building.r + radius - 6
    end)
  end

  defp slide(state, x, y, dx, dy, radius, opts) do
    nx = x + dx
    ny = y + dy

    cond do
      not body_blocked?(state, nx, ny, radius, opts) ->
        {nx, ny}

      not body_blocked?(state, nx, y, radius, opts) and abs(dx) > 0.2 ->
        {nx, y}

      not body_blocked?(state, x, ny, radius, opts) and abs(dy) > 0.2 ->
        {x, ny}

      true ->
        {x, y}
    end
  end

  defp body_blocked?(state, x, y, radius, opts) do
    ignore = Map.get(opts, :ignore)
    pass_keep = Map.get(opts, :pass_keep, false)
    pass_heroes = Map.get(opts, :pass_heroes, false)
    pass_monsters = Map.get(opts, :pass_monsters, false)
    keep_pad = Map.get(opts, :keep_pad, 0.0)

    (not pass_keep and hypot(x, y) < state.keep.r + radius + keep_pad) or
      Enum.any?(blockers(state), fn building ->
        hypot(building.x - x, building.y - y) < building.r + radius
      end) or
      (not pass_heroes and
         Enum.any?(heroes(state), fn hero ->
           hero.alive and hero.id != ignore and
             hypot(hero.x - x, hero.y - y) < hero.r + radius
         end)) or
      (not pass_monsters and
         Enum.any?(monsters(state), fn monster ->
           monster.id != ignore and hypot(monster.x - x, monster.y - y) < monster.r + radius
         end))
  end

  defp dash_to(state, hero, dx, dy, pass_monsters) do
    steps = 8
    opts = %{ignore: hero.id, pass_monsters: pass_monsters}

    {x, y} =
      Enum.reduce(1..steps, {hero.x, hero.y}, fn _, {x, y} ->
        slide(state, x, y, dx / steps, dy / steps, hero.r, opts)
      end)

    {x, y} = clamp_map(x, y, Rules.map_radius())

    if pass_monsters do
      nudge_clear(state, hero, x, y, dx, dy)
    else
      {x, y}
    end
  end

  defp nudge_clear(state, hero, x, y, dx, dy) do
    opts = %{ignore: hero.id}

    if not body_blocked?(state, x, y, hero.r, opts) do
      {x, y}
    else
      {ux, uy} = norm(dx, dy)

      Enum.reduce_while(1..16, {x, y}, fn i, acc ->
        {nx, ny} = clamp_map(x + ux * i * 10, y + uy * i * 10, Rules.map_radius())

        if body_blocked?(state, nx, ny, hero.r, opts) do
          {:cont, acc}
        else
          {:halt, {nx, ny}}
        end
      end)
    end
  end

  defp maybe_raise(state, player, hero) do
    if edged?(player, :raise), do: try_raise(state, player, hero), else: state
  end

  defp try_raise(state, _player, hero) do
    rank = state.town

    cond do
      rank >= Rules.town_rank_cap() ->
        refuse(state, hero.x, hero.y, "The keep is as high as it goes")

      hypot(hero.x, hero.y) >= Rules.raise_reach() ->
        refuse(state, hero.x, hero.y, "Walk to the keep")

      not afford?(state, Rules.keep_upgrade_cost(rank)) ->
        cost = Rules.keep_upgrade_cost(rank)

        reason =
          if state.resources.wood < cost.wood, do: "Not enough wood", else: "Not enough gold"

        refuse(state, hero.x, hero.y, reason)

      true ->
        cost = Rules.keep_upgrade_cost(rank)

        state
        |> pay(cost)
        |> Map.update!(:town, &(&1 + 1))
        |> event(%{type: "raise", x: 0.0, y: 0.0, amount: rank + 1})
        |> stake()
    end
  end

  defp clamp_map(x, y, radius) do
    dist = hypot(x, y)

    if dist > radius do
      {x / dist * radius, y / dist * radius}
    else
      {x, y}
    end
  end

  defp facing_of(hero, input, x, y) do
    dx = input.ax - x
    dy = input.ay - y

    if hypot(dx, dy) > 4 do
      :math.atan2(dy, dx)
    else
      hero.facing
    end
  end

  defp aim_dir(hero, input) do
    {dx, dy} = norm(input.ax - hero.x, input.ay - hero.y)

    if dx == 0.0 and dy == 0.0 do
      {:math.cos(hero.facing), :math.sin(hero.facing)}
    else
      {dx, dy}
    end
  end

  defp angle_between(hero, monster) do
    ang = :math.atan2(monster.y - hero.y, monster.x - hero.x)
    abs(normalize_angle(ang - hero.facing))
  end

  defp normalize_angle(angle) do
    wrapped = :math.fmod(angle + :math.pi(), 2 * :math.pi())
    wrapped = if wrapped < 0, do: wrapped + 2 * :math.pi(), else: wrapped
    wrapped - :math.pi()
  end

  defp refuse(state, x, y, reason), do: event(state, %{type: "deny", x: x, y: y, reason: reason})

  defp bite_cd(%{elite: :enraged}), do: 12
  defp bite_cd(%{kind: :boss}), do: 28
  defp bite_cd(_monster), do: 20

  defp dash_elite(%{elite: :fast, special: cd} = monster, tx, ty) when cd <= 0 do
    {dx, dy} = norm(tx - monster.x, ty - monster.y)
    %{monster | x: monster.x + dx * 30, y: monster.y + dy * 30, special: 20}
  end

  defp dash_elite(monster, _tx, _ty) do
    %{monster | special: max(Map.get(monster, :special, 0) - 1, 0)}
  end

  defp rising?(player, key), do: Map.get(player.input, key) && not Map.get(player.prev, key)

  # A tap can arrive and leave before the next tick. The edge sticks until that tick.
  defp rise(was, now), do: now and not was

  defp edged?(player, key), do: Map.get(player.pressed, key) or rising?(player, key)

  defp afford?(state, cost) do
    state.resources.wood >= Map.get(cost, :wood, 0) and
      state.resources.gold >= Map.get(cost, :gold, 0) and
      state.resources.food >= Map.get(cost, :food, 0) and
      state.resources.stone >= Map.get(cost, :stone, 0)
  end

  defp pay(state, cost) do
    resources =
      state.resources
      |> Map.update!(:wood, &(&1 - Map.get(cost, :wood, 0)))
      |> Map.update!(:gold, &(&1 - Map.get(cost, :gold, 0)))
      |> Map.update!(:food, &(&1 - Map.get(cost, :food, 0)))
      |> Map.update!(:stone, &(&1 - Map.get(cost, :stone, 0)))

    %{state | resources: resources}
  end

  defp add_resource(state, key, amount) do
    resources = Map.update!(state.resources, key, &min(&1 + amount, Rules.cap(key)))
    %{state | resources: resources}
  end

  defp parse_input(payload) do
    %{
      mx: clamp_axis(field(payload, :mx)),
      my: clamp_axis(field(payload, :my)),
      ax: clamp_world(field(payload, :ax)),
      ay: clamp_world(field(payload, :ay)),
      attack: truthy(field(payload, :attack)),
      q: truthy(field(payload, :q)),
      e: truthy(field(payload, :e)),
      r: truthy(field(payload, :r)),
      f: truthy(field(payload, :f)),
      place: truthy(field(payload, :place)),
      raise: truthy(field(payload, :raise)),
      build: parse_build(field(payload, :build))
    }
  end

  defp field(map, key) do
    Map.get(map, key, Map.get(map, Atom.to_string(key)))
  end

  defp parse_build(kind) when kind in [:wall, :tower, :trap, :field, :forge, :mage_tower],
    do: kind

  defp parse_build(kind) when is_binary(kind) do
    case kind do
      "wall" -> :wall
      "tower" -> :tower
      "trap" -> :trap
      "field" -> :field
      "forge" -> :forge
      "mage_tower" -> :mage_tower
      _ -> nil
    end
  end

  defp parse_build(_), do: nil

  defp truthy(true), do: true
  defp truthy("true"), do: true
  defp truthy(1), do: true
  defp truthy(_), do: false

  defp clamp_axis(value) when is_number(value),
    do: value |> max(-1.0) |> min(1.0) |> Kernel.*(1.0)

  defp clamp_axis(_), do: 0.0

  defp clamp_world(value) when is_number(value) do
    radius = Rules.map_radius() * 1.0
    value |> max(-radius) |> min(radius) |> Kernel.*(1.0)
  end

  defp clamp_world(_), do: 0.0

  defp num(value) when is_number(value), do: value * 1.0
  defp num(_), do: 0.0

  defp snap(value), do: Float.round(value / 36.0) * 36.0

  defp insert(state, entity) do
    %{
      state
      | next_id: state.next_id + 1,
        entities: Map.put(state.entities, entity.id, entity)
    }
  end

  defp put_entity(state, entity),
    do: %{state | entities: Map.put(state.entities, entity.id, entity)}

  defp put_player(state, player),
    do: %{state | players: Map.put(state.players, player.id, player)}

  defp drop(state, id), do: %{state | entities: Map.delete(state.entities, id)}

  defp event(state, ev) do
    %{state | events: Enum.take([ev | state.events], 24)}
  end

  defp heroes(state), do: for({_id, %{type: :hero} = hero} <- state.entities, do: hero)

  defp living_heroes(state) do
    Enum.filter(heroes(state), fn hero ->
      player = state.players[hero.player_id]
      (hero.alive and player) && player.connected
    end)
  end

  def monsters(%State{} = state),
    do: for({_id, %{type: :monster} = monster} <- state.entities, do: monster)

  defp buildings(state),
    do: for({_id, %{type: :building} = building} <- state.entities, do: building)

  defp blockers(state) do
    Enum.filter(buildings(state), fn building ->
      building.kind not in [:field, :trap, :house]
    end)
  end

  defp trees(state), do: for({_id, %{type: :tree} = tree} <- state.entities, do: tree)

  defp nearest(list, x, y, max_dist) do
    list
    |> Enum.filter(fn item ->
      hypot(item.x - x, item.y - y) <= max_dist + Map.get(item, :r, 0)
    end)
    |> closest(fn item -> hypot(item.x - x, item.y - y) end)
  end

  defp closest([], _fun), do: nil
  defp closest(list, fun), do: Enum.min_by(list, fun)

  defp hypot(x, y), do: :math.sqrt(x * x + y * y)

  defp norm(x, y) do
    length = hypot(x, y)
    if length < 1.0e-6, do: {0.0, 0.0}, else: {x / length, y / length}
  end

  defp angle_of(rng) do
    {u, rng} = :rand.uniform_s(rng)
    {u * 2 * :math.pi(), rng}
  end

  defp pick(rng, list) do
    {index, rng} = :rand.uniform_s(length(list), rng)
    {Enum.at(list, index - 1), rng}
  end
end
