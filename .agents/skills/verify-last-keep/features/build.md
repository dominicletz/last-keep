# Place a wall

Pressing 1 and clicking the yard spends wood and leaves a wall.

## Sub-features

- `cost` `[data-build="wall"]` contains `8 wood`.
- `ghost` selecting wall shows a translucent block at the aim point.
- `spend` wood is lower after the click and `window.__lastKeep.buildings` is at least 1.

## How to get to it (user POV)

- Press `1`. The Wall button highlights and its label shows the wood cost.
- Click open yard inside the hero's reach and outside the keep. A red ghost means the click will be refused.

## Driving it with Playwright

Preconditions: the host is in the room and the night has not started. Viewport is 1280 by 800.

- Read `window.__lastKeep.wood`.
- Press `Digit1`.
- Click `toClient` of a point 48 units ahead of the hero on x and 8 on y.
- Wait until wood is lower and `buildings` is at least 1.
- Press `Escape`.
- Save `tmp/verify-artifacts/wall-host.png`.

## Gotchas

- A click that ends before the next server tick still has to place. The Playwright click is that tap.
- A click on the keep, or farther than the hero's build range, spends nothing. Wood staying at 48 is a failure.
- There is no separate build plot. The yard click is the placement.
