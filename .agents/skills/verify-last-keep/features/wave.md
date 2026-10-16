# See the wave and fight it

Inside `twoPlayerNight`, read these functions in `e2e/scenarios.js`:

- `expectGoblinsOnYard` — at least two monsters, each `onScreen`, `redNear` above 8 on one of them, no `goblin N` edge label, clock contains `Frenzy`, label is `Wave 1`.
- `fight` — both browsers hold WASD and click. The mage also presses `KeyQ`.
- `assertCombat` — the log has a hit with an amount and a death, the Fireball kind was in a snapshot, a boom was recorded, `[data-fx]` showed a digit and `Slain` at a real screen position, and the digit's float-up animation is running.
- `movementIsInterpolated` — hold W and compare `rendered` with `self`. The gap is visible and stays inside one tick.
- After the clear, `[data-score]` matches `window.__lastKeep.score`.
- `assertWaveStable` — sampled `[data-wave]` values match `Wave N`, the numbers never go backwards, and both 1 and 2 appear.
- `assertBonuses` — forge copy contains `15%`, spire copy contains `recover faster`, relic copy mentions a relic, and `smoothing` is true.

`scoreList` checks `GET /api/highscores` for a score above 0 and a non-blank name on every row.

Elixir covers the rules a wave-1 browser cannot set up: refused placement does not pay, Fireball damage, the shown-wave step, armor, a fast lunge, and a boss slam. Those tests are in `test/last_keep/game/sim_test.exs`.
