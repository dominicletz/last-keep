# Last Keep agent guide

Last Keep is an authoritative multiplayer game. Elixir owns the simulation. The browser renders it.

## pstack

pstack is the workflow for this repo. The skills are installed under `.agents/skills` from [backnotprop/pstack](https://github.com/backnotprop/pstack), targeted at Cursor (`npx skills add backnotprop/pstack --agent cursor --copy`). Use poteto-mode for feature work. `skills-lock.json` records the installed versions. Restore them with `npx skills experimental_install` when the lockfile is the source you trust.

Before you say a change is done, run `.agents/skills/verify-last-keep/SKILL.md`. That skill is the definition of done. It drives two real browsers against the running game. A green `mix test --cover` is not a substitute.

Every change ships with tests. A simulation change needs an ExUnit test. A browser change needs a scenario in `e2e/scenarios.js` and the spec that calls it. The verification skill points at that file. Do not describe a check only in prose.

## Interactions

`docs/GAME-INTERACTIONS.md` is the source of truth for how roles, the keep, buildings, resources, monsters, elites, bosses, and relics touch. `docs/interactions.json` is the graph the test reads. `test/last_keep/game/interactions_test.exs` fails when a hero from `Rules.heroes/0` is missing, a resource has no producer or no consumer, a building has no cost or no purpose, or an edge is neither implemented in the simulation source nor marked planned. Gameplay and game-logic playtests review that page. The playtest roster is `.agents/skills/playtest-last-keep/SKILL.md`.

## Models

`STYLE.md` is the art loop. `npm run models` is the check, and `.agents/skills/verify-assets/SKILL.md` is the definition of that check. The command reads `assets/models/`, renders every Rules kind and yard prop at game zoom under day, dusk, and night, and fails unless the second run matches `test/gallery/`. `docs/gallery.html` shows those frames beside the concept crop. The concept sheets are `docs/concept/heroes.jpg`, `monsters.jpg`, and `theme.jpg`. Every palette token cites one of those sheets and a region, and the hex is the jpeg-js median of that patch. Do not invent a substitute sheet. The town kit is the ranked keep, the palisade, the wheat, the thatched house, the dirt paths, and the keep torch. The plaza is the grass token, ringed in stone. The keep is a stone belfry with timber houses and pines. Its body is the shadowed belfry stone, with a lighter course and mortar, and a thatch roof. The live page reports those masonry colors on `townLook.keepColors`. The gallery sky is the concept dusk rather than a brick fill. A harvestable tree is a layered pine. The seventy slots are stumps and felled logs, in three rings, with no wood and no crown. The five heroes are the shield, the staff and gem, the hood, the straw brim, and the apron. A 1280×800 window is a 640×400 buffer, and each hero is at least 56 internal pixels tall at rank 0 and at rank 4. Hero and monster portraits are the day close-up, about 80px tall, beside the concept crop. The warrior plate is the light grey from the hero sheet, and a brown close-up fails that crop check. Day light stays neutral so the grey is not clipped to orange. The HUD keeps four skills and six builds on the glass. Wood, food, and gold are sacks on the yard, the next pack is a beacon on its approach bearing, and the keep sign, relic lines, the heart, and the roster are pinned in the world. `assertDiegeticHud` fails when those slots sit on an opaque panel, cover the old panel area, or when the glass count is not 10. The six monsters are the goblin, the skeleton, the wolf, the ogre, the bat, and the dark rider. Night 1 is still two goblins. Heroes are camera-facing cards cut from `heroes.jpg`, eight directions and a four-frame walk, world height 32. Monsters stay voxel grids. The voxel detail floor is 12, so three boxes fail, and a hero card counts its opaque pixels toward that floor. In the yard, waiting and most of the build stay on that day rig, the last eight seconds of the build are dusk, and a wave is night.

## Verification ratchet

Each round adds a test for every backlog item it closes and links that test from `playtests/BACKLOG.md`. It updates `.agents/skills/verify-last-keep` and `.agents/skills/playtest-last-keep` with what the round taught. CI fails on browser console errors, reports coverage, and keeps a floor that only rises. The changelog is `docs/VERIFICATION.md`. A post-deploy smoke runs the same Playwright suite. Do not skip or loosen a check.

A color or hue probe samples the object's own pixels. `sampleObject` renders that mesh or sprite alone, keeps the fragments that are not the clear color, and `maskedStats` takes the median. Fewer than 24 object pixels throws `sample short` with the count. Do not add a single-point `readPixels` probe under `e2e`. `e2e/probe.test.js` fails the run when one appears. A scripted walk uses `walkUntil`. It returns when the server position matches and throws that position on timeout. A key hold is not the arrival. The poll inside `walkUntil` is only how often the position is read.

Other lanes change visual checks only through that helper. The day yard is `yardGrade`, dusk plate, pine, and stone are `duskGrade`, the night ground is `nightGrade`, and the movement blend window is `blend`. Do not edit those probes inside `twoPlayerNight` or `movementIsInterpolated`. `e2e/probe.test.js` fails when the scenario owns the sample points, the frame read, or the blend thresholds.

## Layout

- `lib/last_keep/game/sim.ex` is the pure tick. A `State` struct is the whole world. `phase` is `{:build, ticks}`, `{:wave, ticks}`, or `:over`.
- `lib/last_keep/game/room.ex` is one GenServer per room. It ticks at 20 Hz and broadcasts a snapshot on `Phoenix.PubSub`.
- `lib/last_keep_web/channels/game_channel.ex` receives input and pushes snapshots. The HTTP controllers create rooms and hand out reconnect tokens.
- `assets/js` is the Three.js client. The buffer follows the window so a world square stays square, and the page scales that buffer with nearest-neighbor sampling.

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
mix test --cover
npm test --prefix assets
npm run check --prefix assets
npm ci
node --test e2e/steer.test.js e2e/probe.test.js
npx playwright test
```

`mix test --cover` covers room membership, reconnect, combat, wave plans, the interaction graph, the HTTP API, a channel with three clients, and a warrior who clears wave 1. The coverage floor is 62, from a measured total of 62.90%. Tests that touch the room supervisor are `async: false` because the registry is a single process.

`npx playwright test` is the browser proof. The scenarios are `e2e/scenarios.js`, called from `e2e/coop.spec.js`. The run uses a 1280 by 800 viewport. It joins two players, ignores the click that only focuses the window, refuses an illegal wall without spending wood, places a legal wall, and fights wave 1 until a goblin dies on screen with a damage number. Set `BASE_URL` to point it at a deployed site. Unset `BASE_URL` for a local run. CI and the deploy workflow both run it.

## Deploy

`Dockerfile.prod` builds the release on `elixir:1.18.4-otp-28` and runs it on `debian:trixie-slim`, so the glibc matches. `.github/workflows/deploy.yml` generates `SECRET_KEY_BASE` on the server only when `.env` is missing. Do not bake that value into the image or the repo.

## Pull requests

As soon as a PR is open, turn on GitHub auto-merge with squash: `gh pr merge <number> --squash --auto`. The repo has `allow_auto_merge` on, and `main` requires the CI `test` check, so the PR merges itself once that check is green.

Before writing a final report, run `gh pr checks <n> --watch --fail-fast`. Then wait until `gh pr view <n>` shows the PR merged, and wait until the Deploy production run on that merge commit completes, for example `gh run watch <run-id> --exit-status`. A final report that says "waiting on CI" or "auto-merge armed" is a rule violation. If a check or the deploy is red, fix the root cause and repeat the wait. Do not end the run on a pending or red CI run or deploy on `main`. A red CI run on `main` counts the same as a red deploy.

Never end a run while one of your PRs is green and unmerged, or while a deploy on `main` is pending or red. Every run ends with an explicit next step you have already started.
