export const NON_DIEGETIC = [
  "wave",
  "clock",
  "score",
  "next",
  "build-reason",
  "start",
  "forge",
  "spire",
  "relics",
  "stock",
  "raise",
  "copy",
  "mute",
  "volume",
  "hp",
  "keep",
  "skill-attack",
  "skill-q",
  "skill-e",
  "skill-r",
  "build-wall",
  "build-tower",
  "build-trap",
  "build-field",
  "build-forge",
  "build-mage_tower",
  "roster",
  "fallen"
]

export const LIVE_NON_DIEGETIC = NON_DIEGETIC.filter((name) => name !== "fallen")

export function extraSlots(found, allowed = NON_DIEGETIC) {
  return (found || []).filter((name) => !allowed.includes(name))
}
