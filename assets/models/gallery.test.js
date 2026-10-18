import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { heroParts } from "../js/heroes.js"
import { cycleLight, groundColor, litGround, pathColor, plazaColor, ringColor, skyColor, yardLight } from "../js/scene.js"
import { checkModels, heroColorProblems, heroHeightProblems, heroPixelFloor, repoRoot } from "./run.js"
import { conceptProblems, coverageProblems, fitSlack, iouLimit, keepStoneProblems, paletteProblems, rulesFrom, styleTables, uncitedPaletteProblems } from "./registry.js"
import { galleryRigs, maskBounds, maskIou } from "./raster.js"
import { citationProblems, loadSheet, medianHex, sceneColorProblems } from "./sheets.js"

test("the gallery matches the goldens and a second run", () => {
  const result = checkModels({ writeGolden: false })
  assert.deepEqual(result.problems, [])
  assert.equal(result.present["heroes.jpg"], true)
  assert.equal(result.present["theme.jpg"], true)
  assert.equal(result.present["monsters.jpg"], true)
  assert.equal(fitSlack, 2)
  assert.equal(iouLimit, 0.85)
  assert.equal(heroPixelFloor, 24)
  for (const row of result.rendered) {
    if (row.family !== "hero" && row.family !== "monster") continue
    const height = maskBounds(row.closeup).height
    assert.ok(height >= 64 && height <= 96, `${row.id} close-up ${height}`)
    assert.equal(row.portrait.width, row.closeup.width)
    assert.equal(row.portrait.height, row.closeup.height)
  }
})

test("a brown warrior close-up fails the concept palette", () => {
  const heroes = loadSheet(path.join(repoRoot(), "docs/concept/heroes.jpg"))
  const armor = new Set(["torso", "leg", "shoulders", "pauldron", "helm", "crest"])
  const crop = { x: 24, y: 158, w: 268, h: 412 }
  const brown = heroColorProblems(
    [
      {
        id: "warrior",
        family: "hero",
        concept: { crop },
        parts: heroParts("warrior").map((part) => (armor.has(part.name) ? { ...part, color: 0x8a5a32 } : part))
      }
    ],
    heroes
  )
  assert.ok(brown.some((line) => line.startsWith("warrior close-up")))
  const plate = heroColorProblems(
    [{ id: "warrior", family: "hero", concept: { crop }, parts: heroParts("warrior") }],
    heroes
  )
  assert.deepEqual(plate, [])
})

test("daylight does not clip grey plate to orange", () => {
  assert.ok(yardLight.sunLevel < 1)
  assert.ok(yardLight.hemisphere < 1)
  const sunRed = (yardLight.sun >> 16) & 255
  const sunBlue = yardLight.sun & 255
  assert.ok(sunRed - sunBlue < 40)
  const plate = litGround(0xd8cfc3, cycleLight.day)
  assert.ok(plate.r < 240 && plate.g < 240 && plate.b < 240)
  assert.ok(plate.r - plate.b < 40, `plate ${plate.r} ${plate.g} ${plate.b}`)
})

test("a hero under 24 internal pixels fails at rank 0 and at rank 4", () => {
  const short = heroHeightProblems([
    { id: "scout", family: "hero", parts: [{ name: "body", shape: "box", w: 4, h: 8, d: 4, x: 0, y: 4, z: 0, color: 0xd99b64 }] }
  ])
  assert.ok(short.some((line) => line.includes("rank 0")))
  assert.ok(short.some((line) => line.includes("rank 4")))
})

test("a palette token matches the jpeg median of its cited patch", () => {
  const heroes = loadSheet(path.join(repoRoot(), "docs/concept/heroes.jpg"))
  assert.equal(medianHex(heroes, { x: 238, y: 264, w: 8, h: 8 }), "d8cfc3")
  const wrong = citationProblems(
    [{ name: "steel", hex: "000000", sheet: "heroes.jpg", region: { x: 238, y: 264, w: 8, h: 8 } }],
    { "heroes.jpg": heroes }
  )
  assert.equal(wrong.length, 1)
  const outside = citationProblems(
    [{ name: "steel", hex: "d8cfc3", sheet: "heroes.jpg", region: { x: 2000, y: 0, w: 8, h: 8 } }],
    { "heroes.jpg": heroes }
  )
  assert.equal(outside.length, 1)
  assert.equal(uncitedPaletteProblems("| boot | #3a342c | boots |\n").length, 1)
  assert.equal(uncitedPaletteProblems("| steel | #d8cfc3 | heroes.jpg | 238,264,8,8 | blades |\n").length, 0)
})

