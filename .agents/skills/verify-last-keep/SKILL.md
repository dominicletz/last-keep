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

`e2e/coop.spec.js` runs ten scenarios exported from `e2e/scenarios.js`. `e2e/mobile.spec.js` runs `mobileTouch` and `phoneClear` on a landscape phone with touch:

- `twoPlayerNight` — Bob the warrior hosts, LLL the mage joins from the invite query. The night waits. The yard light is `day` while the party waits, and `night` after the host starts. The waiting yard calls `frameMood` and `frameGround`. A flat field (contrast under 9), a lime share over 0.08, or a near-ground spread under 8 fails. The framebuffer is flipped to top-down before that grade, so the band is the near yard. A bottom-up read scores the far wash. The light changes first, and the grade runs after, so the read does not stall the page through the dusk window. After the host starts, dusk must pass the same comparison: contrast at least 9, cool wash at most 0.25, warm tail at least 0.03. Keep stone and the pine wall stay at least 25 degrees of hue apart, and the hero plate stays under 0.2 saturation. The plate sample is the steel on the 32-unit card at height 18. Height 40 is above that card. The dusk wait stays until the height-18 patch is under 0.2, because a dark miss divides by a tiny red and the ratio jumps past 1. Dusk and night grade mood and ground from one framebuffer read. Dusk sunset flecks stay out of the pine-wall band, because that crown sample is mostly the ground behind it. Night has to pass before the fight. A golf-course day or a lavender dusk fails. The pine wall count on `forestLook.wall` is at least 80, and the seventy outer stumps and felled logs stay woodless. The score chip reads `Score 0`. A click that only focuses the window does not swing. A click with no building armed does not spend wood. An illegal wall says why, spends nothing, and the reason hides. One click after the window blurs places a legal wall, spends wood, and disarms. Arming a wall draws a ground ring whose radius is that hero's reach. Movement while walking interpolates. The host's start plays the horn and the night loop. An edge call does not cover the roster. Both clients see goblins on the yard, and the two bodies are drawn apart. The mage's Fireball is cast when the night starts, while that hero is still up. The hold waits until the guest is visible and its tick is advancing at the live rate, and the shot still has to appear within 5 seconds. Damage numbers rise and fade, and `Slain` is on screen. The wave label only moves forward, from `Wave 1` to `Wave 2`. The keep survives. The score chip matches the snapshot. The cue list has the horn, the sting, a hit, a kill, and the build. The same bus reports the fall. Mute and volume survive a reload. Forge, Spire, and relic copy are on the HUD, and `window.__lastKeep.smoothing` is true. The wave line, relic lines, resource tally, roster, ability keys, and build keys are captions: `assertDiegeticHud` fails an opaque fill, a thick border, or a combined box at the old panel area. The yard base is the concept clearing tile, and the keep stone wears the masonry crop. `tiles.test.js` rebuilds each phase from `theme.jpg` and fails a pixel more than distance 1 from that phase's palette, a block p25 under 8, or a hard edge under 0.05. The night tile is steps 0.50 and 0.40. Collapsing those greens to two colors drops block p25 under 8.
- `joinFromForm` — a bare `/r/<code>` link shows the join form, and Bo the engineer enters Ada's room. Console errors fail the scenario.
- `scoreList` — `GET /api/highscores` has no score of 0 and no blank names.
- `squarePixels` — the buffer aspect and the camera aspect follow the window at 1600×600, 600×1000, and 1280×800. Console errors fail the scenario.
- `heroSilhouettes` — Ada, Lux, Bram, Pip, and Nia stand in one room as warrior, mage, engineer, scout, and farmer. `window.__lastKeep.figures` has five distinct mark, bounds, and part-count signatures. Each card is 28 to 36 world units tall and 20 to 95 internal pixels on the live camera. The live box includes the health bar, and the measured card is 81. The sheet has eight directions, four walk frames, three attack frames, and four death frames, so the part count is 88.
- `paradeShowsEveryKind` — the scripted parade puts goblin, skeleton, wolf, troll, bat, and boss on screen around the host. Each kind is its crop card. `brightNear` reads the bat and the rider. Each needs at least 24 pixels 18 luma above the yard patch. The parade is skipped when `BASE_URL` is set.
- `shotsDoNotGrowGeometries` — a mage holds attack until more than one bolt is in flight. After the bolts are gone, `window.__lastKeepPerf.geometries` is at most two above the count from before the volley.
- `townGrows` — Ada the farmer hosts and Bob the warrior joins. Four free sows bank labor and spend no wood. Raising the keep stakes four houses on the new ring and two crofts the farmer did not click. The house sample reads above the grass. After that raise, a walk west past x=-700 still keeps the roster and the relic lines off the build bar. Console errors fail the scenario.
- `mobileTouch` — a touch phone in landscape creates a game, walks with the left joystick, casts Q from the portrait button, and places a wall from the context button. Build buttons name the building and its cost, with no digit and no `LMB`, and every touch target is at least 44px. The three sacks do not overlap. West of the keep, past x=-700, the roster and the relic lines stay off the build bar, off each other, and off the thumb pad. The same page in portrait covers the viewport with the rotate card. A desktop context keeps the touch pad hidden and keeps the build digits. `padSlot("feed")` is `f`, the same bit the finger-up clears.
- `phoneClear` — at 844×390, 667×375, and 932×430, no sack, caption, call, or button overlaps another. The poses are beside the keep, west of x=-700, after the keep is raised, and during a goblin call more than 400 from the keep on the side opposite the pack. Touch targets stay at least 44px.
- `captionsClearTheBuilds` — one hero walks west past x=-700. The roster and the relic lines do not overlap the build bar, the skill captions, or each other.

