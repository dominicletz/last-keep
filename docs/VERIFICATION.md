# Verification ratchet

The floor only goes up. A round may add a check. It does not skip, weaken, or delete one.

The backlog is [`playtests/BACKLOG.md`](../playtests/BACKLOG.md). The interaction graph is [`GAME-INTERACTIONS.md`](GAME-INTERACTIONS.md).

## 2026-10-16 onboarding and clarity

- `joinFromForm` and `squarePixels` fail the run when the page throws or the console logs an error. `twoPlayerNight` already did.
- `twoPlayerNight` now requires a rising damage floater, a score chip that matches the snapshot, a placement reason that hides, a wall placed by one click after the window blurs, and movement that interpolates.
- `squarePixels` checks that the buffer aspect and the camera aspect follow the window at 1600×600, 600×1000, and 1280×800.
- `test/last_keep/game/interactions_test.exs` checks `docs/interactions.json` against `Rules.heroes/0`, resource producers and consumers, building cost and purpose, and that every edge is implemented in the simulation source or marked planned.
- Coverage is reported by `mix test --cover`. The measured total on this round is 62.90%. The floor in `mix.exs` is 62. CI runs that command. The next round may raise 62. It may not lower it.

## 2026-10-16 playtest round 1

- `e2e/playtest.spec.js` joins four heroes, requires the warrior to walk, requires the name Ada on the figure, the You line, and the roster row, requires the next line to say "2 goblins", and requires the invite button to end inside the 1280px window.
- `assets/js/hud.test.js` requires "Next: 2 goblins" and "Next: 1 wolf".
- "two goblins that share a spot step apart" requires the gap to be at least the sum of their radii.

## 2026-10-17 bodies, town, and readiness

- "a gap in a long wall lets goblins through one at a time" requires one goblin through the slot and two goblins filed through with at most one in the slot.
- "heroes and monsters stop on each other, and only the warrior dash passes" requires hero-hero and hero-monster separation, a warrior dash past the body, and a scout dash that stops.
- "the keep is solid and a monster bites it from the edge" requires the hero outside the keep and a bite that lands from outside.
- "wave 1 goblins spawn well outside the yard" requires the ring between 600 and 680. "wave 2 does not spawn in the yard" requires the next ring between 740 and 900 on the tick the wave starts.
- "raising the keep spends wood and gold and widens the town" requires a refuse away from the keep, a paid rank, a wider build, and a stop at rank 4.
- `town.test.js` and `frame.test.js` require the camera, dirt, and frustum to grow with rank. `scenery.test.js` requires the outer ring to be bare trunks with no wood. `hud.test.js` requires the raise button to name its cost.
- `e2e/playtest.spec.js` joins five specialists and still requires the warrior to walk, the name, the next line, and the invite button inside 1280px.
- `GET /health` returns `{"ok": true}`. The deploy waits on `https://agentyard.letz.tw/health` before `npx playwright test`. The smoke assertions are unchanged.
- Coverage measured by `mix test --cover` is 68.11%. The floor in `mix.exs` is 68. The next round may raise 68. It may not lower it.

## 2026-10-17 specialist round 3

- `cull.test.js` requires a monster whose normalized device coordinate is outside the camera, or whose depth is outside the near and far planes, to be left undrawn. Heroes and monsters both use that check before the frame is drawn.
- `hud.test.js` requires two goblins in one direction to share the call "2 goblins", and requires the raise control to stay inert until wood and gold both cover the cost.
- `e2e/playtest.spec.js` requires the invite button, the raise button, and the roster to sit inside 1280×800 and to keep their boxes apart. The warrior still has to walk. Each seat is brought to the front before the roster is read and before the walk, so a background tab still has to show the names and still has to move. The raise control has to be disabled while gold is 0. The browser server for that suite starts with `PLAYWRIGHT=1`, which turns off the asset watcher and live reload so a rebuild cannot wipe the roster mid-check. In CI the browser checks run one at a time, so a second window cannot push the measured page into the background. A held key is applied in the page. The walk still has to pass 20, and the movement sample still has to be longer than 5 frames. Wave 1 is recorded as soon as the goblins are on the yard, and the wave list still has to contain 1 and 2.
- This pass does not change the Elixir simulation. The coverage floor stays 68.

