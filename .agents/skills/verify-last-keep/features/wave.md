# See the wave and fight it

Wave 1 goblins stand on the yard, inside the camera, in both browsers. A click kills one. The keep is still standing when the yard is empty.

## Sub-features

- `night-waits` `[data-clock]` reads `Waiting to start` until the host clicks `[data-start]`.
- `on-yard` `window.__lastKeep.monsters` length is at least 2, and every monster has `onScreen`.
- `red-body` `redNear(monster.x, monster.y)` is greater than 8 for at least one goblin. The sample is the goblin's own projection, not a pixel anywhere on the canvas.
- `no-edge-label` `[data-hints]` does not contain `goblin` followed by a count. The next-wave line lives in `[data-next]` during the build only.
- `kill` WASD plus a click raises `kills` to at least 1.
- `cleared` phase returns to `build` with `keep.hp` above 0.
- `same-keep` the two clients' keep HP differ by less than 40 when read together.

## How to get to it (user POV)

- Both players are in the room. The host presses Start the night.
- The clock then reads `Night in` and, once the wave begins, `Frenzy in`.

## Driving it with Playwright

Preconditions: the wall is already placed and build mode is cleared with Escape. Viewport is 1280 by 800.

- Click the host `[data-start]`.
- Wait until `window.__lastKeep.phase` is `wave`.
- Wait until every monster is `onScreen` and one `redNear` count is greater than 8.
- Reject `[data-hints]` text that matches `goblin` plus a number.
- `fight` holds a camera-relative WASD key and clicks `toClient` of the first monster until the phase leaves `wave` or 50 seconds pass.
- Wait until `kills` is at least 1 and the phase is `build` with keep HP above 0.
- Save `tmp/verify-artifacts/wave-host.png`, `wave-guest.png`, and `cleared-host.png`.

## Gotchas

- The night does not start when the room is created. Waiting on a timer without clicking Start the night stays in the build.
- An edge label such as `goblin 2` is a hint clamped to the screen, not a monster. Chasing it walks the hero into the trees and the camera leaves the yard.
- A crest or marker pixel far from the goblin's projection is not a visible monster.
- A click shorter than one server tick still has to attack. The suite's click is that short tap.
- Leaving wall mode selected turns the click into another wall. Press Escape before the fight.
