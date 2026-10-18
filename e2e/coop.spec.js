const { test } = require("@playwright/test")
const { captionsClearTheBuilds, exploreLand, heroSilhouettes, joinFromForm, matchPaintsWithoutARead, paradeShowsEveryKind, prepareProof, scoreList, shotsDoNotGrowGeometries, sixSeatMatch, squarePixels, townGrows, twoPlayerNight } = require("./scenarios")

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

test("a match paints without reading the framebuffer back", async ({ browser }) => {
  await matchPaintsWithoutARead(browser)
})

test("a scripted night puts every monster kind on the yard", async ({ browser }) => {
  test.skip(Boolean(process.env.BASE_URL), "the parade is only on the suite server")
  await paradeShowsEveryKind(browser)
})

test("the town ring grows when the keep is raised and the farmer has worked", async ({ browser }) => {
  await townGrows(browser)
})

test("far from the keep the roster and relic lines clear the build bar", async ({ browser }) => {
  await captionsClearTheBuilds(browser)
})

test("shots leave the geometry count flat", async ({ browser }) => {
  await shotsDoNotGrowGeometries(browser)
})

test("six seats hold the match budgets across three waves", async ({ browser }) => {
  test.setTimeout(660_000)
  await sixSeatMatch(browser)
})

test("a walk opens a chest and a broken portal skips the night", async ({ browser }) => {
  test.setTimeout(180_000)
  await exploreLand(browser)
})
