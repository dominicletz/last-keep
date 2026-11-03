import { viewScale } from "./town.js"

// CSS pixels per internal texel. Two keeps the nearest-neighbor chunk and
// lifts a hero at rank 4 over the 56px floor. Three left the engineer near 22.
export const pixelSize = 2

// The buffer uses the window's aspect so a CSS fill does not stretch pixels.
// The frustum uses that same aspect. A narrow window grows the vertical view
// until the yard still fits across the width, so the keep stays in frame.
// A higher town rank scales that frustum so the camera pulls back.
export function frameFor(cssWidth, cssHeight, rank = 0) {
  const cssW = Math.max(1, Number(cssWidth) || 1)
  const cssH = Math.max(1, Number(cssHeight) || 1)
  const pixel = pixelSize
  const bufferWidth = Math.max(160, Math.round(cssW / pixel))
  const bufferHeight = Math.max(160, Math.round(cssH / pixel))
  const aspect = bufferWidth / bufferHeight
  const scale = viewScale(rank)
  const minHalfW = 180 * scale
  let halfH = 168 * scale
  let halfW = halfH * aspect
  if (halfW < minHalfW) {
    halfW = minHalfW
    halfH = halfW / aspect
  }
  return {
    bufferWidth,
    bufferHeight,
    aspect,
    halfW,
    halfH,
    left: -halfW,
    right: halfW,
    top: halfH,
    bottom: -halfH
  }
}

// Follow most of the way out. 0.22 left a hero on the spawn ring standing on
// a bat outside the frame. Following all the way hides a goblin on the far
// side of the keep from a hero who is still on the join ring.
export const cameraFollow = 0.72

// The third join-ring seat stands behind the host. A look point on the ground
// leaves that hero above the frame. 32 puts the tallest mesh, the mage, inside
// the picture. A lower look was only quieter on one grass corner. That corner
// is not the picture, and the camera stays at this height.
export const cameraLift = 32

// A headless page stays "visible", so a draw inside the socket handler never
// yields and the test's wait sits until the browser is closed. Recent input
// draws with the tick. An idle page coasts.
export const activeDrawMs = 50
export const idleDrawMs = 250
export const inputWindowMs = 1500
// A paint that runs longer than this fills the frame, so the next one would
// start immediately and the blend poll would never see the 45ms window.
export const slowPaintMs = 40
export const slowPaintGapMs = 70

export function paintGap(submitMs) {
  return Number(submitMs) > slowPaintMs ? slowPaintGapMs : 0
}

export function drawDue(now, lastRender, lastInput) {
  const gap = now - lastInput < inputWindowMs ? activeDrawMs : idleDrawMs
  return now - lastRender >= gap
}

export function cameraFocus(x, y) {
  const hx = Number(x) || 0
  const hy = Number(y) || 0
  return { x: hx * cameraFollow, z: hy * cameraFollow }
}

// Test hooks are the window.__lastKeep record, the per-frame geometry census,
// and the drawDue pacing above. A real player gets none of them: the record
// was rebuilt on every draw and the census walked the scene every frame.
// ?hooks=1 or ?hooks=0 wins. Otherwise a WebDriver session (Playwright) gets
// the hooks and a person does not.
export function hooksWanted(search, nav) {
  const match = /[?&]hooks=([01])(?:&|$)/.exec(search || "")
  if (match) return match[1] === "1"
  return !!(nav && nav.webdriver)
}

export const testHooks =
  typeof window !== "undefined" && typeof navigator !== "undefined" ? hooksWanted(window.location.search, navigator) : false

// Without hooks the page paints whenever the picture changed, at the display
// rate, and not at all while nothing moves. A texture that finishes loading
// changes nothing the signature sees, so an idle page still repaints once a
// second.
export const keepAliveMs = 1000

export function snapshotDue(hooks, now, lastRender, lastInput) {
  return hooks ? drawDue(now, lastRender, lastInput) : true
}

// A held view paints nothing. The home page holds its menu while Create waits
// on the server: a software-GL paint costs a few hundred ms of CPU, and on a
// small machine that CPU is the one laying out the new room's world.
export function paintDue(hooks, now, lastRender, lastInput, changed, held = false) {
  if (held) return false
  if (hooks) return drawDue(now, lastRender, lastInput)
  return !!changed || now - lastRender >= keepAliveMs
}

// One number for everything a paint would show: the camera and each actor's
// place, facing, visibility, sheet cell, and fade. Two equal signatures paint
// the same frame.
export function frameSignature(camera, meshes) {
  let hash = 17
  const mix = (value) => {
    hash = (Math.imul(hash, 31) + Math.round((Number(value) || 0) * 64)) | 0
  }
  if (camera) {
    mix(camera.position.x)
    mix(camera.position.y)
    mix(camera.position.z)
    mix(camera.quaternion.x * 1000)
    mix(camera.quaternion.y * 1000)
    mix(camera.quaternion.z * 1000)
    mix(camera.quaternion.w * 1000)
    mix(camera.fov * 100)
    mix(camera.near * 100)
  }
  let count = 0
  for (const mesh of meshes) {
    count += 1
    mix(mesh.position.x)
    mix(mesh.position.y)
    mix(mesh.position.z)
    mix(mesh.rotation.y * 1000)
    mix(mesh.scale.x * 100)
    mix(mesh.scale.y * 100)
    mix(mesh.visible ? 1 : 2)
    const card = mesh.userData && mesh.userData.card
    if (card && card.material) {
      if (card.material.map) {
        mix(card.material.map.offset.x * 1000)
        mix(card.material.map.offset.y * 1000)
      }
      mix(card.material.opacity * 100)
    }
    const rim = mesh.userData && mesh.userData.rim
    if (rim) {
      mix(rim.position.x)
      mix(rim.position.y)
      mix(rim.position.z)
      mix(rim.visible ? 1 : 2)
    }
    const hp = mesh.userData && mesh.userData.hp
    if (hp) mix(hp.scale.x * 100)
  }
  mix(count)
  return hash
}

// Snapshot fields that change every tick without changing the canvas: the
// tick, the phase countdown, cooldowns, and the score line are HUD text, and
// events become bursts the frame signature already sees.
const TICKING = new Set(["tick", "phase_ms", "cds", "events", "score", "kills", "waves_survived"])

// A draw repaints only when this key moved. Two snapshots with equal keys
// differ in nothing the scene shows; actors that move change the signature.
export function sceneKey(snap) {
  return JSON.stringify(snap, (key, value) => (TICKING.has(key) ? undefined : value))
}

// The build ghost and the range ring as one string: equal strings paint the
// same ghost.
export function ghostLook(kind, x, z, ok, bearer) {
  if (!kind) return "none"
  const b = bearer || {}
  return [kind, x, z, ok ? 1 : 0, b.x, b.z, b.range].join(",")
}
