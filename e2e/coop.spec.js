const { test } = require("@playwright/test")
const { captionsClearTheBuilds, chopThePine, exploreLand, hd2dFlag, heroSilhouettes, holdTheLand, joinFromForm, matchPaintsWithoutARead, paradeShowsEveryKind, pictureGrade, prepareProof, raiseNeedsTheKeep, readTheMap, scoreList, shotsDoNotGrowGeometries, sixSeatMatch, squarePixels, takeTheShrine, townGrows, twoPlayerNight, wakeTheCamp } = require("./scenarios")

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

test("a raise stays disabled until the hero reaches the keep", async ({ browser }) => {
  await raiseNeedsTheKeep(browser)
})

test("the yard keeps its value steps and the ground stays under the noise cap", async ({ browser }) => {
  await pictureGrade(browser)
})

test("a walk opens a chest and a broken portal skips the night", async ({ browser }) => {
  test.setTimeout(180_000)
  await exploreLand(browser)
})

test("a pine past the yard pays the wood sack", async ({ browser }) => {
  test.setTimeout(60_000)
  await chopThePine(browser)
})

test("a camp wakes an ally who does not take a seat", async ({ browser }) => {
  test.setTimeout(180_000)
  await wakeTheCamp(browser)
})

test("a shrine grants one relic", async ({ browser }) => {
  test.setTimeout(180_000)
  await takeTheShrine(browser)
})

test("a wall outside the keep disc waits until that portal falls", async ({ browser }) => {
  test.setTimeout(180_000)
  await holdTheLand(browser)
})

test("the map table shows the explored land", async ({ browser }) => {
  await readTheMap(browser)
})

test("the hd2d flag keeps the palette path and grades three stills", async ({ browser }) => {
  await hd2dFlag(browser)
})
