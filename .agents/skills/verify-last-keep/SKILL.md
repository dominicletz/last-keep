---
name: verify-last-keep
description: "Drive Last Keep in real browsers at 1280x800 and prove two players can start a night, place a wall, see goblins on the yard, and kill one. Use before calling any Last Keep change done, and after a production deploy."
disable-model-invocation: true
---

# Verify Last Keep

This is the definition of done. `mix test` does not replace it. A passing run that only counts meshes, or that never clicks, is not done. Run the Playwright suite against the server you changed. After a deploy, run the same suite with `BASE_URL` set to the live origin.

## Launch

From the repo root, with Elixir 1.18 and OTP 28 on `PATH`:

```sh
mix setup
npm ci
npm ci --prefix assets
npx playwright install chromium
PORT=4000 mix phx.server
```

Ready means `curl -fsS http://127.0.0.1:4000/` contains `Last Keep` and the body contains `Create game`. A socket that accepts TCP is not ready.

`npx playwright test` starts that server itself when `BASE_URL` is unset and port 4000 is free. If a server you started is already on port 4000, the suite reuses it. Restart that server after a code change or the browser will prove the old build.

The viewport is 1280 by 800. That is the size a manual playtest uses. Do not shrink it to make a sprite fit.

## Doctor

```sh
curl -fsS "${BASE_URL:-http://127.0.0.1:4000}/" | grep -q "Create game"
```

Stop if that fails. Do not drive a server this run did not start, except the production origin after a deploy of the commit you are proving.

## Drive

```sh
npx playwright test
```

Against a deployed site:

```sh
BASE_URL=https://agentyard.letz.tw npx playwright test
```

The suite is `e2e/coop.spec.js`. It uses two browser contexts at 1280 by 800 and drives the page with clicks and keys.

- Host: open `/`, fill `#player-name` with `Bob`, check warrior, submit `#create-button`.
- Guest with an invite query: open `/r/<code>?name=LLL&hero=mage`. `#join-game` is hidden. Both `[data-roster]` elements contain `Bob`, `LLL`, `Warrior`, and `Mage`.
- Before anyone starts, `[data-clock]` is `Waiting to start`. The host `[data-start]` reads `Start the night`. The guest button reads `Waiting for the host`. `[data-skill-name="attack"]` reads `Strike`. The wall button contains `8 wood`.
- Wall: press `Digit1`, click a yard point just ahead of the hero (`window.__lastKeep.toClient`), and wait until wood drops and `buildings` is at least 1. Press `Escape` so the next click attacks.
- Night: the host clicks `[data-start]`. The wave does not begin on room creation.
- Wave: `window.__lastKeep.monsters` has at least 2 goblins, every one `onScreen`, and `redNear` at one of them is greater than 8. `[data-hints]` does not contain an edge label like `goblin 2`. `[data-clock]` contains `Frenzy`. The two clients read keep HP within 40 of each other at the same moment.
- Fight: both browsers hold WASD and click the goblin for up to 50 seconds. `kills` reaches at least 1 from that input. The phase returns to `build` with keep HP above 0.
- Guest with a bare link: open `/r/<code>`, fill `#player-name` with `Bo`, check engineer, submit the join form. The roster contains `Bo`.
- Scores: `GET /api/highscores` has no row with score 0 and no row whose names are blank.

`[data-restart]` on the fallen-keep panel calls the `restart` channel event. It is a button, not a link home. `mix test` covers that the same party is still in the room and the night waits again.

## Evidence

Write screenshots to `tmp/verify-artifacts/`. The suite writes `coop-host.png`, `coop-guest.png`, `wall-host.png`, `wave-host.png`, `wave-guest.png`, `cleared-host.png`, and `form-join.png`. Cleanup does not delete that directory.

A passing run shows both players, a placed wall, goblins on the yard inside the camera, and a cleared wave. A roster assertion without the screenshot is not proof. A monster count without red pixels at the goblin's projected position is not proof. A magenta pixel anywhere on the canvas is not proof.

## Cleanup

Stop the `mix phx.server` process you started. Do not kill every `beam` on the machine. Leave `tmp/verify-artifacts/` in place.

## Helpers

`npx playwright test` is the harness. `npm test --prefix assets` checks invite parsing, camera-relative movement, and that a snapshot goblin stays in the draw list. `npm run check --prefix assets` typechecks those modules. The feature map is `features/README.md`.
