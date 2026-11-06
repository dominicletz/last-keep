export function stepClass(index, delta, count) {
  const size = count || 1
  return (index + delta + size * 8) % size
}

export function classFromKey(key, typing) {
  if (typing) return 0
  if (key === "ArrowRight" || key === "KeyD") return 1
  if (key === "ArrowLeft" || key === "KeyA") return -1
  return 0
}

export function menuEnv(env) {
  const source = env || {}
  return {
    hardwareConcurrency: 2,
    deviceMemory: 1,
    saveData: false,
    maxTouchPoints: source.maxTouchPoints || 0,
    coarse: !!source.coarse,
    width: source.width || 1280,
    height: source.height || 800
  }
}

export function acceptWord(mode) {
  return mode === "create" ? "Create" : "Join"
}
