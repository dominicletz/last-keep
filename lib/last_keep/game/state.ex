defmodule LastKeep.Game.State do
  @moduledoc false

  defstruct [
    :code,
    :rng,
    tick: 0,
    phase: {:build, 120},
    hold: true,
    wave: 0,
    keep: %{hp: 900, max_hp: 900, r: 54.0},
    town: 0,
    resources: %{wood: 48, food: 8, gold: 0, stone: 0},
    staked: MapSet.new(),
    labor: 0,
    players: %{},
    entities: %{},
    next_id: 1,
    hints: [],
    relics: [],
    upgrades: %{forge: false, mage_tower: false},
    kills: 0,
    events: [],
    # Events at the head of `events` that no tick has broadcast yet. Ping and
    # fortify append between ticks; bump keeps this many across the clear.
    unsent: 0,
    enraged: false,
    world: %{
      seed: 0,
      discovered: MapSet.new(),
      claimed: MapSet.new(),
      cut: %{},
      portals: [],
      chests: [],
      camps: [],
      quarries: [],
      shrines: [],
      merchant: nil,
      hermit: nil
    }
  ]
end
