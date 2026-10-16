defmodule LastKeep.Game.State do
  @moduledoc false

  defstruct [
    :code,
    :rng,
    tick: 0,
    phase: {:build, 800},
    wave: 0,
    keep: %{hp: 900, max_hp: 900, r: 54.0},
    resources: %{wood: 48, food: 8, gold: 0},
    players: %{},
    entities: %{},
    next_id: 1,
    hints: [],
    relics: [],
    upgrades: %{forge: false, mage_tower: false},
    kills: 0,
    events: [],
    enraged: false
  ]
end
