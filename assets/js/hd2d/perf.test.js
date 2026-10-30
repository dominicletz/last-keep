import assert from "node:assert/strict"
import test from "node:test"
import { perfRequested, perfText } from "./perf.js"

test("perf is on only for the string 1 and the line names the frame", () => {
  assert.equal(perfRequested(""), false)
  assert.equal(perfRequested("?hd2d=1"), false)
  assert.equal(perfRequested("?perf=true"), false)
  assert.equal(perfRequested("?hd2d=1&perf=1"), true)
  assert.equal(perfText(null), "frame —")
  assert.equal(perfText({ frameMs: 12.34, submitMs: 8, driver: "ANGLE (SwiftShader)" }), "frame 12.3 ms / 8.0 ms  ANGLE (SwiftShader)")
})