## 2026-10-17 audio and silhouettes

- `assets/js/audio.test.js` maps a wave start to the night loop and the horn, a clear to the day loop and the sting, a keep bite to `keep-hit`, a slam plus a monster hit to `keep-hit` and `hit`, and a fall to `fall`. Mute and volume round-trip through storage, and a repeated tick does not replay the cue.
- `twoPlayerNight` requires the horn and the night loop after the host starts, the build cue from the wall, the hit and kill cues from the fight, the sting when wave 1 clears, and a fall cue from the same bus. Mute and volume survive a reload. The build ring is on while a wall is armed and its radius is the hero's reach. Two goblins on the yard have draw offsets at least 16 apart. An edge call's box does not cover the roster.
- `heroSilhouettes` puts warrior, mage, engineer, scout, and farmer in one room and requires five distinct mark, bounds, and part-count signatures on `window.__lastKeep.figures`.
- `heroes.test.js` requires those five signatures. `bodies.test.js` requires the pair offset. `hud.test.js` requires an edge call to stop short of the roster box and the build ring to follow the armed reach.
- CI fails a flaky Playwright pass, and it fails if `assets/js/audio.js` contains a remote URL.
- This pass does not change the Elixir simulation. The coverage floor stays 68.

## 2026-10-17 empty rooms

- A room used to keep running the simulation for ten minutes after the last browser disconnected. The deploy smoke opens a room per scenario, so those sims were still ticking when the five-player walk started and that walk hung for the full 150 seconds.
- An empty room now freezes the sim on the next tick. If a player had connected, the process terminates after 4 seconds, which is long enough to reload and short enough that the supervisor count is back to baseline before the next scenario. The supervisor does not start that room again. A room nobody ever opened lasts 60 seconds.
- A tick that had already fired could not be cancelled. The next join dropped that ref and started a second clock, so a five-player room ran at 40Hz or faster and the browser stopped answering. The live clock is the timer ref stored on the room. `a stale tick does not start a second clock` sends an extra tick and requires the following half-second to advance at most 14 ticks.
- `an empty room stops ticking and the room count returns to baseline` disconnects the only player, requires the tick to stop, requires a reconnect in that window to keep the room, then requires the process to be gone within 2 seconds and `Rooms.count/0` to equal the count from before the room existed.
- Coverage measured by `mix test --cover` is 69.48%. The floor in `mix.exs` is 69.
- A hidden join field that kept focus swallowed every movement push, so the five-player walk could sit at travel 0 while the page was still answering. `isTypingTarget` ignores a field inside `[hidden]`.
- Blurring that field from a focus listener moved focus onto the next hidden control and the listener ran again. The page stopped answering, so the walk's poll and the build-ring wait sat until the 150 second test timeout. `blurHiddenFocus` blurs once and will not re-enter. Concealing the join form also sets `inert`, so the browser cannot focus it. `blurring a hidden field does not chase focus` covers the re-entry. The walk still has to pass 20.
- Headless Chrome keeps every page visible, so five shadow maps never gave the page a turn and the walk evaluate did not return. Scenery no longer casts shadows, the shadow map is 256, and a page with no recent key or click paints at 4Hz. The five-player walk measures an idle seat and requires fewer than 12 paints in one second. The warrior still has to travel more than 20.
- `five abandoned rooms stop and the count returns to baseline` opens five rooms, disconnects each, and requires every process to be gone within 2 seconds with `Rooms.count/0` back at the count from before they existed.

## 2026-10-17 asset pipeline

