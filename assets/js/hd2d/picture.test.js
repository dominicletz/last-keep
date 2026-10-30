import assert from "node:assert/strict"
import test from "node:test"
import { pictureFromSearch } from "./picture.js"

const CALLS = ["open", "fit", "seat", "light", "dress", "present"]

test("hd2d is a picture only when the parameter is the string 1", () => {
  assert.equal(pictureFromSearch(""), null)
  assert.equal(pictureFromSearch("?hd2d=true"), null)
  assert.equal(pictureFromSearch("?HD2D=1"), null)
  assert.equal(pictureFromSearch("?name=Ada&hero=warrior"), null)

  const picture = pictureFromSearch("?hd2d=1&name=Ada&hero=warrior")
  assert.equal(picture.fov, 15)
  assert.ok(picture.ready instanceof Promise)
  for (const name of CALLS) assert.equal(typeof picture[name], "function")
})
