# Verification ratchet

The floor only goes up. A round may add a check. It does not skip, weaken, or delete one.

The backlog is [`playtests/BACKLOG.md`](../playtests/BACKLOG.md). The interaction graph is [`GAME-INTERACTIONS.md`](GAME-INTERACTIONS.md).

## 2026-10-16 onboarding and clarity

- `joinFromForm` and `squarePixels` fail the run when the page throws or the console logs an error. `twoPlayerNight` already did.
- `twoPlayerNight` now requires a rising damage floater, a score chip that matches the snapshot, a placement reason that hides, a wall placed by one click after the window blurs, and movement that interpolates.
- `squarePixels` checks that the buffer aspect and the camera aspect follow the window at 1600×600, 600×1000, and 1280×800.
- `test/last_keep/game/interactions_test.exs` checks `docs/interactions.json` against `Rules.heroes/0`, resource producers and consumers, building cost and purpose, and that every edge is implemented in the simulation source or marked planned.
- Coverage is reported by `mix test --cover`. The measured total on this round is 62.90%. The floor in `mix.exs` is 62. CI runs that command. The next round may raise 62. It may not lower it.

## 2026-10-16 playtest round 1

- `e2e/playtest.spec.js` joins four heroes, requires the warrior to walk, requires the name Ada on the figure, the You line, and the roster row, requires the next line to say "2 goblins", and requires the invite button to end inside the 1280px window.
- `assets/js/hud.test.js` requires "Next: 2 goblins" and "Next: 1 wolf".
- "two goblins that share a spot step apart" requires the gap to be at least the sum of their radii.

## 2026-10-17 bodies, town, and readiness

- "a gap in a long wall lets goblins through one at a time" requires one goblin through the slot and two goblins filed through with at most one in the slot.
- "heroes and monsters stop on each other, and only the warrior dash passes" requires hero-hero and hero-monster separation, a warrior dash past the body, and a scout dash that stops.
- "the keep is solid and a monster bites it from the edge" requires the hero outside the keep and a bite that lands from outside.
- "wave 1 goblins spawn well outside the yard" requires the ring between 600 and 680. "wave 2 does not spawn in the yard" requires the next ring between 740 and 900 on the tick the wave starts.
- "raising the keep spends wood and gold and widens the town" requires a refuse away from the keep, a paid rank, a wider build, and a stop at rank 4.
- `town.test.js` and `frame.test.js` require the camera, dirt, and frustum to grow with rank. `scenery.test.js` requires the outer ring to be bare trunks with no wood. `hud.test.js` requires the raise button to name its cost.
- `e2e/playtest.spec.js` joins five specialists and still requires the warrior to walk, the name, the next line, and the invite button inside 1280px.
- `GET /health` returns `{"ok": true}`. The deploy waits on `https://agentyard.letz.tw/health` before `npx playwright test`. The smoke assertions are unchanged.
- Coverage measured by `mix test --cover` is 68.11%. The floor in `mix.exs` is 68. The next round may raise 68. It may not lower it.

## 2026-10-17 specialist round 3

- `cull.test.js` requires a monster whose normalized device coordinate is outside the camera, or whose depth is outside the near and far planes, to be left undrawn. Heroes and monsters both use that check before the frame is drawn.
- `hud.test.js` requires two goblins in one direction to share the call "2 goblins", and requires the raise control to stay inert until wood and gold both cover the cost.
- `e2e/playtest.spec.js` requires the invite button, the raise button, and the roster to sit inside 1280×800 and to keep their boxes apart. The warrior still has to walk. Each seat is brought to the front before the roster is read and before the walk, so a background tab still has to show the names and still has to move. The raise control has to be disabled while gold is 0. The browser server for that suite starts with `PLAYWRIGHT=1`, which turns off the asset watcher and live reload so a rebuild cannot wipe the roster mid-check. In CI the browser checks run one at a time, so a second window cannot push the measured page into the background. A held key is applied in the page. The walk still has to pass 20, and the movement sample still has to be longer than 5 frames. Wave 1 is recorded as soon as the goblins are on the yard, and the wave list still has to contain 1 and 2.
- This pass does not change the Elixir simulation. The coverage floor stays 68.

