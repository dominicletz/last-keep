// High, phone, and low keep the same picture. They only spend less on the
// extras that dominate a frame: the shadow map, bloom, and depth of field.

export const TIER_EXTRAS = {
  high: { shadow: 512, bloom: true, dof: true },
  phone: { shadow: 256, bloom: true, dof: false },
  low: { shadow: 128, bloom: false, dof: false }
}

export function tierFor(env) {
  const device = env || {}
  const cores = device.hardwareConcurrency ?? 8
  const memory = device.deviceMemory ?? 8
  const width = device.width || 1280
  const height = device.height || 800
  const touch = (device.maxTouchPoints || 0) > 0 || !!device.coarse
  if (device.saveData || cores <= 2 || memory <= 2) return "low"
  if (touch && Math.min(width, height) <= 500) return "phone"
  return "high"
}

export function tierExtras(name) {
  return TIER_EXTRAS[name] || TIER_EXTRAS.high
}
