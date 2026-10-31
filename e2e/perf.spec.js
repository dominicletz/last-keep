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
