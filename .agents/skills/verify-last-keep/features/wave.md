# See the wave

Monsters from wave 1 are on the canvas, in both browsers.

## Sub-features

- `wave-label` `[data-wave]` reads `Wave 1`.
- `mesh-count` `window.__lastKeep.counts.monsters` is at least 2.
- `magenta-mark` the canvas contains magenta marker pixels that are absent during the build.

## How to get to it (user POV)

- Stay in the room through the build timer. The first build is 20 seconds.

## Driving it with Playwright

Preconditions: the host is in a fresh room.

- During the build, `window.__lastKeep.counts.monsters` is 0.
- Wait until `[data-wave]` matches `Wave `.
- Wait until the monster count is at least 2 on the host and the guest.
- Count canvas pixels with `r > 200`, `b > 120`, and `g < 80`. Require more than 8.
- Save `tmp/verify-artifacts/wave-host.png` and `wave-guest.png`.

## Gotchas

- The build lasts about 20 seconds. A shorter wait sees an empty yard and is not a wave proof.
- The keep roof is red and is not the magenta mark. A red pixel is not a monster.
- Socket JSON that lists goblins is not proof they were drawn.
