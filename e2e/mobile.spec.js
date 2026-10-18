const { test } = require("@playwright/test")
const { mobileTouch, phoneClear, prepareProof } = require("./scenarios")

test.beforeAll(prepareProof)
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true
})

test("a phone joins, walks with the stick, casts, and builds", async ({ browser }) => {
  await mobileTouch(browser)
})

test("a phone keeps every caption off the others and off the buttons", async ({ browser }) => {
  await phoneClear(browser)
})
