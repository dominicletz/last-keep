---
name: verify-last-keep
description: "Drive Last Keep in real browsers at 1280x800 and prove two players can start a night, place a wall, see goblins on the yard, and kill one. Use before calling any Last Keep change done, and after a production deploy."
disable-model-invocation: true
---

# Verify Last Keep

This is the definition of done. `mix test` does not replace it. A passing run that only counts meshes, or that never clicks, is not done. Run the Playwright suite against the server you changed. After a deploy, run the same suite with `BASE_URL` set to the live origin.

The checks live in `e2e/scenarios.js`. `e2e/coop.spec.js` calls those functions and does not restate them. When a check changes, change `e2e/scenarios.js`. Do not copy the steps into this skill.

How roles touch is `docs/GAME-INTERACTIONS.md`. `mix test` includes `test/last_keep/game/interactions_test.exs`, which checks `docs/interactions.json` against the simulation. A playtest that reviews roles uses `.agents/skills/playtest-last-keep/SKILL.md` and does not replace this browser proof.

## Launch

From the repo root, with Elixir 1.18 and OTP 28 on `PATH`:

```sh
mix setup
npm ci
npm ci --prefix assets
npx playwright install chromium
PORT=4000 mix phx.server
```

Ready means `curl -fsS http://127.0.0.1:4000/` contains `Last Keep` and the body contains `Create game`. A socket that accepts TCP is not ready.

`npx playwright test` starts that server itself when `BASE_URL` is unset and port 4000 is free. If a server you started is already on port 4000, the suite reuses it. Restart that server after a code change or the browser will prove the old build. The shell often exports `BASE_URL` for production. Unset it for a local run.

The viewport is 1280 by 800. That is the size a manual playtest uses. Do not shrink it to make a sprite fit.

## Doctor

```sh
curl -fsS "${BASE_URL:-http://127.0.0.1:4000}/" | grep -q "Create game"
```

Stop if that fails. Do not drive a server this run did not start, except the production origin after a deploy of the commit you are proving.

## Drive

```sh
npx playwright test
```

Against a deployed site:

```sh
BASE_URL=https://agentyard.letz.tw npx playwright test
```

`e2e/coop.spec.js` runs six scenarios exported from `e2e/scenarios.js`. `e2e/mobile.spec.js` runs `mobileTouch` on a landscape phone with touch:

- `twoPlayerNight` — Bob the warrior hosts, LLL the mage joins from the invite query. The night waits. The yard light is `day` while the party waits, and `night` after the host starts. The canvas yard patch is moss while the party waits (luminance at least 100, hue at least 70) and, after the host starts, dusk is the warm step under that day before the night. A dark olive patch fails. The score chip reads `Score 0`. A click that only focuses the window does not swing. A click with no building armed does not spend wood. An illegal wall says why, spends nothing, and the reason hides. One click after the window blurs places a legal wall, spends wood, and disarms. Arming a wall draws a ground ring whose radius is that hero's reach. Movement while walking interpolates. The host's start plays the horn and the night loop. An edge call does not cover the roster. Both clients see goblins on the yard, and the two bodies are drawn apart. The mage's Fireball is cast when the night starts, while that hero is still up. The hold waits until the guest is visible and its tick is advancing at the live rate, and the shot still has to appear within 5 seconds. Damage numbers rise and fade, and `Slain` is on screen. The wave label only moves forward, from `Wave 1` to `Wave 2`. The keep survives. The score chip matches the snapshot. The cue list has the horn, the sting, a hit, a kill, and the build. The same bus reports the fall. Mute and volume survive a reload. Forge, Spire, and relic copy are on the HUD, and `window.__lastKeep.smoothing` is true. The wave line, relic lines, resource tally, roster, ability keys, and build keys are captions: `assertDiegeticHud` fails an opaque fill, a thick border, or a combined box at the old panel area.
- `joinFromForm` — a bare `/r/<code>` link shows the join form, and Bo the engineer enters Ada's room. Console errors fail the scenario.
- `scoreList` — `GET /api/highscores` has no score of 0 and no blank names.
- `squarePixels` — the buffer aspect and the camera aspect follow the window at 1600×600, 600×1000, and 1280×800. Console errors fail the scenario.
- `heroSilhouettes` — Ada, Lux, Bram, Pip, and Nia stand in one room as warrior, mage, engineer, scout, and farmer. `window.__lastKeep.figures` has five distinct mark, bounds, and part-count signatures.
- `paradeShowsEveryKind` — the scripted parade puts goblin, skeleton, wolf, troll, bat, and boss on screen around the host. `brightNear` reads the bat and the rider. Each needs at least 24 pixels 18 luma above the yard patch. The parade is skipped when `BASE_URL` is set.
- `mobileTouch` — a touch phone in landscape creates a game, walks with the left joystick, casts Q from the portrait button, and places a wall from the context button. The same page in portrait shows the rotate prompt. A desktop context keeps the touch pad hidden.

`assertWaveClear` runs while the party waits at the keep and again after the host walks. The wave line stays inside the window and off the sacks, the relic lines, the heart, the roster, the name, the calls, and the raise, skill, and build controls.

The browser reads `window.__lastKeep` (tick, phase, wood, buildings, monsters, figures, rangeRing, audio, projectiles, log, labels, kinds, attackCd, shownWave, smoothing, renders, `toClient`, `redNear`, `brightNear`) and `window.__lastKeepTest` (`blur`, `hold`, `mute`, `volume`, `hear`, `parade`). Those hooks are the same ones this skill's run uses. Do not add a second script. The five-player walk also requires an idle seat to paint fewer than 12 frames in one second, and the warrior still has to travel more than 20.

Server rules that the browser cannot force (a refused cost, Fireball damage, the shown-wave step, elite armor, a fast lunge, a boss slam, a wounded hero staying wounded when the keep falls) are ExUnit tests in `test/last_keep/game/sim_test.exs`. `test/last_keep/game/room_test.exs` requires an empty room to stop ticking, five abandoned rooms to terminate, and the supervisor count to return to the count from before those rooms existed. Run `mix test` as well.

## Evidence

Write screenshots to `tmp/verify-artifacts/`. `twoPlayerNight` writes `coop-host.png`, `coop-guest.png`, `reason-host.png`, `wall-host.png`, `wave-host.png`, `wave-guest.png`, `combat-host.png`, and `cleared-host.png`. `joinFromForm` writes `form-join.png`. `heroSilhouettes` writes `heroes-host.png`. `mobileTouch` writes `mobile-landscape.png` and `mobile-portrait.png`. Cleanup does not delete that directory.

A passing run shows both players, a placed wall, the refusal reason, goblins on the yard inside the camera, a damage number, and a cleared wave. A roster assertion without the screenshot is not proof. A monster count without red pixels at the goblin's projected position is not proof.

## Cleanup

Stop the `mix phx.server` process you started. Do not kill every `beam` on the machine. Leave `tmp/verify-artifacts/` in place.

## Helpers

`npx playwright test` is the harness. `npm test --prefix assets` checks the modules under `assets/js` that the scenarios depend on: invite parsing, snapshot drawing, the wave label, the focus click, placement reasons, relic copy, interpolation, the frame aspect, elite looks, the audio cue map, hero signatures, monster spread, the build ring, edge-call placement, and the joystick vector. `npm run check --prefix assets` typechecks those modules. `mix test --cover` is the coverage floor in `docs/VERIFICATION.md`. The feature map is `features/README.md`. It names the same functions and does not repeat their steps.
