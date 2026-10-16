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