- `npm run models` renders every hero, monster, building, and yard prop at the 1280×800 rank-0 pixel buffer, in day, dusk, and night. A second run has to match the first. A frame that differs from `test/gallery/` fails. The pixel threshold is 0.
- The same command rejects a material color that is not a `STYLE.md` token, a silhouette under the recorded minimum, a same-family intersection-over-union at or above 0.85, a mesh past twice its gameplay radius, and a Rules kind with no model, no style row, or no concept mapping.
- `fidelity.test.js` keeps the round-5 scores and fails a later lower score with an empty reason.
- The concept sheets are not in the repo. The gallery says so. This pass does not change the Elixir simulation. The coverage floor stays 69.

## 2026-10-17 concept palette

- `docs/concept/heroes.jpg`, `monsters.jpg`, and `theme.jpg` are the reference sheets. Each gallery contact sheet ends with that asset's crop. `docs/gallery.html` links `concept.png`.
- `STYLE.md` hexes are the jpeg-js lower median of the cited 8×8 patch. A token with no sheet and region, a region outside the sheet, or a hex that is not that median fails `npm run models`.
- This pass recolors the existing meshes to those tokens. It does not change the Elixir simulation. The coverage floor stays 69.

## 2026-10-17 production image

- `Dockerfile.prod` copies `assets/models` with `assets/js`. The client imports `models/registry.js`, and the image build failed esbuild without that copy. `image.test.js` walks the bundle and fails when a copied directory is missing. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 town kit

- The keep is a stone tower with a thatch roof, a door, and a brazier. `keepParts(rank)` adds a course of stone at each rank, battlements from rank 2, and a banner at rank 4. The live page reports that on `window.__lastKeep.townLook`.
- Walls are five palisade posts and a torch. Fields are wheat stalks. The forge is a stone house with a thatch roof. The yard ground is the grass token and the dirt paths are the path token.
- `town.test.js` locks the ranks and the kit. The two-player night requires a rank-0 keep with a roof and a brazier, and no battlement yet. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 pine forest

- A harvestable tree is three stacked boughs on a wood trunk. The outer ring is still seventy bare trunks, now in three distances, and it still has no crown and no wood. `scenery.test.js` locks both. The two-player night reads `window.__lastKeep.forestLook` and requires 70 trunks, no wood, no crown, and at least three boughs on the pine. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 keep light

- The grass token moved from the shadow at 460,374 to the moss at 648,408. It was not the thatch roof. The gallery day background is that sky median, and dusk and night are darker shades of it. `sceneColorProblems` fails a ground token closer to the roof than to the moss, and a gallery sky whose mix is not the concept sky.
- The rank-0 keep is a taller stone tower with a lit belfry, merlons, two timber houses, and pines behind it. Flame and torch colors emit. A night keep has to stay brighter than its sky, with a warm window. `nightLightProblems` locks that. The tower still grows at each rank. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 hero sheet

- The warrior carries a shield and a sword, the mage a robe, a pointed hat, and a gemmed staff, the scout a hood and a bow, the farmer a straw brim and a pitchfork, and the engineer an apron, a hammer, and logs. `heroes.test.js` locks those marks, the prop colors, and the collider fit. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 keep masonry

- The stone token moved from the brown shaft at 636,124 (`#554034`) to the lit belfry block at 672,143 (`#654e41`). Course `#453a32` and joint `#2c2a2a` are the greyer block and the mortar in that same crop. The keep roof stays thatch.
- The keep shaft and its foot are stacked courses. Stone bands are twice the joint and the course, and the odd courses step in. `keepStoneProblems` fails when the body's dominant color is more than 18 from that stone, when the body has fewer than three tones, or when the roof is not thatch. The tower still grows at each rank. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 figure readability

- A 1280×800 window used to be 427×267 (`pixelSize` 3). It is now 640×400 (`pixelSize` 2). The yard frustum is unchanged, so rank 4 still pulls back. `heroHeightProblems` requires every hero's day-raster height to be at least 24 internal pixels at rank 0 and at rank 4. The engineer is the short one, at 47 and 32. Meshes were not scaled, because the farmer brim is already 24 against a horizontal limit of 28.
- Heroes and monsters have a dusk close-up framed on the mesh, 80px tall, and `compare.png` places it beside the concept crop. The portrait is that close-up. `gallery.test.js` locks the band 64–96 and the 24px floor. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 live keep

