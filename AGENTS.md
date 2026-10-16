# Last Keep agent guide

Last Keep is an authoritative multiplayer game. Elixir owns the simulation. The browser renders it.

## pstack

pstack is the workflow for this repo. The skills are installed under `.agents/skills` from [backnotprop/pstack](https://github.com/backnotprop/pstack), targeted at Cursor (`npx skills add backnotprop/pstack --agent cursor --copy`). Use poteto-mode for feature work. `skills-lock.json` records the installed versions. Restore them with `npx skills experimental_install` when the lockfile is the source you trust.

Before you say a change is done, run `.agents/skills/verify-last-keep/SKILL.md`. That skill is the definition of done. It drives two real browsers against the running game. A green `mix test` is not a substitute.

## Layout

- `lib/last_keep/game/sim.ex` is the pure tick. A `State` struct is the whole world. `phase` is `{:build, ticks}`, `{:wave, ticks}`, or `:over`.
- `lib/last_keep/game/room.ex` is one GenServer per room. It ticks at 20 Hz and broadcasts a snapshot on `Phoenix.PubSub`.
- `lib/last_keep_web/channels/game_channel.ex` receives input and pushes snapshots. The HTTP controllers create rooms and hand out reconnect tokens.
- `assets/js` is the Three.js client. It draws into a 480 by 270 buffer and the page scales that buffer with nearest-neighbor sampling.

Do not put rules in the channel or the page controller. Parse untrusted input at that boundary and call `LastKeep.Game.Sim`.

## Setup

Elixir 1.18 and OTP 28 match CI and the production image. Node 22 builds the client.

```sh
mix setup
mix phx.server
```

## Checks

Run these before pushing. CI runs the same list.

```sh
mix format --check-formatted
mix compile --warnings-as-errors
mix assets.setup
npm ci --prefix assets
mix assets.build
mix test
npm test --prefix assets
npm run check --prefix assets
npm ci
npx playwright test
```

`mix test` covers room membership, reconnect, combat, wave plans, the HTTP API, a channel with three clients, and a warrior who clears wave 1. Tests that touch the room supervisor are `async: false` because the registry is a single process.

`npx playwright test` is the browser proof. It uses a 1280 by 800 viewport, places a wall, starts the night from the host button, and fights wave 1 with clicks and keys until a goblin dies on screen. Set `BASE_URL` to point it at a deployed site. CI and the deploy workflow both run it.

## Deploy

`Dockerfile.prod` builds the release on `elixir:1.18.4-otp-28` and runs it on `debian:trixie-slim`, so the glibc matches. `.github/workflows/deploy.yml` generates `SECRET_KEY_BASE` on the server only when `.env` is missing. Do not bake that value into the image or the repo.