test("the gallery sky and the yard ground stay on the concept moss and dusk", () => {
  const theme = loadSheet(path.join(repoRoot(), "docs/concept/theme.jpg"))
  const markdown = fs.readFileSync(path.join(repoRoot(), "STYLE.md"), "utf8")
  const { cited } = styleTables(markdown)
  assert.deepEqual(
    sceneColorProblems(markdown, theme, cited, galleryRigs, {
      ground: groundColor,
      sky: skyColor,
      plaza: plazaColor,
      path: pathColor,
      ring: ringColor
    }),
    []
  )
  const dirtPlaza = sceneColorProblems(markdown, theme, cited, galleryRigs, {
    ground: groundColor,
    sky: skyColor,
    plaza: pathColor,
    path: pathColor,
    ring: ringColor
  })
  assert.ok(dirtPlaza.some((line) => line.includes("yard plaza")))
  assert.ok(dirtPlaza.some((line) => line.includes("closer to the path")))
  const roof = cited.find((token) => token.name === "thatch")
  const brick = {
    day: { bg: [0x8a, 0x40, 0x30] },
    dusk: { bg: [0x3a, 0x18, 0x16] },
    night: { bg: [0x14, 0x0e, 0x12] }
  }
  const drifted = cited.map((token) => (token.name === "grass" ? { ...token, hex: roof.hex } : token))
  const problems = sceneColorProblems(markdown, theme, drifted, brick, {
    ground: groundColor,
    sky: skyColor,
    plaza: plazaColor,
    path: pathColor,
    ring: ringColor
  })
  assert.ok(problems.some((line) => line.includes("closer to the thatch roof")))
  assert.ok(problems.some((line) => line.includes("day gallery background")))
  const olive = sceneColorProblems(markdown, theme, cited, galleryRigs, {
    ground: 0x374115,
    sky: skyColor,
    plaza: plazaColor,
    path: pathColor,
    ring: ringColor
  })
  assert.ok(olive.some((line) => line.includes("dark olive")))
})

test("the keep body stays near the belfry stone and is not one brown tone", () => {
  const theme = loadSheet(path.join(repoRoot(), "docs/concept/theme.jpg"))
  const markdown = fs.readFileSync(path.join(repoRoot(), "STYLE.md"), "utf8")
  const { cited } = styleTables(markdown)
  const stone = cited.find((token) => token.name === "stone")
  assert.equal(medianHex(theme, stone.region), stone.hex)
  assert.equal(stone.hex, "4b3c33")
  const listed = [
    {
      id: "keep",
      concept: { crop: { x: 548, y: 28, w: 188, h: 230 } },
      parts: [
        { name: "tower", w: 32, h: 104, d: 32, color: 0x8a5a32 },
        { name: "roof", w: 46, h: 26, d: 46, color: 0x43382e }
      ]
    }
  ]
  const flat = keepStoneProblems(listed, cited)
  assert.ok(flat.some((line) => line.includes("away from stone")))
  assert.ok(flat.some((line) => line.includes("does not vary")))
  listed[0].parts[0].color = 0x4b3c33
  listed[0].parts.push(
    { name: "course", w: 20, h: 8, d: 4, color: 0x654e41 },
    { name: "course", w: 20, h: 8, d: 4, color: 0x2c2a2a }
  )
  assert.deepEqual(keepStoneProblems(listed, cited), [])
})

test("a kind with no model, a loose color, and a foreign sheet fail", () => {
  const rules = rulesFrom("@heroes [:warrior]\n@builds [:wall]\ndef monster(:goblin)\n")
  const missing = coverageProblems(
    [
      { id: "warrior", family: "hero" },
      { id: "wall", family: "building" },
      { id: "dragon", family: "monster" }
    ],
    rules
  )
  assert.ok(missing.some((line) => line.includes("goblin")))
  assert.ok(missing.some((line) => line.includes("dragon")))
  const colors = paletteProblems([{ id: "wall", parts: [{ name: "brick", color: 0x010203 }] }], new Map([["ffffff", "ink"]]))
  assert.equal(colors.length, 1)
  const sheets = conceptProblems([{ id: "wall", concept: { sheet: "lk_other.jpg", figure: "wall" } }])
  assert.equal(sheets.length, 1)
  const mask = new Uint8Array([1, 1, 0, 0])
  assert.equal(maskIou(mask, mask), 1)
  assert.ok(maskIou(mask, new Uint8Array([0, 0, 1, 1])) < 0.85)
})
