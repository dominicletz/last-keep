// Startup and frame-rate probe for the five numbers in docs/PERF.md.
//   BASE=http://127.0.0.1:4000 node script/perf_probe.cjs [runs]
// Runs headless Chromium on SwiftShader at 1280x800, loads /?hooks=0 (no test
// hooks, as a player sees it), creates a keep and measures:
//   freezeMs      longest main-thread task before the first menu frame
//   longTotalMs   all long tasks before the first menu frame
//   menuFrameMs   navigation start to the first menu frame
//   confirmMs     Create click to the first painted world frame
//   createMs      POST /api/rooms, median of 5 direct requests
//   idleFps       painted frames per second, standing still for 4 s
//   walkFps       painted frames per second, walking for 2 s
//   hudMsPerSec   time inside getBoundingClientRect/getComputedStyle per second, idle
//   hudReadsPerSec  number of those reads per second, idle
// Prints one JSON line per run and a median line.
const { chromium } = require("playwright")

const BASE = process.env.BASE || "http://127.0.0.1:4000"
const runs = Number(process.argv[2] || 3)
const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null
}

function hook() {
  const now = () => performance.timeOrigin + performance.now()
  const S = (window.__pp = { marks: {}, long: [], paints: [], rafs: 0, reads: 0, readMs: 0 })
  const mark = (k) => { if (!(k in S.marks)) S.marks[k] = now() }
  S.mark = mark
  let drew = false
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const f = C.prototype[name]
      if (!f) continue
      C.prototype[name] = function (...a) { drew = true; return f.apply(this, a) }
    }
  }
  const loop = () => {
    S.rafs += 1
    if (drew) {
      S.paints.push(now())
      const lk = window.__lastKeep
      if (location.pathname === "/") mark("firstMenuFrame")
      if (location.pathname.startsWith("/r/") && (lk ? lk.tick != null : performance.getEntriesByName("lastkeep:firstWorldFrame").length)) mark("firstWorldFrame")
    }
    drew = false
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  new PerformanceObserver((l) => { for (const e of l.getEntries()) S.long.push({ start: performance.timeOrigin + e.startTime, dur: e.duration }) }).observe({ type: "longtask", buffered: true })
  const wrap = (proto, name) => {
    const f = proto[name]
    proto[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a) } finally { S.readMs += performance.now() - t; S.reads += 1 } }
  }
  wrap(Element.prototype, "getBoundingClientRect")
  wrap(window, "getComputedStyle")
}

async function createMs() {
  const times = []
  for (let i = 0; i < 5; i++) {
    const t = Date.now()
    const res = await fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `probe${i}`, hero: "warrior", token: `probe${Date.now()}${i}` })
    })
    await res.text()
    if (res.ok) times.push(Date.now() - t)
  }
  return median(times)
}

async function once(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(hook)
  const page = await context.newPage()
  const nav = Date.now()
  await page.goto(`${BASE}/?hooks=0`, { waitUntil: "load", timeout: 90000 })
  await page.waitForFunction(() => window.__pp.marks.firstMenuFrame, null, { timeout: 90000 })
  await page.waitForTimeout(2500)
  const menu = await page.evaluate(() => {
    const S = window.__pp
    const t0 = performance.timeOrigin
    const before = S.long.filter((l) => l.start < S.marks.firstMenuFrame)
    return {
      menuFrameMs: S.marks.firstMenuFrame - t0,
      freezeMs: Math.max(0, ...before.map((l) => l.dur)),
      longTotalMs: before.reduce((a, l) => a + l.dur, 0)
    }
  })
  await page.fill("#player-name", "perfprobe")
  const clickAt = await page.evaluate(() => performance.timeOrigin + performance.now())
  await Promise.all([page.waitForURL(/\/r\//, { timeout: 60000 }), page.click("#start-button")])
  await page.waitForFunction(() => window.__pp && window.__pp.marks.firstWorldFrame, null, { timeout: 120000 })
  // A reload starts a new document, so its probe has no click time.
  const world = await page.evaluate((at) => window.__pp.marks.firstWorldFrame - at, clickAt)
  await page.waitForTimeout(3000)
  const span = async (ms) => {
    const a = await page.evaluate(() => ({ p: window.__pp.paints.length, f: window.__pp.rafs, r: window.__pp.reads, m: window.__pp.readMs }))
    await page.waitForTimeout(ms)
    const z = await page.evaluate(() => ({ p: window.__pp.paints.length, f: window.__pp.rafs, r: window.__pp.reads, m: window.__pp.readMs }))
    const s = ms / 1000
    return { fps: (z.p - a.p) / s, rafs: (z.f - a.f) / s, reads: (z.r - a.r) / s, readMs: (z.m - a.m) / s }
  }
  const idle = await span(4000)
  await page.keyboard.down("KeyW")
  await page.waitForTimeout(300)
  const walk = await span(2000)
  await page.keyboard.up("KeyW")
  await context.close()
  return {
    ...Object.fromEntries(Object.entries(menu).map(([k, v]) => [k, +v.toFixed(1)])),
    confirmMs: +world.toFixed(1),
    idleFps: +idle.fps.toFixed(1),
    walkFps: +walk.fps.toFixed(1),
    rafFps: +walk.rafs.toFixed(1),
    hudMsPerSec: +idle.readMs.toFixed(1),
    hudReadsPerSec: +idle.reads.toFixed(1),
    walkHudMsPerSec: +walk.readMs.toFixed(1)
  }
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
  })
  const rows = []
  for (let i = 0; i < runs; i++) {
    const row = await once(browser)
    console.log(JSON.stringify(row))
    rows.push(row)
  }
  await browser.close()
  const out = { base: BASE, runs }
  for (const key of Object.keys(rows[0])) out[key] = median(rows.map((r) => r[key]))
  out.createMs = await createMs()
  console.log("median " + JSON.stringify(out))
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
