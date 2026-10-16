const { test, expect } = require("@playwright/test")
const fs = require("fs")
const path = require("path")

const proof = path.join("tmp", "verify-artifacts")

test.beforeAll(() => {
  fs.mkdirSync(proof, { recursive: true })
})

test("an invite with a name and hero puts the second browser in the same room, and the wave renders monsters", async ({ browser }) => {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const page = await host.newPage()
  const friend = await guest.newPage()
  const errors = []
  for (const [label, tab] of [["host", page], ["guest", friend]]) {
    tab.on("pageerror", (error) => errors.push(`${label} ${error.message}`))
    tab.on("console", (message) => {
      if (message.type() === "error") errors.push(`${label} ${message.text()}`)
    })
  }

  await page.goto("/")
  await page.locator("#player-name").fill("Ada")
  await page.locator('input[value="warrior"]').check()
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction(() => /Ada/.test(document.querySelector("[data-roster]")?.innerText || ""))
  await page.screenshot({ path: path.join(proof, "build-host.png") })

  const code = await page.evaluate(() => document.body.dataset.code)
  await friend.goto(`/r/${code}?name=LLL&hero=mage`)
  await friend.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    const form = document.querySelector("#join-game")
    return roster.includes("LLL") && roster.includes("Ada") && form && form.hidden
  })
  await page.waitForFunction(() => /LLL/.test(document.querySelector("[data-roster]")?.innerText || ""))
  await friend.screenshot({ path: path.join(proof, "coop-guest.png") })
  await page.screenshot({ path: path.join(proof, "coop-host.png") })

  const quiet = await page.evaluate(() => window.__lastKeep?.counts?.monsters || 0)
  expect(quiet).toBe(0)

  await page.waitForFunction(() => /^Wave /.test(document.querySelector("[data-wave]")?.textContent || ""), { timeout: 40_000 })
  await page.waitForFunction(() => (window.__lastKeep?.counts?.monsters || 0) >= 2, { timeout: 15_000 })
  await friend.waitForFunction(() => (window.__lastKeep?.counts?.monsters || 0) >= 2)
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(proof, "wave-host.png") })
  await friend.screenshot({ path: path.join(proof, "wave-guest.png") })
  const magenta = await magentaCount(page)
  expect(magenta).toBeGreaterThan(8)

  const hostRoster = await page.locator("[data-roster]").innerText()
  const guestRoster = await friend.locator("[data-roster]").innerText()
  expect(hostRoster).toContain("Ada")
  expect(hostRoster).toContain("LLL")
  expect(guestRoster).toContain("Ada")
  expect(guestRoster).toContain("LLL")
  expect(errors, errors.join("\n")).toEqual([])
})

test("the join form on a bare invite enters the same room", async ({ browser }) => {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const page = await host.newPage()
  const friend = await guest.newPage()

  await page.goto("/")
  await page.locator("#player-name").fill("Ada")
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  const code = await page.evaluate(() => document.body.dataset.code)

  await friend.goto(`/r/${code}`)
  await expect(friend.locator("#join-game")).toBeVisible()
  await friend.locator("#player-name").fill("Bo")
  await friend.locator('input[value="engineer"]').check()
  await friend.locator('#join-game button[type="submit"]').click()
  await friend.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    return roster.includes("Bo") && roster.includes("Ada") && document.querySelector("#join-game").hidden
  })
  await page.waitForFunction(() => /Bo/.test(document.querySelector("[data-roster]")?.innerText || ""))
  await friend.screenshot({ path: path.join(proof, "form-join.png") })
})

async function magentaCount(page) {
  return page.evaluate(() => {
    const src = document.querySelector("#stage canvas")
    const copy = document.createElement("canvas")
    copy.width = src.width
    copy.height = src.height
    const ctx = copy.getContext("2d", { willReadFrequently: true })
    ctx.drawImage(src, 0, 0)
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 2] > 120 && data[i + 1] < 80) count += 1
    }
    return count
  })
}
