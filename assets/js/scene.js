// theme.jpg medians. Sky is the blue-violet dusk at 24,0. Ground is the moss at 648,408.
// The yard and the gallery both use these. Do not fill the sky with a brick.
export const skyColor = 0x4e4651
export const groundColor = 0x374115
export const pathColor = 0x5e4529
export const plazaColor = groundColor
export const ringColor = 0x654e41

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
