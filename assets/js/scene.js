// theme.jpg medians. Sky is the blue-violet dusk at 24,0. Ground is the moss at 648,408.
// The yard and the gallery both use these. Do not fill the sky with a brick.
export const skyColor = 0x4e4651
export const groundColor = 0x374115
export const pathColor = 0x5e4529
export const plazaColor = groundColor
export const ringColor = 0x4b3c33

// Daylight stays near the material color. The old sun (amber at 2.6, plus a warm
// ambient past 1) clipped every grey to orange, so plate and stone read as brown.
export const yardLight = {
  sky: 0xc8c6c2,
  ground: 0x374115,
  hemisphere: 0.38,
  ambient: 0xd8d4cc,
  ambientLevel: 0.4,
  sun: 0xfff3e4,
  sunLevel: 0.52
}

// The build is day. The last eight seconds of the build are dusk. A wave is night.
// Day stays on yardLight so grey plate is not clipped. Night is the darkest.
export const cycleLight = {
  day: { ...yardLight, background: skyColor },
  dusk: {
    sky: 0x8a7060,
    ground: 0x2a3818,
    hemisphere: 0.32,
    ambient: 0xb09078,
    ambientLevel: 0.34,
    sun: 0xf0b080,
    sunLevel: 0.4,
    background: 0x3e3844
  },
  night: {
    sky: 0x6a6478,
    ground: 0x24301c,
    hemisphere: 0.28,
    ambient: 0x8a8494,
    ambientLevel: 0.36,
    sun: 0xc0b0a0,
    sunLevel: 0.3,
    background: 0x322e3a
  }
}

export function lightName(snap) {
  if (!snap) return "day"
  if (snap.phase === "wave" || snap.phase === "over" || snap.enraged) return "night"
  if (snap.hold) return "day"
  if (snap.phase === "build") {
    const ms = Number(snap.phase_ms)
    if (Number.isFinite(ms) && ms > 0 && ms <= 8000) return "dusk"
    return "day"
  }
  return "day"
}

export function lightLevel(name) {
  const rig = cycleLight[name] || cycleLight.day
  return rig.hemisphere + rig.ambientLevel + rig.sunLevel
}
