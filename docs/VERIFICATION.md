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
