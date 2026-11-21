# Kingdom Two Crowns 3D Roadmap

Last Keep takes **Kingdom Two Crowns** as its primary game-design and logic reference, translated into a cooperative 3D/HD-2D multiplayer world (2–15 players).

The core fantasy is: **contemplative daytime frontier expansion + clear diegetic world prompts + racing home at dusk + holding fortified choke points against escalating night threats**, blended with direct action-brawler hero combat (`WASD` + aim + `Q/E/R`).

## Recorded Design Decisions

1. **World scale & day/night frontier loop**:
   - Keep a real wilderness frontier with tiered portal rings (~3,200–3,600 radius: near, mid, and far portals) rather than a cramped arena or an unreachable 7,200-radius desert.
   - Lengthen daytime build phases (60–75s) with a host/party **"Start night early"** horn, and give heroes an out-of-combat **daytime sprint / mount pace** so riding out to quarries, shrines, and camps and racing home at dusk feels like Kingdom Two Crowns.
   - Trigger **Frenzy** relative to **combat contact** (first monster within radius ~600 or engaging a wall/hero), never while slow monsters are still marching from a distant portal.
   - Breaking a portal claims its chunk and triggers a **retaliation wave**; clearing all six portals rekindles the farthest outer portal on the next night (Kingdom Two Crowns cliff-portal rule) so an endless run never collapses into empty waves.

2. **Passive "drawn swing" (`LK-108`) & Wave 4+ Threats**:
   - Keep the in-range auto-swing (it matches Kingdom Two Crowns' accessible defense feel and mobile play), optionally tuning passive cadence (~70% vs. active clicks) so active aiming stays strictly stronger.
   - Make Wave 4+ demand movement, walls, and abilities via Kingdom Two Crowns enemy archetypes:
     - **Siege / ranged threats** firing from range 240–280 (outside the 200-unit auto-bolt).
     - **Wall-breakers** (Trolls dealing 2×–3× structural damage to wood walls, making stone walls + Engineer repair vital).
     - **Wall-bypassing flyers** (Bats flying over walls to dive heroes/keep).

3. **Coherent Radial Terrain**:
   - Replace per-cell white-noise hashing in `lib/last_keep/game/world.ex` with **seeded coherent 2D noise** producing contiguous pine forests, fertile meadow clearings, and ruin zones, plus **1–2 continuous rivers / cliff ridges** that genuinely block movement (`World.open?/2` respects `cell.blocked`) with **wide walkable fords/bridges** as natural fortification choke points.

4. **Sequenced Milestones**:
   - **Milestone 1 — P0 Hardening & Hygiene (landed)**:
     - Guard `restart` to `phase == :over` only (closes TLC `NoRestartBeforeTheFall`).
     - Auto-migrate host to the lowest-numbered connected player when `p1` disconnects.
     - Implement `+6%` monster HP scaling per connected hero past 2 (through 15) from [`WORLD.md`](WORLD.md).
     - Rekindle the farthest outer portal on wave 2+ when all six portals have been destroyed.
     - Fix local `tsc` leakage in `assets/jsconfig.json` (`skipLibCheck`, `types: []`) and eliminate the esbuild `import.meta` warning in `assets/js/seam_tiles.js`.
   - **Milestone 2 — P1 Diegetic Clarity & Playtest Visual Fixes (landed)**:
     - Stone shown on the Wood sack when stone > 0 & explicit `Stone Wall` button label/cost when stone covers `Sim.wall_offer/2`; Spire build icon (`priv/static/images/ui/build-mage_tower.png`).
     - Food sack advertises `[F] 5` beside `Feast 10`; `raiseHint` explains missing gold/wood near the keep; locked-Meteor styling + `"Build a Spire to unlock Meteor"` toast for Mage `R`.
     - Client build-ghost parity (`held?`, `meadow`, `overlap`) + right-click cancel + highlighted active build slot.
     - Upgraded Map Table cloth (`LK-106`, `assets/js/map_cloth.js`) drawing one distinct colored mark per discovered/claimed/portal chunk.
     - Live room code, wave, and party roles on the `/r/CODE` join screen (`GET /api/rooms/:code`).
     - Fixed start/join keep-vs-hero depth clipping (`LK-128`), replaced legacy 5-bar scenery cutout with `stump_log-sheet.png` (`LK-129`), added dusk/night horizon dimming + sharper `512×512` over `3072` sampling + seam Z-fighting fix + lifted night moonlight (`LK-130`), and gave mobile touch buttons distinct skill glyphs + non-truncating costs (`LK-131`).
   - **Milestone 3 — P2 The 3D Kingdom Frontier (`LK-108`, `LK-120`, `LK-121`, `LK-122`, landed)**:
     - Coherent 2D value-noise biomes + genuinely blocking rivers/cliffs with 144-unit walkable fords, monster ford-funneling (`skirt_terrain`), daytime frontier sprint (`1.35×` past radius 300), host early-night horn (`Start night early`), contact-based Frenzy, Merchant POI (`trade_merchant/1` + `merchant-sheet.png`), and 5-player-safe Camps + targetable vagrants.
     - Wave 4+ KTC threat archetypes (siege bosses/skeletons > 200 auto-bolt reach, `2.5×` wood-wall-breaker Trolls, wall/river-hopping Bats, portal retaliation packs).
   - **Milestone 4 — P3 Performance & Game Feel (`LK-123`, landed)**:
     - Losslessly recompressed all 10 `ground-*.png` tiles to 8-bit RGB (`16.48M -> 14.66M`, pixel-identical) and hardened horizon distance fog (`1.35×` / `2.6×` span) + unseen day mist (`0x161c18`).
     - Switched WebSocket client input to change-driven frames with a 250ms heartbeat (`shouldPushInput`, cutting idle traffic ~80%).
     - Added shared co-op `[G]` ground pings (`Sim.ping/4`, `"ping"` channel push, golden rally ring + floater), layered SFX cues (`trade`, `ping`, `retaliate`, `fortify`), hit-flash + melee/AoE knockback, Meteor/Slam/Boom AoE ground rings, and post-Rank-4 Keep Fortification (`Sim.fortify/2`).
