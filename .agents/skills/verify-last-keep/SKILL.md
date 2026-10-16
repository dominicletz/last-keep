---
name: verify-last-keep
description: "Drive Last Keep in real browsers and prove two players share a room and that monsters render during a wave. Use before calling any Last Keep change done, and after a production deploy."
disable-model-invocation: true
---

# Verify Last Keep

This is the definition of done. `mix test` does not replace it. Run the Playwright suite against the server you changed. After a deploy, run the same suite with `BASE_URL` set to the live origin.

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

The suite is `e2e/coop.spec.js`. It uses two browser contexts.

- Host: open `/`, fill `#player-name` with `Ada`, submit `#create-button`.
- Guest with an invite query: open `/r/<code>?name=LLL&hero=mage`. `#join-game` is hidden. Both `[data-roster]` elements contain `Ada` and `LLL`.
- Guest with a bare link: open `/r/<code>`, fill `#player-name` with `Bo`, check `input[value=engineer]`, submit `#join-game button[type=submit]`. Both rosters contain `Bo`.
- Wave: wait until `[data-wave]` matches `Wave `. `window.__lastKeep.counts.monsters` is at least 2 in both browsers. The canvas has magenta marker pixels (`r > 200`, `b > 120`, `g < 80`). Those pixels are the monster mark, not the keep roof.

## Evidence

Write screenshots to `tmp/verify-artifacts/`. The suite writes `build-host.png`, `coop-host.png`, `coop-guest.png`, `wave-host.png`, `wave-guest.png`, and `form-join.png`. Cleanup does not delete that directory.

A passing run shows the guest inside the room before the wave, and monsters on the wave screenshot. A roster assertion without the screenshot is not proof. A snapshot count without magenta pixels is not proof.

## Cleanup

Stop the `mix phx.server` process you started. Do not kill every `beam` on the machine. Leave `tmp/verify-artifacts/` in place.

## Helpers

`npx playwright test` is the harness. `npm test --prefix assets` checks invite parsing, camera-relative movement, and that a snapshot goblin stays in the draw list. `npm run check --prefix assets` typechecks those modules. The feature map is `features/README.md`.