- The in-game keep is `keepParts`, the same mesh as the gallery. `window.__lastKeep.townLook.keepColors` includes the shadowed stone `#4b3c33`, the lit course `#654e41`, and the mortar `#2c2a2a`. The two-player night requires all three, plus a course part. The stone token moved from the warm lit face at 672,143 to the shadowed block at 648,120, and that lit face is now the course. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 plaza ground

- The yard disc stays moss. The plaza octagon is that same grass token, with a stone ring from the belfry token and the dirt cross still on the path token. `sceneColorProblems` fails a plaza that is not grass, and one that is closer to the path token than to the grass. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 diegetic HUD

- The wave line, relic lines, resource tally, roster, ability keys, and build keys are captions on the yard. They no longer use the `#160f0ccc` panel or a 3px border. `assertDiegeticHud` fails a fill above 0.35, a top border of 2px or more, or a combined box of 105000px or more. The panel stack measured 150656px. Raise stays disabled at gold 0, and the invite, raise, and roster boxes still have to sit inside 1280×800 without covering each other. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 sack economy

- Wood, food, and gold are three sacks on the yard, and the next pack is a beacon on its approach bearing. The keep sign, relic lines, the heart, and the roster are pinned in the world. `assertDiegeticHud` still fails a fill above 0.35, a top border of 2px or more, or a combined box of 105000px or more, and it still counts the same 15 slots. The glass count is 10, under the caption count of 15. Raise stays disabled at gold 0. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 hero colors

- Warrior plate is the lit grey `#b5afaa` from heroes.jpg at 184,186, not the shadow `#494745`. The mage robe stays deep blue, the scout cloak forest green, the farmer hat straw with denim, and the engineer apron leather. The day close-up is the portrait. `heroColorProblems` fails when a dominant close-up color is outside that hero's concept crop, including a brown warrior body. Gallery day light and the in-game sun are neutral, so the grey is not clipped to orange. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 monster kinds

- The concept sheet's six bodies are goblin, skeleton, wolf, the ogre (sim kind `troll`), bat, and the dark rider (sim kind `boss`). The bat is a small winged biter with a bounty of 2. Nights 1 through 12 plan every kind, and night 1 stays two goblins. The live mesh is that kind's gallery model, including the dark rider, and a bat is drawn up off the ground. `townLook.bestiary` lists the six. This changes the simulation. The coverage floor stays 69.

## 2026-10-17 voxel figures

- Heroes and monsters are voxel grids, greedy-meshed into the boxes the raster and the live scene already draw. The warrior close-up shows a crested helm, a face, a blue shield with a gold cross, and a sword. The goblin close-up shows ears, orange eyes, teeth, and a spear with a flame. The wolf has fur and four legs, the bat has wings, the skeleton has ribs, and the dark rider sits on a horse. A hero or monster under the voxel detail floor of 12 fails, so three boxes fail. Buildings stay exempt. Cell size keeps each dusk silhouette at or above its recorded floor. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 day, dusk, and night

- The yard stays on the neutral day rig while the party is waiting and through most of the build. The last eight seconds of the build are dusk. A wave, a frenzy, and a fallen keep are night, and night is darker than dusk, which is darker than day. `window.__lastKeep.light` reports the name. The day sun is still the neutral yard light, so grey plate is not clipped. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 hero picker portraits

- The five picker cards show the day close-up from `test/gallery/<hero>/portrait.png`, served at `/images/portraits/<hero>.png`. `createHost` requires five images, each between 64 and 128 pixels tall. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 specialist round 6

