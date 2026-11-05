import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { arrowFrame, fireFrame, shotArt, shotScale, SHOT_URL } from "./shots.js"

test("eight compass directions land on the eight arrow frames", () => {
  assert.equal(arrowFrame(1, 0), 0)
  assert.equal(arrowFrame(1, 1), 1)
  assert.equal(arrowFrame(0, 1), 2)
  assert.equal(arrowFrame(-1, 1), 3)
  assert.equal(arrowFrame(-1, 0), 4)
  assert.equal(arrowFrame(-1, -1), 5)
  assert.equal(arrowFrame(0, -1), 6)
  assert.equal(arrowFrame(1, -1), 7)
  assert.equal(arrowFrame(0, 0), 0)
  const inside = Math.PI / 8 - 0.05
  const outside = Math.PI / 8 + 0.05
  assert.equal(arrowFrame(Math.cos(inside), Math.sin(inside)), 0)
  assert.equal(arrowFrame(Math.cos(outside), Math.sin(outside)), 1)
  assert.equal(arrowFrame(Math.cos(-inside), Math.sin(-inside)), 0)
  assert.equal(arrowFrame(Math.cos(-outside), Math.sin(-outside)), 7)
})

test("the fireball loops four frames and a meteor is the same sheet drawn larger", () => {
  assert.equal(fireFrame(0), 0)
  assert.equal(fireFrame(89), 0)
  assert.equal(fireFrame(90), 1)
  assert.equal(fireFrame(90 * 4), 0)
  assert.equal(fireFrame(90 * 5 + 10), 1)
  const fire = shotArt("fireball")
  const meteor = shotArt("meteor")
  assert.equal(fire.sheet, "fire")
  assert.equal(meteor.sheet, "fire")
  assert.equal(fire.frames, 4)
  assert.equal(fire.bloom, true)
  assert.equal(meteor.bloom, true)
  assert.equal(fire.px, 14)
  assert.equal(meteor.px, 18)
  assert.ok(shotScale(meteor, 1) > shotScale(fire, 1))
  assert.equal(shotArt("arrow").sheet, "arrow")
  assert.equal(shotArt("bolt").sheet, "arrow")
  assert.equal(shotArt("volley").sheet, "arrow")
  assert.equal(shotArt("arrow").frames, 8)
  assert.equal(shotArt("frost").sheet, "frost")
  assert.equal(shotArt("frost").frames, 1)
  assert.equal(shotArt("frost").px, 12)
  assert.equal(SHOT_URL.arrow, "/images/hd2d/arrow-sheet.png")
  assert.equal(SHOT_URL.fire, "/images/hd2d/fire-sheet.png")
  assert.equal(SHOT_URL.frost, "/images/hd2d/frost.png")
})

test("shots are billboards on the texel grid, not turned spheres", () => {
  const source = fs.readFileSync(new URL("./render.js", import.meta.url), "utf8")
  assert.match(source, /arrowFrame\(flightTo\.x - flightFrom\.x, flightTo\.y - flightFrom\.y\)/)
  assert.match(source, /fireFrame\(performance\.now\(\)\)/)
  assert.match(source, /if \(mesh\.userData\.role === "shot"\)/)
  assert.match(source, /snapWorld\(pose\.x \+ spread\.x, step\)/)
  assert.doesNotMatch(source, /0xf2e2b0/)
  assert.doesNotMatch(source, /shotSphere/)
  assert.doesNotMatch(source, /shot\.rotation/)
  assert.doesNotMatch(source, /material\.rotation/)
})
