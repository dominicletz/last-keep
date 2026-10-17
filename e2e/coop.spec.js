const { test } = require("@playwright/test")
const { heroSilhouettes, joinFromForm, paradeShowsEveryKind, prepareProof, scoreList, squarePixels, twoPlayerNight } = require("./scenarios")

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

test("the picture stays square when the window changes shape", async ({ browser }) => {
  await squarePixels(browser)
})

test("the five heroes stand as different bodies", async ({ browser }) => {
  await heroSilhouettes(browser)
})

test("a scripted night puts every monster kind on the yard", async ({ browser }) => {
  await paradeShowsEveryKind(browser)
})
