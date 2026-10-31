// Functional browser tests draw the HD-2D picture with the low extras.
// Two cores is the tierFor cutoff, so the shadow map, bloom, and depth of
// field stay off. The style does not change. The perf job measures that
// same path on one page.

async function lowContext(browser, options) {
  const context = await browser.newContext(options)
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => 2
    })
  })
  return context
}

module.exports = { lowContext }
