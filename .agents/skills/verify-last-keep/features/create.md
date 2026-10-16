# Create a game

A named hero creates a room and lands in it. The night waits.

## Sub-features

- `create-room` submits the landing form and opens `/r/<code>`.
- `host-visible` shows the host name and `Warrior` in `[data-roster]`.
- `waiting` `[data-clock]` reads `Waiting to start` and `[data-start]` reads `Start the night`.

## How to get to it (user POV)

- Open `/` and submit the create form.

## Driving it with Playwright

Preconditions: the landing page contains `Create game`. Viewport is 1280 by 800.

- Fill `#player-name` with `Bob` and check `input[value=warrior]`.
- Click `#create-button`.
- The URL matches `/r/` plus a room code. `[data-roster]` contains `Bob` and `Warrior`. `#hud` is visible.
- `[data-clock]` is `Waiting to start`.

## Gotchas

- A server that was not restarted after a client change still serves the old bundle. The roster can pass while the canvas is stale.
- The build clock used to start at room creation. A second player who arrives late found a fallen keep. The host button is what starts the night.
