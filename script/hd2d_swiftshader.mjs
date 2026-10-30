import { spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { recordBaseline, stillRects } from "../assets/js/hd2d_score.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const origin = process.env.HD2D_ORIGIN || "http://127.0.0.1:4000"

function framesFrom(payload) {
  const names = ["day", "dusk", "night"]
  const frames = {}
  payload.frames.forEach((frame, index) => {
    frames[names[index]] = {
      rgba: frame.rgba ? Uint8Array.from(frame.rgba) : null,
      width: frame.width,
      height: frame.height,
      frameMs: frame.frameMs
    }
  })
  return frames
}

function report(driver, frames, wrote) {
  const times = {
    driver,
    wrote,
    swiftshader: frames.day.frameMs,
    day: frames.day.frameMs,
    dusk: frames.dusk.frameMs,
    night: frames.night.frameMs
  }
  console.log(JSON.stringify(times))
  return times
}

async function finish(driver, payload) {
  if (!String(driver).includes("SwiftShader")) {
    console.log(payload.frames.map((frame) => frame.frameMs))
    throw new Error("swiftshader")
  }
  const frames = framesFrom(payload)
  const baseline = path.join(root, "docs/concepts/HD2D-BASELINE.json")
  if (fs.existsSync(baseline) || !frames.day.rgba) {
    return report(driver, frames, false)
  }
  const written = recordBaseline({
    root,
    driver,
    frameMs: frames.day.frameMs,
    frames,
    rects: stillRects(frames.day.width, frames.day.height)
  })
  return report(driver, frames, written.wrote)
}

async function timeOnServer() {
  const { chromium } = await import("@playwright/test")
  const server = spawn("mix", ["phx.server"], {
    cwd: root,
    env: { ...process.env, PORT: "4000", PLAYWRIGHT: "1" },
    stdio: "inherit"
  })
  try {
    const started = Date.now()
    while (Date.now() - started < 120000) {
      try {
        const res = await fetch(origin)
        if (res.ok) break
      } catch (_err) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        continue
      }
      break
    }
    const created = await fetch(`${origin}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada", hero: "warrior" })
    })
    if (!created.ok) throw new Error(`room ${created.status}`)
    const room = await created.json()
    const browser = await chromium.launch({
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"]
    })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    page.setDefaultTimeout(180000)
    const needPixels = !fs.existsSync(path.join(root, "docs/concepts/HD2D-BASELINE.json"))
    await page.goto(`${origin}/r/${room.code}?hd2d=1`)
    await page.waitForFunction(() => window.__lastKeepPicture && typeof window.__lastKeepPicture.grade === "function")
    const payload = await page.evaluate(async (pixels) => {
      const buffers = await window.__lastKeepPicture.grade()
      const canvas = document.querySelector("canvas")
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
      const info = gl.getExtension("WEBGL_debug_renderer_info")
      const driver = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") : ""
      return {
        driver,
        frames: buffers.map((buffer) => ({
          width: buffer.width,
          height: buffer.height,
          frameMs: buffer.frameMs,
          rgba: pixels ? Array.from(buffer.rgba) : null
        }))
      }
    }, needPixels)
    await browser.close()
    return finish(payload.driver, payload)
  } finally {
    server.kill("SIGTERM")
  }
}

function staticServer(bundle) {
  const shots = []
  let done
  const ready = new Promise((resolve) => {
    done = resolve
  })
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, origin)
    if (req.method === "GET" && url.pathname === "/") {
      res.setHeader("content-type", "text/html")
      res.end(`<!doctype html><html><body style="margin:0"><div id="stage" style="width:1280px;height:800px"></div>
<script src="/bundle.js"></script>
<script>
window.__lastKeepPicture.grade().then(async (buffers) => {
  const canvas = document.querySelector("canvas")
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
  const info = gl.getExtension("WEBGL_debug_renderer_info")
  const driver = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") : ""
  for (const [index, buffer] of buffers.entries()) {
    await fetch("/frame?i=" + index + "&w=" + buffer.width + "&h=" + buffer.height + "&ms=" + buffer.frameMs, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: buffer.rgba
    })
  }
  await fetch("/done?driver=" + encodeURIComponent(driver), { method: "POST" })
}).catch(async (err) => {
  await fetch("/done?error=" + encodeURIComponent(String(err && err.stack || err)), { method: "POST" })
})
</script></body></html>`)
      return
    }
    if (req.method === "GET" && url.pathname === "/bundle.js") {
      res.setHeader("content-type", "text/javascript")
      res.end(bundle)
      return
    }
    if (req.method === "GET" && url.pathname.startsWith("/images/")) {
      const file = path.join(root, "priv/static", url.pathname)
      if (!fs.existsSync(file)) {
        res.writeHead(404)
        res.end()
        return
      }
      res.setHeader("content-type", "image/png")
      res.end(fs.readFileSync(file))
      return
    }
    if (req.method === "POST" && url.pathname === "/frame") {
      const chunks = []
      req.on("data", (chunk) => chunks.push(chunk))
      req.on("end", () => {
        shots[Number(url.searchParams.get("i"))] = {
          width: Number(url.searchParams.get("w")),
          height: Number(url.searchParams.get("h")),
          frameMs: Number(url.searchParams.get("ms")),
          rgba: Buffer.concat(chunks)
        }
        res.end("ok")
      })
      return
    }
    if (req.method === "POST" && url.pathname === "/done") {
      res.end("ok")
      done({
        error: url.searchParams.get("error"),
        driver: url.searchParams.get("driver") || "",
        frames: shots
      })
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, ready, port: server.address().port }))
  })
}

async function timeStatic() {
  const tools = path.join(os.tmpdir(), "hd2d-tools")
  const esbuild = path.join(tools, "node_modules/esbuild/bin/esbuild")
  if (!fs.existsSync(esbuild)) {
    await new Promise((resolve, reject) => {
      const install = spawn("npm", ["install", "--prefix", tools, "esbuild@0.25.0"], { stdio: "inherit" })
      install.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("esbuild"))))
    })
  }
  const entry = path.join(os.tmpdir(), "hd2d-grade-entry.js")
  fs.writeFileSync(
    entry,
    `import { pictureFromSearch } from ${JSON.stringify(path.join(root, "assets/js/hd2d/picture.js"))}
import { createView } from ${JSON.stringify(path.join(root, "assets/js/render.js"))}
const stage = document.querySelector("#stage")
const picture = pictureFromSearch(location.search)
const view = createView(stage, picture)
window.__lastKeepPicture = { ready: picture.ready, grade: () => view.grade() }
`
  )
  const outfile = path.join(os.tmpdir(), "hd2d-grade-bundle.js")
  await new Promise((resolve, reject) => {
    const build = spawn(esbuild, [entry, "--bundle", `--outfile=${outfile}`, "--format=iife", "--target=es2022"], {
      stdio: "inherit"
    })
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("bundle"))))
  })
  const { server, ready, port } = await staticServer(fs.readFileSync(outfile))
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hd2d-chrome-"))
  const chrome = spawn(
    process.env.CHROME_PATH || "google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      `http://127.0.0.1:${port}/?hd2d=1`
    ],
    { stdio: "inherit" }
  )
  try {
    const payload = await Promise.race([
      ready,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("grade timeout")), 180000))
    ])
    if (payload.error) throw new Error(payload.error)
    payload.frames = payload.frames.map((frame) => ({ ...frame, rgba: Array.from(frame.rgba) }))
    return finish(payload.driver, payload)
  } finally {
    chrome.kill("SIGTERM")
    server.close()
  }
}

const times = process.env.HD2D_STATIC === "1" ? await timeStatic() : await timeOnServer()
if (!Number.isFinite(times.swiftshader) || times.swiftshader <= 0) throw new Error("frame time")