- Room `KR8DDW` on https://agentyard.letz.tw after the voxel figures deploy (`6 passed`). Fidelity against the round-5 baseline is mood 2, town 3, heroes 3, monsters 3, ui 3. The round-5 rows stay. A goblin at game zoom is an olive figure with orange eyes, not the concept spear-carrier, and the wolf, bat, ogre, and rider were not on the yard. This does not change the simulation. The coverage floor stays 69.

## 2026-10-17 dusk field and readable monsters

- The yard ground is the lit clearing `#5c642f`, not the shadow moss `#374115`. A day field under luminance 90 fails as dark olive, including that moss. Dusk uses the orange horizon `#eba15d`. An in-game dusk frame has to stay within 18 degrees of the theme sheet's hue, at least as bright as that sheet, and show a torch at luminance 160. The dusk field itself fails when it is murky olive.
- The goblin spear and the skeleton ribs have to cover at least the voxel detail floor of 12 pixels at game zoom, and the ribs have to read as three separate bands.
- Wave 2 brings a wolf, wave 3 a troll and bats, wave 4 a dark rider. A scripted parade, only when `PLAYWRIGHT=1`, puts one of each kind on the yard. The food sack names the feast. A short Raise button is painted inert. A goblin pair across a compass boundary is one call, and that call stays under the top bar. The wave sign follows the hero and is clamped inside the window.
- `mix test --cover` reports 70.19%. The floor stays 69.

## 2026-10-18 specialist round 7

- Room `EM9YG3` on https://agentyard.letz.tw after the dusk-field deploy (`1 skipped, 6 passed`). Fidelity against rounds 5 and 6 is mood 3, town 3, heroes 3, monsters 4, ui 4. The round-5 and round-6 rows stay.
- Wave 1 cleared at keep 900. The food sack says Feast 10. Raise is dark at gold 0. The wave-1 call is one `2 goblins` and it sits off the button. The wave line stays in the window and covers the food sack.
- Wave 2 put a wolf on the yard, wave 3 put an ogre on the yard and spawned two bats, and wave 4 spawned the rider. The bat body and the rider body were not readable in the frame. The keep fell on wave 4 at 34 kills.
- A day-yard patch samples luminance 51. The same patch at dusk samples luminance 31. This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 yard light matches the Lambert yard

- `litGround` follows the renderer's sRGB Lambert, including the divide by pi. A day field under luminance 90 still fails, and a dusk field under luminance 70 fails. Day stays brighter than dusk, and dusk stays brighter than night. A lit grey plate that shifts more than 40 points from red to blue fails.
- The wave sign sits screen-up from the hero, and a pin at the bottom of the window stops 72 pixels short of the edge. An edge call below 0.78 is pulled up off the hotbar.
- This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 the camera stays on the hero

- `cameraFocus` follows 72% of the way to the hero. A hero at the round-7 bat coordinates stays inside the rank-0 frame, and the bat under them does too. The old 0.22 pull toward the keep leaves that bat outside the frame. Following all the way leaves a goblin on the far side of the keep outside the frame of a hero on the join ring.
- The scripted parade stands on a ring around the host at (120, 0), so all six kinds stay inside that same frame. The roster board is a corner pin, and a board that projects above the window is pulled back inside it. A long fight keeps the horn, the sting, the kill, the build cue, and the day cue after the hit buffer rolls over. Night plans are unchanged. The coverage floor stays 69.

## 2026-10-18 the wave line clears the sacks

- The wave line stays a world pin. When that pin would cover a sack, the relic lines, the heart, the roster, the name, a call, or the raise, skill, and build controls, it takes the nearest spot that misses them and still sits inside the window. `assertWaveClear` checks the waiting yard and the walk. This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 the palisade reads as a wall

- A placed wall is five posts at least 7 by 40 with two rails and a flame. The recorded silhouette floor is 1411. The thin 4 by 24 posts were the wall that did not read in round 7. This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 a fallen keep does not refill a hero

