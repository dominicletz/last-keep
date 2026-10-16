# Create a game

A named hero creates a room and lands in it.

## Sub-features

- `create-room` submits the landing form and opens `/r/<code>`.
- `host-visible` shows the host name in `[data-roster]`.

## How to get to it (user POV)

- Open `/` and submit the create form.

## Driving it with Playwright

Preconditions: the landing page contains `Create game`.

- Fill `#player-name` with `Ada` and check `input[value=warrior]`.
- Click `#create-button`.
- The URL matches `/r/` plus a room code. `[data-roster]` contains `Ada`. `#hud` is visible.

## Gotchas

- A server that was not restarted after a client change still serves the old bundle. The roster can pass while the canvas is stale.
