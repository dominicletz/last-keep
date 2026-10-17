const fs = require("fs")
const path = require("path")
const { createHost, joinQuery } = require("../scenarios")

const PARTY = [
  { name: "Ada", hero: "warrior", persona: "gameplay" },
  { name: "Lux", hero: "mage", persona: "graphics" },
  { name: "Bram", hero: "engineer", persona: "music" },
  { name: "Pip", hero: "scout", persona: "logic" },
  { name: "Nia", hero: "farmer", persona: "character" }
]

async function openParty(browser, options = {}) {
  const players = options.players || PARTY
  const host = await createHost(browser, players[0].name, players[0].hero)
  const code = await host.page.evaluate(() => document.body.dataset.code)
  const seats = [{ ...players[0], page: host.page, context: host.context }]
  for (const player of players.slice(1)) {
    const seat = await joinQuery(browser, code, player.name, player.hero)
    seats.push({ ...player, page: seat.page, context: seat.context })
  }
  const names = players.map((player) => player.name)
  for (const seat of seats) {
    await seat.page.bringToFront()
    await seat.page.waitForFunction(
      (expected) => {
        const text = document.querySelector("[data-roster]")?.textContent || ""
        return expected.every((name) => text.includes(name))
      },
      names
    )
  }
  return {
    code,
    seats,
    async close() {
      for (const seat of seats) await seat.context.close()
    }
  }
}

async function focusGame(page) {
  await page.bringToFront()
  await page.evaluate(() => {
    const active = document.activeElement
    if (active && active.blur) active.blur()
  })
}

async function readState(page) {
  return page.evaluate(() => {
    const game = window.__lastKeep || {}
    const text = (selector) => document.querySelector(selector)?.innerText || ""
    return {
      phase: game.phase || null,
      hold: !!game.hold,
      wave: game.shownWave ?? null,
      clock: text("[data-clock]"),
      waveLabel: text("[data-wave]"),
      score: game.score ?? null,
      wood: game.wood ?? null,
      keep: game.keep || null,
      self: game.self || null,
      monsters: (game.monsters || []).length,
      buildings: game.buildings ?? null,
      kills: game.kills ?? null,
      hud: text("[data-stock]")
    }
  })
}

async function shot(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file })
  return file
}

async function keyInPage(page, code, down) {
  await page.bringToFront()
  await page.evaluate(
    ({ code, down }) => {
      const active = document.activeElement
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) active.blur()
      if (window.__lastKeepTest) window.__lastKeepTest.hold(code, down)
      window.dispatchEvent(
        new KeyboardEvent(down ? "keydown" : "keyup", {
          code,
          key: code,
          bubbles: true,
          cancelable: true
        })
      )
    },
    { code, down }
  )
}

async function act(page, command = {}) {
  await focusGame(page)
  const keys = command.hold || []
  try {
    if (command.build) {
      await keyInPage(page, `Digit${command.build}`, true)
      await keyInPage(page, `Digit${command.build}`, false)
    }
    for (const key of keys) await keyInPage(page, key, true)
    if (command.click && Number.isFinite(command.click.x) && Number.isFinite(command.click.y)) {
      await page.mouse.click(command.click.x, command.click.y)
    }
    if (command.skill) {
      const skill = { q: "KeyQ", e: "KeyE", r: "KeyR", f: "KeyF" }[String(command.skill).toLowerCase()]
      if (skill) {
        await keyInPage(page, skill, true)
        await keyInPage(page, skill, false)
      }
    }
    if (command.start) await page.locator("[data-start]").click()
    if (command.ms) await page.waitForTimeout(command.ms)
  } finally {
    for (const key of keys) await keyInPage(page, key, false).catch(() => {})
  }
}

module.exports = { PARTY, openParty, focusGame, readState, shot, act, keyInPage }