- Respawn runs after the keep is checked. A hero at 81 health is still at 81 on the fallen snapshot. A downed hero whose timer is up stays down, instead of returning at full kit health on that same tick. A downed hero still returns when the keep stands. The coverage floor stays 69.

## 2026-10-18 moss day and a cool dusk

- Round 8's day patch was luminance 103 and hue 73, olive-mustard. The same patch at dusk was luminance 75 and hue 40, an orange wash. The grass token stays the clearing. A ground lamp, which does not light heroes, grades the day field to hue 85–100 and luminance 100 or above, within 8 degrees of the moss at theme.jpg 150,192 (`#455c28`). Dusk's sky is the violet at 24,0. The far field stays luminance 72 or above and at least 80 degrees from the flame. The brazier patch is warmer by 25 degrees. Grey plate still fails if a channel reaches 240 or red leads blue by 40. This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 the day clearing and the warm dusk

- The waiting yard was luminance 51 and hue 65. The same patch at dusk was luminance 31 and hue 38. The day illuminant is the grass token lifted toward white, so the lit patch stays at luminance 100 or above and hue 70 or above. Dusk is lit by the horizon token and the sunset token. Its patch stays between hue 28 and 48, at luminance 72 or above, and under the day. The round-7 olive bytes fail that floor. `twoPlayerNight` reads the same patch off the canvas. This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 bats and the dark rider read on the night yard

- Hide on the night grass is luminance 32.7 against a field of 47.6. The rider cloth is 34.4. Bone is 73.1 and plate is 111.7, each at least 18 above that grass. The bat wings are bone and three voxels deep, inside radius 24. The rider's cuirass and helm are plate, the eyes are the torch, and the horse stays the rider token. The rider radius is 54, inside the cap of 68. Both wear a bone rim at 1.2 times the body box.
- The night frame counts pixels at or above the live night grass. The bat record is 80 (measured 96) and the rider record is 1000 (measured 1240). A record under half the measured count fails. The dusk silhouette floors are 347 and 4898. A hero at the round-7 spot keeps both bats in frame. `paradeShowsEveryKind` requires 24 canvas pixels at least 18 luma above the yard on the bat and on the rider. This does not change the simulation. The coverage floor stays 69.

## 2026-10-18 phone touch

- `mobileTouch` joins on a landscape phone viewport with touch, walks on the joystick, casts from a portrait button, and places a wall from the context button. Portrait shows the rotate prompt. `twoPlayerNight` still requires the touch pad to stay hidden on a mouse. `stickVector` matches WASD, and a user-agent string does not turn touch on.
- The post-deploy smoke is `npx playwright test`, which now includes `e2e/mobile.spec.js`. Timeouts and retries are unchanged. This does not change the simulation. The coverage floor stays 69.
- A guest left behind another window can still be chewing through old snaps, and a mage who waits out the whole frenzy dies before Q. `castFireball` runs when the night starts, brings that page forward, and waits until its tick is advancing at the live rate. The shot is aimed at the keep. It still has to be on screen within 5 seconds.
- A feed tap writes the same pad bit it releases. `padSlot("feed")` is `f`, so the finger-up clears `pad.f` and the next keep heal can rise again. Place and raise keep their own names.
- On a touch phone the build row is the building name and its cost, at least 44px on each side. `1 Wall` and `LMB` stay on the desktop captions. Portrait covers the viewport with the rotate card, dimmed at alpha 0.75 or more. At 844×390 the three sacks do not overlap. A desktop mouse still shows the digit and the key.

## 2026-10-18 town growth

Raising the keep stakes four timber houses on the new ring. The wood and gold of that raise pay for the houses. Each full ring of standing houses mints one gold on the field-gold beat. A farmer's sow, harvest, or four-second work pulse banks labor, and each point spends 1 wood on a wheat croft. Rank 0 stakes nothing. The ExUnit test is "a raised keep stakes houses and farmer labor stakes crofts", and the browser scenario is `townGrows`. `mix test --cover` measured 74.64% after the meteor unlock landed on main. The floor in `mix.exs` is 74.
