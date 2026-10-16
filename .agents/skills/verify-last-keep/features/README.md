# Last Keep verification map

The executable checks are `e2e/scenarios.js`. `npx playwright test` runs them through `e2e/coop.spec.js`. This map names the function to read. It does not restate the clicks.

## Baseline preconditions

- The page at `http://127.0.0.1:4000/` contains `Create game`, or `BASE_URL` points at a deploy of the commit under test.
- Playwright chromium is installed.
- Do not reuse a room code from a previous run.
- Viewport is 1280 by 800, set by the spec.

## Features

- [Create a game](./create.md) is the start of `twoPlayerNight`.
- [Join from an invite](./invite.md) is `twoPlayerNight` for the query invite and `joinFromForm` for the bare link.
- [Place a wall](./build.md) is `focusClickDoesNotAttack`, `clickDoesNotSpendWithoutABuilding`, `invalidPlacementExplains`, and `placeWall` inside `twoPlayerNight`.
- [See the wave and fight it](./wave.md) is `expectGoblinsOnYard`, `fight`, `assertCombat`, `assertWaveStable`, and `assertBonuses` inside `twoPlayerNight`.
- [Scores](./wave.md) also covers `scoreList`.