`assertWaveClear` runs while the party waits at the keep and again after the host walks. The wave line stays inside the window and off the sacks, the relic lines, the heart, the roster, the name, the calls, and the raise, skill, and build controls.

The browser reads `window.__lastKeep` (tick, phase, wood, buildings, town, dirt, ring, structures, monsters, figures, rangeRing, audio, projectiles, log, labels, kinds, attackCd, shownWave, smoothing, renders, `toClient`, `redNear`, `brightNear`) and `window.__lastKeepTest` (`blur`, `hold`, `mute`, `volume`, `hear`, `parade`). Those hooks are the same ones this skill's run uses. Do not add a second script. The five-player walk also requires an idle seat to paint fewer than 12 frames in one second, and the warrior still has to travel more than 20. `movementIsInterpolated` keeps sampling until that travel and an open blend are both true. Stopping at the first open sample can land under 20.

Server rules that the browser cannot force (a refused cost, Fireball damage, the shown-wave step, elite armor, a fast lunge, a boss slam, a wounded hero staying wounded when the keep falls, a raise from the woods, a wave clock that keeps moving after frenzy) are ExUnit tests in `test/last_keep/game/sim_test.exs`. The wave phase changes on every tick while the keep stands and hold is false. A paid raise stakes houses from the reported woods. Feed still needs the hero beside the keep. `test/last_keep/game/world_test.exs` requires one seed to rebuild the same land, a clear keep disc, a path to every point of interest, and a mirror disagreement of at least 0.35. The walk clamp is 7200. `test/last_keep/game/explore_test.exs` requires a chest to pay 24 gold once and a broken portal to leave the next night, with night 1 still two goblins. `exploreLand` walks to a chest, reads the gold sack, breaks the nearest portal, and reads a wave that skips that bearing. The detour stays inside 20 seconds and keeps going until the remaining segment misses the keep, because a radius of 180 can still aim through the west face. `test/last_keep/game/resource_test.exs` requires an engineer to take 2 stone a tick, any other hero to take 1, a sow on pine to spend nothing, and a stone wall to have 280 health while a wood wall stays at 170. `test/last_keep/game/room_test.exs` requires an empty room to stop ticking, five abandoned rooms to terminate, and the supervisor count to return to the count from before those rooms existed. Run `mix test` as well.

## Evidence

Write screenshots to `tmp/verify-artifacts/`. `twoPlayerNight` writes `coop-host.png`, `coop-guest.png`, `reason-host.png`, `wall-host.png`, `wave-host.png`, `wave-guest.png`, `combat-host.png`, and `cleared-host.png`. `joinFromForm` writes `form-join.png`. `heroSilhouettes` writes `heroes-host.png`. `mobileTouch` writes `mobile-landscape.png` and `mobile-portrait.png`. Cleanup does not delete that directory.

A passing run shows both players, a placed wall, the refusal reason, goblins on the yard inside the camera, a damage number, and a cleared wave. A roster assertion without the screenshot is not proof. A monster count without red pixels at the goblin's projected position is not proof.

## Cleanup

Stop the `mix phx.server` process you started. Do not kill every `beam` on the machine. Leave `tmp/verify-artifacts/` in place.

## Helpers

`npx playwright test` is the harness. `npm test --prefix assets` checks the modules under `assets/js` that the scenarios depend on: invite parsing, snapshot drawing, the wave label, the focus click, placement reasons, relic copy, interpolation, the frame aspect, elite looks, the audio cue map, hero signatures, monster spread, the build ring, edge-call placement, and the joystick vector. `npm run check --prefix assets` typechecks those modules. `mix test --cover` is the coverage floor in `docs/VERIFICATION.md`. The feature map is `features/README.md`. It names the same functions and does not repeat their steps.
