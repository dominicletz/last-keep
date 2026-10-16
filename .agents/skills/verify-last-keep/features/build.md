# Place a wall

Inside `twoPlayerNight`, read these functions in `e2e/scenarios.js`:

- `focusClickDoesNotAttack` — `window.__lastKeepTest.blur()` then a canvas click leaves `attackCd` at 0 and wood unchanged. The next click does swing.
- `clickDoesNotSpendWithoutABuilding` — a yard click with no building armed leaves wood and `buildings` unchanged.
- `invalidPlacementExplains` — Wall armed, click the keep. `[data-build-reason]` names the keep, the log records a deny, and wood does not drop.
- `placeWall` — the yard click spends wood, `buildings` is at least 1, and the Wall button loses `.on`.

A red ghost without a reason is a failure. Wood that drops with `buildings` still 0 is a failure.
