defmodule LastKeep.Game.Rules do
  @moduledoc false

  @tick_ms 50
  @max_players 15
  @heroes [:warrior, :mage, :scout, :farmer, :engineer]

  def tick_ms, do: @tick_ms
  def max_players, do: @max_players
  def heroes, do: @heroes
  def first_build_ticks, do: 800
  def wave_ticks, do: 1_200

  def build_ticks(cleared_wave) when cleared_wave <= 1, do: 700
  def build_ticks(cleared_wave), do: max(500, 700 - cleared_wave * 15)

  def hero?(hero), do: hero in @heroes

  def kit(:warrior) do
    %{
      hp: 150,
      speed: 155,
      range: 165,
      chop: 12,
      attack: %{kind: :melee, range: 54, arc: 1.3, damage: 26, cd: 8},
      q: %{kind: :dash, dist: 150, damage: 22, radius: 40, cd: 110},
      e: %{kind: :guard, ticks: 70, cd: 200},
      r: %{kind: :nova, radius: 96, damage: 48, cd: 340}
    }
  end

  def kit(:mage) do
    %{
      hp: 90,
      speed: 142,
      range: 175,
      chop: 20,
      attack: %{kind: :bolt, speed: 480, damage: 16, radius: 8, life: 36, cd: 10},
      q: %{kind: :fireball, speed: 300, damage: 30, radius: 10, aoe: 84, life: 40, cd: 130},
      e: %{kind: :frost, radius: 110, ticks: 80, cd: 170},
      r: %{kind: :meteor, damage: 74, aoe: 120, life: 16, cd: 400}
    }
  end

  def kit(:scout) do
    %{
      hp: 100,
      speed: 200,
      range: 185,
      chop: 20,
      attack: %{kind: :bolt, speed: 640, damage: 11, radius: 6, life: 28, cd: 5},
      q: %{kind: :dash, dist: 180, damage: 0, radius: 0, cd: 80},
      e: %{kind: :mark, range: 300, arc: 0.7, ticks: 90, cd: 150},
      r: %{kind: :volley, speed: 600, damage: 10, count: 5, life: 28, cd: 280}
    }
  end

  def kit(:farmer) do
    %{
      hp: 120,
      speed: 148,
      range: 170,
      chop: 18,
      attack: %{kind: :melee, range: 48, arc: 1.1, damage: 15, cd: 10},
      q: %{kind: :sow, cd: 24},
      e: %{kind: :harvest, radius: 230, food: 4, cd: 150},
      r: %{kind: :feast, food: 10, heal: 8, cd: 360}
    }
  end

  def kit(:engineer) do
    %{
      hp: 125,
      speed: 142,
      range: 185,
      chop: 12,
      attack: %{kind: :melee, range: 46, arc: 1.15, damage: 16, repair: 14, cd: 9},
      q: %{kind: :wall, cd: 8},
      e: %{kind: :trap, cd: 10},
      r: %{kind: :barricade, cd: 240}
    }
  end

  def monster(:goblin), do: %{hp: 30, speed: 82, damage: 8, r: 12, aggro: 160}
  def monster(:skeleton), do: %{hp: 46, speed: 64, damage: 10, r: 13, aggro: 140}
  def monster(:wolf), do: %{hp: 34, speed: 118, damage: 9, r: 13, aggro: 240}
  def monster(:troll), do: %{hp: 180, speed: 50, damage: 20, r: 22, aggro: 100}
  def monster(:boss), do: %{hp: 980, speed: 44, damage: 30, r: 34, aggro: 130}

  def hp_scale(wave), do: 1 + 0.14 * (wave - 1)
  def dmg_scale(wave), do: 1 + 0.08 * (wave - 1)

  def bounty(:goblin), do: 1
  def bounty(:skeleton), do: 1
  def bounty(:wolf), do: 2
  def bounty(:troll), do: 5
  def bounty(:boss), do: 20

  def kill_bonus(:warrior), do: 1
  def kill_bonus(_), do: 0

  def building(:wall), do: %{hp: 170, r: 16}
  def building(:tower), do: %{hp: 100, r: 16}
  def building(:trap), do: %{hp: 1, r: 15}
  def building(:field), do: %{hp: 50, r: 16}
  def building(:forge), do: %{hp: 150, r: 18}
  def building(:mage_tower), do: %{hp: 130, r: 18}

  def cost(:wall, :engineer), do: %{wood: 4, gold: 0}
  def cost(:wall, _), do: %{wood: 8, gold: 0}
  def cost(:tower, :engineer), do: %{wood: 14, gold: 4}
  def cost(:tower, _), do: %{wood: 24, gold: 8}
  def cost(:trap, :engineer), do: %{wood: 6, gold: 0}
  def cost(:trap, _), do: %{wood: 12, gold: 0}
  def cost(:field, :farmer), do: %{wood: 1, gold: 0}
  def cost(:field, _), do: %{wood: 4, gold: 0}
  def cost(:forge, _), do: %{wood: 30, gold: 14}
  def cost(:mage_tower, _), do: %{wood: 30, gold: 14}

  def barricade_cost(:engineer), do: %{wood: 10, gold: 0}
  def barricade_cost(_), do: %{wood: 22, gold: 0}

  def cap(:wood), do: 500
  def cap(:food), do: 250
  def cap(:gold), do: 250

  @builds [:wall, :tower, :trap, :field, :forge, :mage_tower]
  def build?(kind), do: kind in @builds
  def builds, do: @builds
end
