const { test, expect } = require("@playwright/test")
const { createHost } = require("./scenarios")
const { iphone13FrameMs, retiredWindowMs, runnerCapMs } = require("./perf_budget")

test("one low-tier page stays inside the runner frame cap", async ({ browser }) => {
  const cap = runnerCapMs()
  expect(cap).toBeGreaterThan(iphone13FrameMs)
  expect(cap).toBeLessThan(retiredWindowMs)

  const host = await createHost(browser, "Ada", "warrior")
  const page = host.page
  await page.waitForFunction(() => (window.__lastKeep.renders || 0) > 8 && window.__lastKeepPerf)
  await page.evaluate(() => {
    window.__lastKeepPerf.paints.length = 0
  })
  await page.waitForFunction(() => (window.__lastKeepPerf.paints || []).length >= 24)
  const sample = await page.evaluate(() => ({
    tier: window.__lastKeepPerf.tier,
    paints: window.__lastKeepPerf.paints.slice()
  }))
  expect(sample.tier).toBe("low")
  const paints = sample.paints.slice().sort((a, b) => a - b)
  const p95 = paints[Math.min(paints.length - 1, Math.ceil(paints.length * 0.95) - 1)]
  expect(p95).toBeLessThanOrEqual(cap)

  // idleDrawMs is 250, so a quiet seat paints about four frames a second.
  // The second is the measurement window. The page is already painting.
  const start = await page.evaluate(() => ({
    renders: window.__lastKeep.renders,
    at: performance.now()
  }))
  await page.waitForFunction((mark) => performance.now() - mark.at >= 1000, start)
  const end = await page.evaluate(() => window.__lastKeep.renders)
  expect(end - start.renders).toBeGreaterThan(0)
  expect(end - start.renders).toBeLessThan(12)
  await host.context.close()
})

// A player's page, with no test hooks (?hooks=0). It used to freeze for about
// 1.7 s building monster art before the first menu frame, reload on Create,
// paint at 4 fps through the drawDue throttle whatever moved, and read HUD
// layout about 5000 times a second while standing still.
test("a player's page starts fast, paints while it moves, and rests while it stands", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    const S = (window.__budget = { rafs: 0, paints: 0, reads: 0, long: [] })
    let drew = false
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!C) continue
      for (const name of ["drawArrays", "drawElements"]) {
        const f = C.prototype[name]
        C.prototype[name] = function (...a) {
          drew = true
          return f.apply(this, a)
        }
      }
    }
    const loop = () => {
      S.rafs += 1
      if (drew) S.paints += 1
      drew = false
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    const rect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      S.reads += 1
      return rect.call(this)
    }
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) S.long.push({ start: e.startTime, dur: e.duration })
    }).observe({ type: "longtask", buffered: true })
  })
  const page = await context.newPage()
  await page.goto("/?hooks=0")
  await page.waitForFunction(() => performance.getEntriesByName("lastkeep:firstMenuFrame").length === 1)
  await page.waitForTimeout(500)
  const freeze = await page.evaluate(() => {
    const first = performance.getEntriesByName("lastkeep:firstMenuFrame")[0].startTime
    return Math.max(0, ...window.__budget.long.filter((l) => l.start < first).map((l) => l.dur))
  })
  expect(freeze, "longest main-thread task before the first menu frame").toBeLessThan(1000)

  await page.locator("#player-name").fill("Ada")
  const clicked = await page.evaluate(() => performance.now())
  await page.locator("#start-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction(() => performance.getEntriesByName("lastkeep:firstWorldFrame").length === 1)
  const confirm = await page.evaluate((at) => performance.getEntriesByName("lastkeep:firstWorldFrame")[0].startTime - at, clicked)
  expect(confirm, "Create to the first world frame, in the same document").toBeLessThan(2500)
  expect(await page.evaluate(() => window.__lastKeep)).toBeUndefined()

  const span = async (ms) => {
    const a = await page.evaluate(() => ({ ...window.__budget }))
    await page.waitForTimeout(ms)
    const z = await page.evaluate(() => ({ ...window.__budget }))
    return { rafs: z.rafs - a.rafs, paints: z.paints - a.paints, readsPerSec: ((z.reads - a.reads) * 1000) / ms }
  }
  await page.waitForTimeout(3000)
  const idle = await span(3000)
  expect(idle.rafs).toBeGreaterThan(30)
  // The idle hero's own animation and a once-a-second keep-alive still paint.
  expect(idle.paints / idle.rafs, JSON.stringify(idle)).toBeLessThan(0.5)
  expect(idle.readsPerSec, JSON.stringify(idle)).toBeLessThan(30)

  await page.keyboard.down("KeyW")
  await page.waitForTimeout(300)
  const walk = await span(2000)
  await page.keyboard.up("KeyW")
  // drawDue held a moving page to 20 fps. Now every frame of the walk paints.
  expect(walk.paints / walk.rafs, JSON.stringify(walk)).toBeGreaterThan(0.7)
  await context.close()
})
