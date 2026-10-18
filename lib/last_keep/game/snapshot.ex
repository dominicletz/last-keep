defmodule LastKeep.Game.Snapshot do
  @moduledoc false

  alias LastKeep.Game.Rules
  alias LastKeep.Game.Sim
  alias LastKeep.Game.State

  def render(%State{} = state) do
    %{
      tick: state.tick,
      phase: phase_name(state.phase),
      phase_ms: phase_ms(state.phase),
      enraged: state.enraged,
      hold: state.hold,
      wave: state.wave,
      shown_wave: shown_wave(state),
      keep: %{hp: state.keep.hp, max: state.keep.max_hp, r: state.keep.r},
      town: state.town,
      camera: Rules.camera_distance(state.town),
      dirt: Rules.dirt_radius(state.town),
      view_scale: Rules.view_scale(state.town),
      upgrade: upgrade_offer(state),
      resources: state.resources,
      kills: state.kills,
      score: Sim.score(state),
      waves_survived: Sim.waves_survived(state),
      hints: if(reveal?(state), do: Enum.map(state.hints, &hint/1), else: []),
      relics: Enum.map(state.relics, &Atom.to_string/1),
      forge: state.upgrades.forge,
      mage_tower: state.upgrades.mage_tower,
      players: Enum.map(state.players, &player(&1, state)),
      monsters: Enum.map(Sim.monsters(state), &monster/1),
      projectiles: projectiles(state),
      buildings: Enum.map(of_type(state, :building), &building/1),
      trees: Enum.map(of_type(state, :tree), &tree/1),
      chests: Enum.map(state.world.chests, &chest_view/1),
      portals: Enum.map(state.world.portals, &portal_view/1),
      events: Enum.map(Enum.reverse(state.events), &event/1)
    }
  end

  defp reveal?(state) do
    phase_ms(state.phase) < 5_000 or scout_alive?(state)
  end

  defp scout_alive?(state) do
    Enum.any?(state.players, fn {_id, player} ->
      hero = state.entities[player.hero_id]
      player.hero == :scout and player.connected and hero.alive
    end)
  end

  defp player({_id, player}, state) do
    hero = state.entities[player.hero_id]
    kit = Rules.kit(player.hero)

    %{
      id: player.public_id,
      name: player.name,
      hero: Atom.to_string(player.hero),
      connected: player.connected,
      x: round1(hero.x),
      y: round1(hero.y),
      facing: round1(hero.facing),
      hp: hero.hp,
      max: hero.max_hp,
      alive: hero.alive,
      host: player.public_id == "p1",
      range: Rules.build_range(player.hero, state.town),
      costs: costs(player.hero),
      cds: %{
        attack: hero.cooldowns.attack * Rules.tick_ms(),
        q: hero.cooldowns.q * Rules.tick_ms(),
        e: hero.cooldowns.e * Rules.tick_ms(),
        r: hero.cooldowns.r * Rules.tick_ms()
      },
      cd_max: %{
        attack: kit.attack.cd * Rules.tick_ms(),
        q: kit.q.cd * Rules.tick_ms(),
        e: kit.e.cd * Rules.tick_ms(),
        r: kit.r.cd * Rules.tick_ms()
      }
    }
  end

  defp upgrade_offer(%State{town: town}) do
    if town >= Rules.town_rank_cap() do
      nil
    else
      cost = Rules.keep_upgrade_cost(town)
      %{rank: town + 1, wood: cost.wood, gold: cost.gold}
    end
  end

  defp costs(hero) do
    Map.new([:wall, :tower, :trap, :field, :forge, :mage_tower], fn kind ->
      cost = Rules.cost(kind, hero)

      {Atom.to_string(kind), %{wood: Map.get(cost, :wood, 0), gold: Map.get(cost, :gold, 0)}}
    end)
  end

  defp monster(monster) do
    %{
      id: monster.id,
      kind: Atom.to_string(monster.kind),
      x: round1(monster.x),
      y: round1(monster.y),
      hp: monster.hp,
      max: monster.max_hp,
      r: monster.r,
      elite: elite(monster.elite),
      enraged: monster.enraged,
      attack_cd: monster.attack_cd * Rules.tick_ms()
    }
  end

  defp building(building) do
    %{
      id: building.id,
      kind: Atom.to_string(building.kind),
      x: round1(building.x),
      y: round1(building.y),
      hp: building.hp,
      max: building.max_hp,
      r: building.r
    }
  end

  defp tree(tree) do
    %{id: tree.id, x: round1(tree.x), y: round1(tree.y), wood: tree.wood}
  end

  defp chest_view(chest) do
    %{id: chest.id, x: round1(chest.x), y: round1(chest.y), gold: chest.gold}
  end

  defp portal_view(portal) do
    %{
      id: portal.id,
      x: round1(portal.x),
      y: round1(portal.y),
      hp: portal.hp,
      max: portal.max_hp
    }
  end

  defp projectiles(state) do
    state.entities
    |> Enum.filter(fn {_id, entity} -> entity.type == :projectile end)
    |> Enum.map(fn {_id, projectile} ->
      %{
        id: projectile.id,
        kind: Atom.to_string(projectile.kind),
        x: round1(projectile.x),
        y: round1(projectile.y)
      }
    end)
  end

  defp hint(group) do
    %{
      angle: round1(group.angle),
      kind: Atom.to_string(group.kind),
      count: group.count
    }
  end

  defp event(ev) do
    ev
    |> Enum.map(fn
      {:kind, value} when is_atom(value) -> {:kind, Atom.to_string(value)}
      {:relic, value} when is_atom(value) -> {:relic, Atom.to_string(value)}
      {:type, value} when is_atom(value) -> {:type, Atom.to_string(value)}
      {:x, value} -> {:x, round1(value)}
      {:y, value} -> {:y, round1(value)}
      pair -> pair
    end)
    |> Map.new()
  end

  defp elite(nil), do: nil
  defp elite(value), do: Atom.to_string(value)

  defp shown_wave(%State{phase: {:wave, _}, wave: wave}), do: max(wave, 1)
  defp shown_wave(%State{phase: :over, wave: wave}), do: max(wave, 1)
  defp shown_wave(%State{wave: wave}), do: wave + 1

  defp phase_name({:build, _}), do: "build"
  defp phase_name({:wave, _}), do: "wave"
  defp phase_name(:over), do: "over"

  defp phase_ms({:build, ticks}), do: ticks * Rules.tick_ms()
  defp phase_ms({:wave, ticks}), do: ticks * Rules.tick_ms()
  defp phase_ms(:over), do: 0

  defp of_type(state, type) do
    for {_id, %{type: ^type} = entity} <- state.entities, do: entity
  end

  defp round1(value) when is_float(value), do: Float.round(value, 1)
  defp round1(value), do: value
end
