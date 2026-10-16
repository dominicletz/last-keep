const fs = require("fs")
const net = require("net")
const path = require("path")
const { chromium } = require("playwright")
const { PARTY, openParty, readState, shot, act } = require("./room")

const portFile = (dir) => path.join(dir, "port")

function launchOptions() {
  return process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
}

async function serve(dir) {
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch(launchOptions())
  const party = await openParty(browser)
  let beat = 0
  const server = net.createServer((socket) => {
    let buffer = ""
    socket.on("data", (chunk) => {
      buffer += chunk
      let end
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 1)
        handle(line).then(
          (result) => socket.write(`${JSON.stringify(result)}\n`),
          (error) => socket.write(`${JSON.stringify({ ok: false, error: error.message })}\n`)
        )
      }
    })
  })

  async function handle(line) {
    const command = JSON.parse(line)
    if (command.op === "party") {
      return { ok: true, code: party.code, players: party.seats.map((seat) => ({ name: seat.name, hero: seat.hero, persona: seat.persona })) }
    }
    if (command.op === "shot") {
      beat += 1
      const files = []
      for (const seat of party.seats) {
        const base = path.join(dir, "shots", `${String(beat).padStart(2, "0")}-${seat.name}`)
        const image = await shot(seat.page, `${base}.png`)
        const state = await readState(seat.page)
        fs.writeFileSync(`${base}.json`, JSON.stringify(state, null, 2))
        files.push({ name: seat.name, persona: seat.persona, image, state })
      }
      return { ok: true, beat, files }
    }
    if (command.op === "act" || command.op === "acts") {
      const list = command.op === "acts" ? command.players : [command]
      await Promise.all(
        list.map(async (item) => {
          const seat = party.seats.find((entry) => entry.name === item.player)
          if (!seat) throw new Error(`no player ${item.player}`)
          await act(seat.page, item)
        })
      )
      const states = []
      for (const seat of party.seats) states.push({ name: seat.name, state: await readState(seat.page) })
      return { ok: true, states }
    }
    if (command.op === "stop") {
      server.close()
      await party.close()
      await browser.close()
      return { ok: true, stopped: true }
    }
    return { ok: false, error: "unknown op" }
  }

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  fs.writeFileSync(portFile(dir), String(port))
  console.log(JSON.stringify({ ok: true, port, code: party.code, dir }))
}

function send(dir, command) {
  const port = Number(fs.readFileSync(portFile(dir), "utf8"))
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      socket.end(`${JSON.stringify(command)}\n`)
    })
    let buffer = ""
    socket.on("data", (chunk) => {
      buffer += chunk
    })
    socket.on("end", () => {
      try {
        resolve(JSON.parse(buffer))
      } catch (error) {
        reject(error)
      }
    })
    socket.on("error", reject)
  })
}

async function main() {
  const [op, dir, extra] = process.argv.slice(2)
  if (op === "serve") return serve(dir)
  if (!dir) throw new Error("usage: cli.js serve <dir> | shot <dir> | act <dir> <json> | stop <dir>")
  if (op === "shot") return console.log(JSON.stringify(await send(dir, { op: "shot" })))
  if (op === "party") return console.log(JSON.stringify(await send(dir, { op: "party" })))
  if (op === "stop") return console.log(JSON.stringify(await send(dir, { op: "stop" })))
  if (op === "act") return console.log(JSON.stringify(await send(dir, { op: "act", ...JSON.parse(extra) })))
  throw new Error(`unknown ${op}`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = { PARTY, serve, send }
