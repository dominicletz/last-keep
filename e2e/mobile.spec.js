const { test } = require("@playwright/test")
const { mobileTouch, prepareProof } = require("./scenarios")

test.beforeAll(prepareProof)
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true
})

test("a phone joins, walks with the stick, casts, and builds", async ({ browser }) => {
  await mobileTouch(browser)
})