## 2026-10-17 audio and silhouettes

- `assets/js/audio.test.js` maps a wave start to the night loop and the horn, a clear to the day loop and the sting, a keep bite to `keep-hit`, a slam plus a monster hit to `keep-hit` and `hit`, and a fall to `fall`. Mute and volume round-trip through storage, and a repeated tick does not replay the cue.
- `twoPlayerNight` requires the horn and the night loop after the host starts, the build cue from the wall, the hit and kill cues from the fight, the sting when wave 1 clears, and a fall cue from the same bus. Mute and volume survive a reload. The build ring is on while a wall is armed and its radius is the hero's reach. Two goblins on the yard have draw offsets at least 16 apart. An edge call's box does not cover the roster.
- `heroSilhouettes` puts warrior, mage, engineer, scout, and farmer in one room and requires five distinct mark, bounds, and part-count signatures on `window.__lastKeep.figures`.
- `heroes.test.js` requires those five signatures. `bodies.test.js` requires the pair offset. `hud.test.js` requires an edge call to stop short of the roster box and the build ring to follow the armed reach.
- CI fails a flaky Playwright pass, and it fails if `assets/js/audio.js` contains a remote URL.
- This pass does not change the Elixir simulation. The coverage floor stays 68.

## 2026-10-17 empty rooms

- A room used to keep running the simulation for ten minutes after the last browser disconnected. The deploy smoke opens a room per scenario, so those sims were still ticking when the five-player walk started and that walk hung for the full 150 seconds.
- An empty room now freezes the sim on the next tick. If a player had connected, the process terminates after 4 seconds, which is long enough to reload and short enough that the supervisor count is back to baseline before the next scenario. The supervisor does not start that room again. A room nobody ever opened lasts 60 seconds.
- A tick that had already fired could not be cancelled. The next join dropped that ref and started a second clock, so a five-player room ran at 40Hz or faster and the browser stopped answering. The live clock is the timer ref stored on the room. `a stale tick does not start a second clock` sends an extra tick and requires the following half-second to advance at most 14 ticks.
- `an empty room stops ticking and the room count returns to baseline` disconnects the only player, requires the tick to stop, requires a reconnect in that window to keep the room, then requires the process to be gone within 2 seconds and `Rooms.count/0` to equal the count from before the room existed.
- Coverage measured by `mix test --cover` is 69.48%. The floor in `mix.exs` is 69.
- A hidden join field that kept focus swallowed every movement push, so the five-player walk could sit at travel 0 while the page was still answering. `isTypingTarget` ignores a field inside `[hidden]`.
- Blurring that field from a focus listener moved focus onto the next hidden control and the listener ran again. The page stopped answering, so the walk's poll and the build-ring wait sat until the 150 second test timeout. `blurHiddenFocus` blurs once and will not re-enter. Concealing the join form also sets `inert`, so the browser cannot focus it. `blurring a hidden field does not chase focus` covers the re-entry. The walk still has to pass 20.
- Headless Chrome keeps every page visible, so five shadow maps never gave the page a turn and the walk evaluate did not return. Scenery no longer casts shadows, the shadow map is 256, and a page with no recent key or click paints at 4Hz. The five-player walk measures an idle seat and requires fewer than 12 paints in one second. The warrior still has to travel more than 20.
- `five abandoned rooms stop and the count returns to baseline` opens five rooms, disconnects each, and requires every process to be gone within 2 seconds with `Rooms.count/0` back at the count from before they existed.

## 2026-10-17 asset pipeline

- `npm run models` renders every hero, monster, building, and yard prop at the 1280×800 rank-0 pixel buffer, in day, dusk, and night. A second run has to match the first. A frame that differs from `test/gallery/` fails. The pixel threshold is 0.
- The same command rejects a material color that is not a `STYLE.md` token, a silhouette under the recorded minimum, a same-family intersection-over-union at or above 0.85, a mesh past twice its gameplay radius, and a Rules kind with no model, no style row, or no concept mapping.
- `fidelity.test.js` keeps the round-5 scores and fails a later lower score with an empty reason.
- The concept sheets are not in the repo. The gallery says so. This pass does not change the Elixir simulation. The coverage floor stays 69.
