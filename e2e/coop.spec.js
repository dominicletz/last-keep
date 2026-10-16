const { test } = require("@playwright/test")
const { joinFromForm, prepareProof, scoreList, twoPlayerNight } = require("./scenarios")

test.beforeAll(prepareProof)
test.use({ viewport: { width: 1280, height: 800 } })

test("two players start the night, place a wall, and clear wave 1", async ({ browser }) => {
  await twoPlayerNight(browser)
})

test("the join form on a bare invite enters the same room", async ({ browser }) => {
  await joinFromForm(browser)
})

test("the high score list hides scoreless runs", async ({ request }) => {
  await scoreList(request)
})
