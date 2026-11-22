# Last Keep — Engineering Handover

**Last updated:** 2026-11-22
**Baseline `main` commit:** `f8ddbcc` (Visual, Camera, FPS, Lighting & HUD Polish — PR #178)
**Live production:** https://agentyard.letz.tw (health check: `GET /health`)
**Design north star:** Kingdom Two Crowns translated into an authoritative 3D/HD-2D cooperative multiplayer world (2–15 players).

All four milestones of [`docs/concepts/ROADMAP.md`](concepts/ROADMAP.md) plus the follow-up visual/camera/FPS/lighting/HUD polish (`#178`) have landed on `main`, and zero `"planned"` edges remain in [`docs/interactions.json`](interactions.json). This guide gives an incoming engineer or agent everything needed to build, verify, extend, and safely ship changes.

---

## 1. Completed Roadmap & Recent PR History

| Milestone / Track | PR(s) | Commit(s) | Summary | Backlog IDs |
| --- | --- | --- | --- | --- |
| **Milestone 1 — P0 Hardening & Hygiene** | #168, #169 | `6357b20`, `6707cf1` | Guard `restart` to `phase == :over` (closes TLC `NoRestartBeforeTheFall`); auto-migrate host to lowest connected seat; `+6%` monster HP per connected hero past 2 (cap 15); rekindle farthest outer portal on wave 2+ when all 6 portals break; fix `tsc` parent `node_modules` leak & esbuild `import.meta` warning; darken undiscovered mist away from day clear sky. | `LK-114`–`LK-118`, `LK-124` |
| **Footprint Collision & POI Reach** | #167, #170 | `a126e85`, `7b322d8` | Painted polygon collision via `priv/footprints.json` (compile-time precompiled edges); fix far-keep-face feeding (`near_keep?`/`raiseInRange`), flat translucent `footprintShadowMat`, night-fogged goblin rim detection (`bodyPixel`), and footprint-edge reach for `camp`/`shrine`/`quarry`. | `LK-125`–`LK-127` |
| **Milestone 2 — Diegetic Clarity, Map Cloth & Visual QA** | #171 | `9521718` | Stone on Wood sack + explicit `Stone Wall` button; `6 Spire` icon; `[F] 5` on Food sack; missing gold/wood `raiseHint`; locked-Meteor styling & toast; client build-ghost parity + right-click cancel; `/r/CODE` live room/party preview; upgraded `56×38` Map Table cloth (`map_cloth.js`); start-screen depth fix (`PORTRAIT_STAND`), `stump_log-sheet.png` scenery, horizon dusk/night dimming & seam fix, mobile SVG skill buttons & compact costs. | `LK-106`, `LK-119`, `LK-128`–`LK-131` |
| **Milestone 3A — KTC Wave 4+ Combat & Frontier Loop** | #172 | `fa90019` | Wave 4+ siege bosses (`290u`) & skeletons (`270u`) outranging passive auto-bolt; `2.5×` wood-wall-breaker Trolls; wall-hopping Bats; portal-break retaliation packs; daytime frontier sprint (`1.35×` past `r = 300`); host `Start night early` horn; contact-based Frenzy; 5-player-safe Camps & targetable vagrants; Merchant POI (`trade_merchant/1`, `merchant-sheet.png`, fog-filtered). | `LK-108`, `LK-120`, `LK-122` |
| **Milestone 3B — Coherent 2D Terrain & Rivers/Fords** | #173 | `b5e8423` | Bit-identical fixed-point stride-8 smoothstep 2D value noise in Elixir & JS producing contiguous forests, meadows, ruins, cliffs, and winding rivers with `144u` walkable fords outside `r = 740`; `World.open?/3` movement blocking; `terrainWaypoint` A* for scripted walks; `320×320` over `4608` horizon window tuning for fast startup. | `LK-121` |
| **Milestone 4 — Performance, Game Feel & Flow-Field Pathing** | #174 | `e535aee` | Losslessly recompressed all 10 `ground-*.png` tiles to 8-bit RGB (`16.48M -> 14.66M`, pixel-identical); hardened horizon distance fog (`1.35×`/`2.6×` span) & `UNSEEN_DAY` (`0x161c18`); change-driven WS input with 250ms heartbeat; shared co-op `[G]` ground pings (`Sim.ping/4`, golden rally ring & floater); layered SFX (`trade`, `ping`, `retaliate`, `fortify`); hit-flash & clamped melee/AoE knockback; pooled Meteor/Slam/Boom AoE rings; post-Rank-4 Keep Fortification (`Sim.fortify/2` + mobile touch context); cached O(1) 8-way corner-safe BFS flow field (`World.flow_dir/3`) for reliable monster navigation across all seeds. | `LK-123` |
| **CI & Mobile Smoke Hardening** | #175, #176, #177 | `4f1c2e6`, `70b67e1`, `853e300` | Initial handover guide; prevented `terrainWaypoint` cliff-corner cuts; scoped `keysAround` keep-clearance override to keep vicinity; pushed `horizonFogNear`/`horizonFogFar` to `1.65×`/`3.0×` span with linear `MIST = 0.8` & `UNSEEN_DAY = 0x0a160c`; let `sixSeatMatch` trigger early dusk after quiet samples; compact touch `sackLine` (`Feast 10` without `[F] 5` on `667×375`) and cliff sidestep in `assertFarCaptions`. | — |
| **Visual, Camera, FPS, Lighting & HUD Polish** | #178 | `f8ddbcc` | Minimized DoF blur (`focusBand = 0.14`, `COC_REACH = 0.3`, `COC_MAX_PX = 4.5`, early-out, half-res blur target); smooth far camera follow (`cameraTetherNear = 240` → `1:1` at `cameraTetherFar = 520`); FPS wins (`testHooks`-gated `paintGap`, 36u-cell `pictureCell` caching in `horizon.js`, `WeakMap`-memoized `sceneKey`, cached `applyFrame` + portrait FOV restore); `objectTintHex` day/dusk/night tinting across unlit world objects/monsters + automatic flickering dusk/night `heroTorch` point light & pooled `heroAura` ground glow; compact inline `.bonuses` and reduced world-pinned HUD text clutter. | `LK-132`–`LK-136` |

For detailed design rationale and test gates, see:
- [`docs/concepts/ROADMAP.md`](concepts/ROADMAP.md) — Kingdom Two Crowns 3D design decisions & milestones
- [`docs/GAME-INTERACTIONS.md`](GAME-INTERACTIONS.md) & [`docs/interactions.json`](interactions.json) — authoritative interaction graph
- [`docs/VERIFICATION.md`](VERIFICATION.md) — append-only verification ratchet log
- [`playtests/BACKLOG.md`](../playtests/BACKLOG.md) — playtest findings & `## Fidelity` baseline table
- [`decisions.tsv`](../decisions.tsv) — chronological architectural decision log
- [`AGENTS.md`](../AGENTS.md) — repository rules, workflow, and definition of done

---

## 2. Architecture & Module Map

Last Keep is strictly split into an **authoritative Elixir simulation** (20 Hz) and a **Three.js HD-2D browser client**. Never put gameplay rules in Phoenix controllers or channels; parse untrusted inputs at the boundary and call `LastKeep.Game.Sim`.

### Elixir Backend (`lib/last_keep/`)

| File | Responsibility |
| --- | --- |
| [`lib/last_keep/game/state.ex`](../lib/last_keep/game/state.ex) | Single `%State{}` struct holding the entire world (`phase`, `wave`, `keep`, `town`, `resources`, `entities`, `world`, `discovered`, `claimed`, `events`, `unsent`, etc.). |
| [`lib/last_keep/game/sim.ex`](../lib/last_keep/game/sim.ex) | Pure 20 Hz simulation tick (`tick/1`), movement & `body_blocked?/5`, combat, hero abilities, building/raising/fortifying (`fortify/2`), co-op pings (`ping/4`), frontier POIs (`trade_merchant/1`, camps, shrines, quarries, hermits), and monster AI (`chase/4` via `World.flow_dir/3`, `squeeze_or_chew/6`, siege, wall-breakers, flyers). Uses `unsent` counter so out-of-tick events (`ping`, `fortify`) survive `bump/1` into the next snapshot broadcast. |
| [`lib/last_keep/game/rules.ex`](../lib/last_keep/game/rules.ex) | Balance constants, hero kits, building/upgrade/fortify costs, `party_hp_scale/1`, `wall_breaker_mult/2`, `flies_over_walls?/1`, `clear_purse/1`, `map_radius/0` (7200). |
| [`lib/last_keep/game/world.ex`](../lib/last_keep/game/world.ex) | Deterministic seeded world generator (`generate/1`, `chunk/3`, `picture/3`, `open?/2`, `open?/3`, `flow_dir/3`). Computes fixed-point stride-8 smoothstep 2D value noise (biomes, cliffs, flanking rivers + 144u fords outside `r = 740`) and caches a 194 KB 8-way corner-safe BFS flow field per seed in the process dictionary. |
| [`lib/last_keep/game/footprint.ex`](../lib/last_keep/game/footprint.ex) | Compile-time precompiled polygon hit tests loaded from `priv/footprints.json` (shared with JS renderer). |
| [`lib/last_keep/game/snapshot.ex`](../lib/last_keep/game/snapshot.ex) | Fog-filtered snapshot serializer pushed to clients over Phoenix Channels (filters unseen POIs including `merchant`, includes `fortify` offer at Rank 4 while keeping `upgrade == nil`). |
| [`lib/last_keep/game/room.ex`](../lib/last_keep/game/room.ex) & [`rooms.ex`](../lib/last_keep/game/rooms.ex) | One GenServer per room ticking at 20 Hz on a single stored timer ref; freezes when empty and terminates after 4s (or 60s if never joined) so supervisor counts return to baseline. |
| [`lib/last_keep/game/waves.ex`](../lib/last_keep/game/waves.ex) & [`highscores.ex`](../lib/last_keep/game/highscores.ex) | Wave composition schedules (6 monster kinds) and persistent score tracking. |
| [`lib/last_keep_web/channels/game_channel.ex`](../lib/last_keep_web/channels/game_channel.ex) | WebSocket boundary (`input`, `start`, `restart`, `ping`, `fortify`, `leave`); validates payloads and delegates to `Room`. |
| [`lib/last_keep_web/controllers/room_controller.ex`](../lib/last_keep_web/controllers/room_controller.ex) | `POST /api/rooms` and `GET /api/rooms/:code` (returns live room `shown_wave` and seated party roles for `/r/CODE`). |

### Browser HD-2D Client (`assets/js/`)

| File | Responsibility |
| --- | --- |
| [`assets/js/play.js`](../assets/js/play.js) | Main session loop: Phoenix Channel connection, change-driven input pushes (`shouldPushInput`, 250ms heartbeat), `[G]` ping & `[R]`/`Fortify` handlers, desktop/mobile HUD syncing, and `window.__lastKeep` / `window.__lastKeepTest` test hooks. |
| [`assets/js/render.js`](../assets/js/render.js) | Single HD-2D perspective renderer (`fov = 15`, no second renderer/flag). Manages hero/monster/building/POI sprites (`merchantMesh`, `vagrant-sheet.png`, `stump_log-sheet.png`), phase tinting (`applyPhaseTint`), pooled dusk/night `heroTorch` + `heroAura`, hit-flash tinting, pooled `ringPulses` (ping/boom/slam/meteor telegraphs), `footprintShadowMat`, cached `applyFrame`, `testHooks`-gated `paintGap`, and dirty-frame tracking (`ringsMoving`). |
| [`assets/js/hd2d/picture.js`](../assets/js/hd2d/picture.js) | HD-2D camera/post-processing pipeline: perspective lens (`LOOK.fov = 15`), start-screen portrait glide (`seat`), day/dusk/night light rigs, bloom, and subtle half-res depth-of-field (`focusBand = 0.14`, `COC_MAX_PX = 4.5`, early-out for `radius < 0.5`). |
| [`assets/js/frame.js`](../assets/js/frame.js) | Viewport sizing, pixel-snapping, `cameraFocus` (`0.72` castle tether inside `r = 240`, smoothly blending to `1:1` hero-centered tracking at `r = 520`), and `WeakMap`-memoized `sceneKey(snap)`. |
| [`assets/js/scene.js`](../assets/js/scene.js) | Day/dusk/night lighting definitions (`lightName`, `cycleLight`), masked color probes, and `objectTintHex(clock, kind)` softening daytime contrast and dimming unlit world sprites/monsters across dusk and night. |
| [`assets/js/world_biome.js`](../assets/js/world_biome.js) | Exact JS mirror of `LastKeep.Game.World` fixed-point noise (`pictureCell`, `isTerrainOpen`) plus cached cell-grid A* (`terrainWaypoint`) for scripted walks across rivers/cliffs. |
| [`assets/js/horizon.js`](../assets/js/horizon.js) | Outer terrain plane (`HORIZON_TEX = 320`, `WINDOW = 4608`, per-cell `pictureCell` caching), `phaseTint` dusk/night dimming, shadow mist (`UNSEEN_DAY = 0x0a160c`, `MIST = 0.8`), and distance fog (`horizonFogNear = 1.65×`, `horizonFogFar = 3.0×` span). |
| [`assets/js/map_cloth.js`](../assets/js/map_cloth.js) | Procedural `56×38` map table cloth canvas drawing one distinct colored mark per discovered, claimed, and portal chunk. |
| [`assets/js/hud.js`](../assets/js/hud.js) & [`touch.js`](../assets/js/touch.js) | Diegetic HUD layout (3 yard sacks with touch-aware `sackLine`, compact inline `.bonuses`, world-pinned signs/roster, 10 glass slots = 4 skills + 6 builds), `raiseHint`/`fortifyLabel`/`placementReason`, and mobile touch controls (floating stick, inline SVG skill icons, compact prices, `Place`/`Raise`/`Fortify`/`Feed` context button). |
| [`assets/js/input.js`](../assets/js/input.js) | `keysToward`, `keysAround`, `followKeys`, `sameInputFrame`, `shouldPushInput`. |
| [`assets/js/audio.js`](../assets/js/audio.js) | Local `/audio/day.mp3` & `/audio/night.mp3` music beds plus synthesized WebAudio cues (`horn`, `clear`, `hit`, `kill`, `build`, `keep-hit`, `fall`, `trade`, `ping`, `retaliate`, `fortify`). No remote URLs allowed. |
| [`assets/js/hd2d/png.js`](../assets/js/hd2d/png.js) | Pure-JS PNG decoder supporting both 8-bit RGB (colorType 2, expanded to RGBA with alpha 255) and 8-bit RGBA (colorType 6) for the losslessly recompressed `ground-*.png` tiles. |

---

## 3. Local Development & Verification Commands

**Toolchain:** Elixir 1.18 + OTP 28 (matches CI and `Dockerfile.prod`), Node 22.

### Run Locally
```sh
mix setup
mix phx.server
# Opens on http://localhost:4000
```

### Full Pre-Push Verification Suite (mirrors `.github/workflows/ci.yml`)
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
node --test e2e/steer.test.js e2e/probe.test.js e2e/roster.test.js e2e/screen.test.js script/ci_budget.test.js
CHROME_PATH=/usr/bin/google-chrome npx playwright test
```

### Targeted Checks
- **Single Playwright spec or scenario:**
  `CHROME_PATH=/usr/bin/google-chrome npx playwright test --project=functional -g "six seats hold"`
- **Smoke set only (what `Deploy production` runs against `BASE_URL`):**
  `CHROME_PATH=/usr/bin/google-chrome npx playwright test --grep @smoke`
- **Asset gallery / concept palette check (`STYLE.md`):**
  `npm run models` (see `.agents/skills/verify-assets/SKILL.md`)
- **Two-browser definition-of-done check:**
  Follow `.agents/skills/verify-last-keep/SKILL.md`

### Current Measured Test Baselines
- `mix test --cover`: **145 tests, 0 failures**, **82.92% total coverage** (floor in `mix.exs`: **78%** — ratchet only upward).
- `npm test --prefix assets`: **323 tests, 0 failures**.
- `npm run check --prefix assets`: `tsc --noEmit` clean (0 errors).
- E2E & CI unit tests: **36 tests, 0 failures**.
- CI `match` (`sixSeatMatch`): **~6m24s** on GitHub Actions (`~4.4m` locally).
- CI functional shards (`browser 1..6`): **~2m–4m16s** each.

### CI, Pull Requests & Production Deployment
- **10-minute wall-clock cap:** Every job in `.github/workflows/ci.yml` sets `timeout-minutes: 10`, and the required `CI/test` gate fails if any completed job exceeds 10 minutes. Never raise `timeout-minutes`; if a functional shard approaches 10m, optimize or add a shard.
- **Auto-merge policy (`AGENTS.md`):** Open a PR, immediately arm `gh pr merge <n> --squash --auto`, wait for `gh pr checks <n> --watch --fail-fast`, confirm the PR merges to `main`, and watch all `main` workflows (`CI`, `Build and push image`, `Deploy production`) to `completed:success` before concluding work.
- **Production release (`Dockerfile.prod` + `.github/workflows/deploy.yml`):** Builds on `elixir:1.18.4-otp-28`, runs on `debian:trixie-slim`, generates `SECRET_KEY_BASE` on the server only when `.env` is absent, waits on `/health`, and runs the `@smoke` Playwright suite under an 8-minute wall cap (`script/deploy_wall.js`).

---

## 4. Critical Invariants & Gotchas

Breaking any of these will immediately trip CI or production smoke checks:

1. **Elixir ↔ JS World Noise Parity:** `lib/last_keep/game/world.ex` and `assets/js/world_biome.js` must compute bit-identical biomes, rivers, cliffs, and fords using fixed-point integer math (never floating-point trig/noise). Guarded by `test/fixtures/horizon_picture.json` and world fingerprint tests in `world_test.exs`.
2. **Flow Field Reachability Parity:** `World.reachable/2` uses 8-way BFS where diagonal transitions require both adjacent cardinal cells to be open. Keep that corner-cut guard so the reachable `MapSet` (and all world POI fingerprints) remain 100% identical to 4-connected fill.
3. **Diegetic HUD Budget (`CHROME_BUDGET = 10`):** Glass HUD must stay at exactly 4 skills + 6 builds (`10` elements), 3 yard sacks, no opaque panels (`assertDiegeticHud`). New UI indicators must be world-pinned or reuse existing slots.
4. **`settledHolds` Geometry/Texture Pool Invariant:** `sixSeatMatch` checks that settled geometries and textures do not climb across waves. Every transient or toggled 3D effect (projectiles, bursts, `ringPulses`, `heroAura`, hit effects) must pool its geometries/materials (`userData.pooled = true`, `role: "shot"`/`"burst"`/`"aura"`) or dispose cleanly when removed.
5. **Rank-4 Keep `upgrade == nil`:** `Snapshot.render(rank4).upgrade` must remain `nil` (`sim_test.exs` and `hud.test.js` assert this). Post-rank-4 fortification lives on its own `snap.fortify` field.
6. **Zero `"planned"` Edges in `docs/interactions.json`:** Any new hero, resource, building, POI, or mechanic must update `docs/GAME-INTERACTIONS.md` and `docs/interactions.json` in the same commit (`interactions_test.exs` validates every edge against `Rules` and `Sim`).
7. **Append-Only `## Fidelity` Table:** Never alter or delete historical rows in `playtests/BACKLOG.md` `## Fidelity` (`fidelity.test.js` enforces monotonic scores unless a non-empty reason is given).
8. **Locked Art Hashes & PNG Channels:** Do not modify `assets/js/hero-data.js` (SHA-256 locked in `VERIFICATION.md`), `tile-data.js`, or `monster-data.js` outside the documented sprite pipeline (`docs/concepts/SPRITE-PIPELINE.md`). All `ground-*.png` tiles are 8-bit RGB; keep `readRgbaPng` in `assets/js/hd2d/png.js` supporting both 3-channel and 4-channel PNGs.
9. **E2E Probe & Steering Rules (`e2e/probe.test.js`, `e2e/steer.test.js`):** Never add raw `readPixels` calls under `e2e/`; route visual grades through the render helpers (`yardGrade`, `duskGrade`, `nightGrade`, `blend`), and drive scripted walks with `walkUntil` (never sleep timers or key holds alone).
10. **Room Supervisor Tests:** Any ExUnit test touching `LastKeep.Game.Rooms` must set `use ExUnit.Case, async: false` because the room registry is a single process.

---

## 5. Known Open Items & Recommended Next Steps

1. **Art Pipeline Finish (`LK-113`, open in `playtests/BACKLOG.md`):**
   - Regenerate/tune the `hermit` `idle-W` clip (start delta `3` vs limit `1`), wire `hermit-sheet.png` on the client (the `merchant-sheet.png` integration in `render.js` is the template), and do final review of the slight three-quarter `v-S` pose on `vagrant` and `merchant`.
2. **Visual Bridges / Ford Landmarks:**
   - Walkable `:ford` cells (`144u` wide) are currently rendered with `ground-ford.png`. Adding lightweight timber bridge posts/planks or lantern markers at ford crossings will make choke points immediately readable as natural Kingdom Two Crowns fortification lines.
3. **Daytime Frontier Life (`docs/concepts/WORLD.md`):**
   - Add ambient daytime wildlife/forageable critters (e.g., deer/boars for Farmer/Scout gold/food) or visible daytime scouting cues to enrich the quiet exploration loop between nights.
4. **Browser Asset Weight Optimization:**
   - The 10 `priv/static/images/hd2d/ground-*.png` tiles were losslessly slimmed from 16.48 MB to 14.66 MB. Serving WebP/AVIF to browsers (with PNG fallback or keeping PNGs for Node unit tests) could cut initial download payload by ~70–80% on mobile connections.
5. **Co-op Polish & End-of-Run Summary:**
   - Add offscreen directional edge indicators for `[G]` teammate pings, optional party ready-check / countdown cue when the host sounds the early-night horn, and a richer fallen-keep summary (per-hero kills, portals claimed, keep rank & fortifications).
6. **Live Playtest Ratchet:**
   - Run the specialist playtest roster (`.agents/skills/playtest-last-keep/SKILL.md`) against https://agentyard.letz.tw after the next visual/gameplay round to continue ratcheting `playtests/BACKLOG.md` and `docs/VERIFICATION.md`.
