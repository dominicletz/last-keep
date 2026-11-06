const { test } = require("@playwright/test")
const { liveSmoke, prepareProof } = require("./scenarios")

test.beforeAll(prepareProof)
test.use({ viewport: { width: 1280, height: 800 } })

// Deploy production runs the @smoke tests against the live site. See
// docs/VERIFICATION.md for the split between this set and PR CI.
test("two seats share a room, the host walks, and the night opens wave 1", { tag: "@smoke" }, async ({ browser }) => {
  await liveSmoke(browser)
})
