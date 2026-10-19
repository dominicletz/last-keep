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
- [See the wave and fight it](./wave.md) is `expectGoblinsOnYard`, `fight`, `assertCombat`, `assertWaveStable`, `assertBonuses`, `assertWaveClear`, and `movementIsInterpolated` inside `twoPlayerNight`.
- [Scores](./wave.md) also covers `scoreList` and the in-game `[data-score]` chip.
- Square pixels are `squarePixels`, the spec "the picture stays square when the window changes shape".
- Role interactions are `docs/GAME-INTERACTIONS.md`, checked by `test/last_keep/game/interactions_test.exs`.
- The map table is `readTheMap`. The cloth is in the world at (0, 160). The walk stops inside radius 70 and the timeout stays 20 seconds. The glass count stays 10.
- Claimed land is `holdTheLand`. A wall past the keep disc says the land is not held until that portal falls. The portal walk stays 70 seconds. A barricade on that land spends no wood until the chunk is claimed.
- Pine wood is `chopThePine`. The seed-5 pine at (432, 0) pays the wood sack. The walk stays 20 seconds. A yard tree within 48 takes the chop. The seventy bare trunks stay bare.
- A camp is `wakeTheCamp`. The seed-5 yard chest at (216, 720) pays the gold sack, and the walk to the camp at (-3852, -3384) stays 120 seconds. Gold reads 16 and one vagrant stands. The ally is not a seat. The chest wait stays 45 seconds.
- A shrine is `takeTheShrine`. The seed-5 shrine at (4140, 0) grants one relic. The walk stays 120 seconds.
- A hermit is `meetTheHermit`. The seed-5 hermit at (-5724, -648) reveals the chunk two steps west. The walk stays 120 seconds. A second visit does not open a further ring.
- Phone touch is `mobileTouch` in `e2e/mobile.spec.js`. A landscape touch viewport joins, walks, casts, and builds. Portrait is the rotate prompt. `phoneClear` asserts no HUD overlap at 844×390, 667×375, and 932×430 beside the keep, west of x=-700, after the raise, and during a goblin call more than 400 from the keep on the side opposite the pack. If the sweep walks a goblin into frame, the seat steps away, and the call is the `walkUntil` sample whose text says goblin. Ada, Lux, Bram, and Pip join together, and the roster wait reads `__lastKeep.seats`.
