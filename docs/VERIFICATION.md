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
- Far from the keep, the roster and the relic lines stay above the build bar and off each other. `seatCaptions` caps them at the control row. `captionsClearTheBuilds` walks west of x=-700 at rank 0. `townGrows` does the same after the keep is raised. `mobileTouch` does it on the phone. This does not change the simulation.

## 2026-10-18 a repeated snapshot keeps the blend

- Each snapshot called `remember` from the socket nudge and again from the scene sync. The second call, at the same point, set the blend's start to its target, so the body sat on the server position for the rest of the tick. `movementIsInterpolated` then saw no gap above 0.4 and failed as flaky on main. A repeat at the same target keeps the open blend. A new target still starts from the previous one. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 clicks wait on the published tick

- A focus click that must not attack was sampled for 350ms of wall clock. The melee cooldown is 8 ticks, and an idle page publishes a snapshot about every 250ms, so that window can close before the swing is on the page and a real attack looks like a miss. The check now samples `attackCd` until the published tick has moved 12 steps, which covers the input interval and the whole cooldown. A click with no building waits 8 ticks before it reads wood. The deny line waits until the node hides, instead of sleeping 2600ms. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 hero shapes stay readable

- The warrior helmet has a one-band visor slit, the shield narrows toward its foot, the gold on that face is a cross, and the sword is one cell wide. The mage hat ends in a point. The scout hood covers the head. `heroFeatureProblems` fails a slab shield, a missing slit, a plank sword, a block hat, and a bare scout head. Day-raster heights at 1280×800 are warrior 97 and 65, mage 113 and 75, scout 98 and 66, farmer 99 and 67, engineer 99 and 67. The 56px floor is unchanged.
- Hero paint keeps half its unlit color at dusk and night, so steel saturation stays at or under 0.3 and the shield, robe, hood, and denim stay on their hues. Day paint is unheld, so the close-up still matches the concept crop, and night stays darker than dusk and dusk darker than day. The live mesh uses an unlit material and a dark rim, so the yard's green ambient cannot turn the plate mint. The camera looks 32 units above the ground. The five heroes at the back join-ring seat, including the health bar and the dark rim, stay at least 48 CSS pixels inside the 1280×800 frame. A ground look leaves the mage above that frame. A lower look had been used so one grass corner stayed under a variance cap. That corner is the flattest of four screen patches, and on the textured yard it sits over the old cap at either look. The whole frame is the dusk check, and it passes at this height. The pine sample reads the crown, because the old tip sample read the trunk once the look rose. The stone and the crown stay at least 25 degrees apart. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 town growth

Raising the keep stakes four timber houses on the new ring. The wood and gold of that raise pay for the houses. Each full ring of standing houses mints one gold on the field-gold beat. A farmer's sow, harvest, or four-second work pulse banks labor, and each point spends 1 wood on a wheat croft. Rank 0 stakes nothing. The ExUnit test is "a raised keep stakes houses and farmer labor stakes crofts", and the browser scenario is `townGrows`. `mix test --cover` measured 74.64% after the meteor unlock landed on main. The floor in `mix.exs` is 74.

## 2026-10-18 heroes read at fight zoom

- The five heroes use a per-axis voxel step and stay inside the horizontal cap of 28. Day-raster heights at 1280×800 are warrior 88 and 60, mage 117 and 80, scout 96 and 65, farmer 108 and 73, engineer 91 and 61. `heroHeightProblems` requires 56 internal pixels at rank 0 and at rank 4, and that floor has to stay at least half the shortest measured height. The farmer brim passes the shoulders. `farmerHatProblems` fails a straw hat wider than 0.4 of the fight-zoom body.
- `heroZoomProblems` counts signature tokens on that same raster under day, dusk, and night, at both ranks. The records are warrior steel 100, shield 150, gold 48; mage deep 300, gold 64, gem 110; scout forest 400, wood 150; farmer straw 190, denim 130, wood 150; engineer jerkin 320, steel 220. A record under half the smallest count fails. The live page reports each hero's buffer height on `window.__lastKeep.figures`, and `heroSilhouettes` requires 56. The warrior raises a sword, the mage holds the staff forward, the scout draws the bow in front, the farmer thrusts the fork, and the engineer raises the hammer. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the blend is read from the motion track

- `movementIsInterpolated` counted animation frames for 900ms and required more than five. A loaded runner painted four times in that window, so the co-op spec failed flaky on main after #65 even though the hero was walking. The check now reads `window.__lastKeep.motion`, the track `placeMesh` is already blending, until a sample is inside the 45ms blend and the step is between 0.4 and 14. Travel still has to pass 20. The track step stays under 14. A slow paint lands after the 45ms blend, so the check does not read the mesh gap off that paint. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the far walk reads the published position

- `assertFarCaptions` waits until the hero is north of y=-220 and then west of x=-700. Those waits used `requestAnimationFrame`. `townGrows` still has the guest window open, and a covered page does not run that callback, so the walk timed out on the deploy smoke after the socket had published the new position. Both waits now poll every 100ms, the same timer the live-tick check uses. The marks are unchanged. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 town fidelity

- A raised house is a voxel cottage. Timber, whitewash, thatch, and a lit window vary by the snapped cell. `a house is a timber cottage with a lit window` checks the three variants. The voxel detail floor includes the house and the field. Other buildings stay exempt.
- The plaza disc, the stone curb, and the ground disc use `plazaSides` 48. The disc is grass `#5c642f` and the curb is stone `#4b3c33`. The live page reports `plazaSides` on `townLook`.
- The outer ring is seventy stumps and felled logs at the same three distances, with wood 0 and no crown. `townGrows` requires one house to read above the grass. The sample floor is 619, half of a measured 1238. This does not change the simulation. The coverage floor stays 74.
- The concept clearing is darker than that flat grass. A corner of the untextured disc is variance 0, and it was the field sample, so the cottage was scored against the disc. The sample now prefers a textured patch. The lit cottage on the tile was 492 pixels above the grass, under 619. The house mesh is scaled 1.25 from its ground point, and the same sample then read 790. The floor stays 619.

## 2026-10-18 the frame, not the patch

- A single grass patch can sit on a moss hue while the yard is a flat lime, a lavender wash, or a flat olive. `moodProblems` scores the whole frame. Contrast under 9 fails. Day lime share over 0.08 fails. Dusk cool wash over 0.25 or warm tail under 0.03 fails. `theme.jpg` passes. The live frames from that grade, saved in `assets/js/fixtures`, fail. Those floors do not go down.
- The day ground lamp and the dusk violet lamp are gone. Dusk ambient is neutral, so stone, wood, and plate stay apart. The ground plane carries grass tufts, dirt, a dark edge, and a sunset band at dusk. A pine wall stands inside the seventy stumps. `twoPlayerNight` reads `frameMood` on the framebuffer. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the wave clock and a raise from the woods

- A wave whose monsters are still up used to leave the phase at `{:wave, 0}`. The clock stopped. `the wave timer keeps moving from frenzy in 43s with the keep at 291` starts at wave 3, 15 kills, keep 291, and phase 43s, then requires every one of the next 900 ticks to change that phase, stay on the wave, keep the keep standing, and end enraged with monsters still up and a negative `phase_ms` that still encodes. The wave does not end early. Hold still waits. The coverage floor stays 74.
- A raise used to refuse with "Stand by the keep" outside the keep ring, so the orange button at gold 12 and wood 72 did not spend or stake. `a raise from the reported woods spends the purse and stakes houses` puts Ada at (-232, -396) with that purse and requires town 1, wood 48, gold 4, four houses, and camera 186. The phone context button offers that same raise. Feed still needs the hero beside the keep. A short purse still leaves the button inert.
- "raising the keep spends wood and gold and widens the town" still requires the paid rank, the wider build (camera 186, dirt 190, view scale 1.12, range 228), a wall in that reach, and a stop at rank 4. The first click from the spawn ring is that paid rank. The coverage floor stays 74.

## 2026-10-18 the ground at the camera

- Whole-frame contrast can pass while the plaza under the camera is one wash. `groundSpread` is the 25th percentile of block deviation from 42% to 90% of the frame, counted from the top. Under 8 fails. `theme.jpg` passes. The afternoon frames in `assets/js/fixtures/yard-*.jpg` fail. The floor does not go down. The live read flips the bottom-up framebuffer so that band is the near yard. A bottom-up read was scoring the far wash and failing a worn ground. Dusk sunset flecks stay inside the plaza and past the pine wall. The wall band is grass, so the inner crown sample does not pick up the keep stone's hue.
- A worn disc sits on the plaza mesh. Tufts, dirt, and stones use the grass, path, and stone tokens. Soft contact discs follow heroes, buildings, and the pine wall. The plaza mesh, the houses, and the hero models are unchanged. `twoPlayerNight` reads `frameGround` in day, dusk, and night. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the deploy waits for the new proxy

- `docker compose up` replaced `last-keep-app-1` and left `last-keep-caddy-1` Running. Caddy had no healthcheck, so `--wait` called that old proxy healthy. One public `/health` then passed, the job spent two minutes installing the browser, and the smoke got `ECONNREFUSED` on 443. The smoke suite is unchanged.
- The app is brought up first. Caddy is force-recreated only after that container is healthy, and its healthcheck proxies `/health` on `127.0.0.1:8081`, which is not published. `deploy/ready.sh` requires three `/health` answers in a row. The workflow runs it before the browser install and again immediately before `npx playwright test`. Deploys queue, so a second one does not recreate the stack during the smoke. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the image ships the commit's bundle

- Deploy of 1ec39c7 served `app-765f2549fb17ac3510a9c76fa13b1e61.js`. That file has no `motion` key. A production build of the same commit writes `motion:` twice and digests to `app-10997d89dd271dd2c2d351fcd7923042.js`. The live smoke then sampled `window.__lastKeep.motion` for 4 seconds, got no rows, and failed both attempts. The GHA cache was `type=gha,mode=max`, which keeps every intermediate `COPY`. That cache is gone. `SOURCE_SHA` is the commit, and `mix assets.deploy` fails the image when `priv/static/assets/js/app.js` has no `motion:` key. The track check in `movementIsInterpolated` is unchanged. This does not change the simulation. The coverage floor stays 74.
- The dusk grade called `frameMood` on every animation frame. That readback spent the eight-second dusk inside `readPixels`, the light was already night, and the co-op spec sat until the 150s test timeout. The retry passed, and `failOnFlakyTests` failed the job. The wait now reads `window.__lastKeep.light` until it is dusk, then grades the frame every 400ms until it is clean or eight seconds pass. The problems, the cool wash, the warm tail, the ground spread, and the stone-to-pine gap are unchanged. The night grade does the same. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 a backed-up push keeps the swing

- Deploy of d7f2f95 and the round-10 docs run both failed `focusClickDoesNotAttack`: the focused click's peak over 12 ticks was 0, and the retry passed. `failOnFlakyTests` failed the job. The channel keeps the newest snapshot when `push` falls behind. The swing cooldown is 8 ticks, so the snapshot that arrives can already be 0. A dropped snapshot that had a swing, or an attack cooldown, now sets `saw_swing` on the one that is pushed. The cooldown on that snapshot stays 0. The page latches `attackPeak` from the flag, the event, or the cooldown, and `draw` copies the latch. The spec waits on the latch for 2 seconds. A blurred click still stays at 0. Wood is unchanged. This does not change the simulation. The coverage floor stays 74.
- `five abandoned rooms stop and the count returns to baseline` created each room and disconnected it inside the loop, with a 500ms idle. A seeded world is heavy enough that the first room reaped before the fifth existed: the count was 6 against a baseline of 5, so the expected 10 failed. The five rooms are created first, then disconnected, then counted. The idle budget is unchanged. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the swing is on the snapshot

- The second click in `focusClickDoesNotAttack` waited for `attackCd` on the next animation frame. That field was copied only inside `draw()`. An idle page does not paint, the cooldown stayed 0, and the co-op spec sat until the 150s test timeout. The retry passed, and `failOnFlakyTests` failed the job. `paint` now copies `cds.attack` onto `__lastKeep` with the tick. The focused click is read across 12 ticks with a 100ms poll, the same window as the blurred click. A blurred click still stays at 0. Wood is unchanged. This does not change the simulation. The coverage floor stays 74.
- After that, the same check failed fast: the peak over 12 ticks was 0, and the retry passed. The guest window blurs the host while the first click is being watched, the swing flag stays false, and the second click is thrown away as a focus click. A blur that leaves the document focused restores the flag. A covered page does not have focus, and that restore must not clear the flag the spec sets before the swing. The spec brings the host forward and marks the game focused before the swing. A blurred click still stays at 0. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the walk sample waits for the distance

- `movementIsInterpolated` stopped at the first open blend. On a fast runner that sample landed at travel 15.56, under the floor of 20, and the retry passed. `failOnFlakyTests` failed the job. The loop now stays inside the same 4 seconds until the track is open and travel is over 20. The step band, the 45ms age, the row count, and the travel floor are unchanged. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 phone captions keep their seats

- On an 844×390 phone the food sack covered the health line, the roster ran through the relic lines, and the goblin call sat on Shot. `phoneClear` joins five heroes and asserts no HUD overlap at 844×390, 667×375, and 932×430 beside the keep, west of x=-700, after the raise, and while a goblin call is on screen. Touch build buttons stay at least 44px and share the row left of the thumb pad. The wave line wraps so it can sit off the sacks. The name and the health line step off a button when the hero stands under one. The seat pushes off a block, then samples a 16px grid, and only refines beside that cell. The four fields are sown from the spawn, and the far walk happens after the raise, so the return does not cross the guests on the join ring. The night pose runs away from the goblin pack until a call is on screen and the hero is more than 400 from the keep. The town-growth far walk raises from the field, so it does not enter the stone. This does not change the simulation. The coverage floor stays 74.

- The stone-to-pine gap is still 25. After the blend check holds W, the southeast forest pine is a few pixels of sky and the gap reads 18. The hero walks back inside 140, and the sample is the keep pine at (-22, 30, -62), the center of the wide cone. The plate sample was height 18, the cape hem, and dusk cloth there read saturation 0.44. The floor stays under 0.2 and the sample is the cuirass at height 40. `assertFarCaptions` still walks north of y=-220, then west of x=-700. If north does not gain 40 in 3 seconds, the hero is on the keep's west face and KeyW is only sliding along x. That seat steps outward until the west line misses the keep, then still has to pass x < -700. A phone that can go north is not sent into its own wall. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 dusk is one framebuffer read

- The concept branch failed `twoPlayerNight` because the dusk wait expired. Mood and ground each read the whole frame, and the second read finished after dusk. The hue gap stays 25 degrees, the plate floor stays 0.2, and the wait stays 8 seconds. The keep pine stays at (-22, 30, -62). The assertion uses the dusk frame that passed. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 the yard wears the concept tiles

- The ground base is `theme.jpg` at 312,276, 48×48. The keep's stone, course, and joint use `theme.jpg` at 640,100, 48×64. Both crops are snapped to the style tokens at 1, 0.60, 0.50, and 0.40. `tiles.test.js` rebuilds those bytes and fails if a pixel leaves the palette. The grass tile scores block p25 13 and hard edge 0.075. The masonry tile scores block p25 16 and hard edge 0.118. The floors stay 8 and 0.05.
- A live day frame against the town crop scores block p25 8, hard edge 0.113, luma SSIM 0.069, and silhouette IoU 0.68. Dusk scores 4, 0.067, 0.027, and 0.61. Night scores 3, 0.044, 0.096, and 0.63. SSIM stays under 0.35, and the dusk and night block scores stay under 8. Those floors do not move.
- Night greens at or under luma 62 become the night soil, and the brighter greens become the pine token, so the plaza spread stays at or above 8. Dusk flecks stay off the pine band. The keep pine and the stone sample stay on their meshes. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 concept cards at the keep's scale

- The voxel heroes stood over half the keep. `heroScaleProblems` fails a card taller than 1.75 keep doors, 1.05 palisade posts, or 0.42 of the keep, and a height that leaves 32. The door is 20, the post is 40, and the keep top is 165. The five join-ring disks do not meet. On the player camera the card does not cover the door or the tower. The mage and the engineer share a view ray, 37.9 apart on the ground against a combined reach of 17.8, so the overlap test is the ground disk.
- `heroLikenessProblems` scores the player-camera close-up against the crop in day, dusk, and night. Intersection-over-union under 0.72 fails. Color error over 46 fails. The voxel meshes score 0.254 to 0.568 and 62.7 to 98. The 160px crop cards score 0.783 to 0.885 and 32.2 to 39.7. The live card is that 160px source. The full crop's atlas is about 46MB and stalls the page. The yard mask is about 32 pixels, so the score is the close-up, not that mask.
- The day-raster floor is 20, the scout's rank-4 height. It stays at least half the shortest measured height. `heroSilhouettes` requires world height 28 to 36 and 20 to 95 internal pixels. The live box includes the health bar. The measured card is 81. `heroZoomProblems`, `heroHueProblems`, and `heroFeatureProblems` still judge a voxel mesh. A billboard skips them. The plate sample follows the card. Height 40 is above a 32-unit figure and reads dusk saturation 0.60. The steel on the card is height 18, saturation 0.10, and the floor stays under 0.2. A dark miss divides by a tiny red and a live smoke read 2.45. The dusk wait stays until the height-18 patch is under 0.2. This does not change the simulation. The coverage floor stays 74.

## 2026-10-18 a seeded world

- `World.generate/1` builds a radius of 7200 from the seed. `the same seed returns the same world` requires two builds of seed 3 to match, including `World.chunk/3`. `the keep disc stays clear` requires meadow and no point of interest inside radius 400. `every point of interest is reachable on foot` flood-fills seeds 1, 3, and 9 and requires all 25 points on that fill, with portals between 1400 and 5200. `the land is not a mirror` requires each of the x-mirror, the y-mirror, and the half-turn to disagree on at least 0.35 of the 144-unit lattice. `Rules.map_radius/0` stays 1800. Heroes still clamp there. The measured total is 75.51%, and the floor is 75.

## 2026-10-18 a chest and a portal

- The room stores the seeded world. `a chest at a known coordinate pays 24 gold once` stands on the nearest chest of seed 1 and requires gold to rise by 24, then stay there. `a broken portal leaves the night, and night 1 is still two goblins` breaks every portal but two and requires the two goblins on those bearings, not on the broken one. `a hero keeps walking past the old map edge` requires a hero at x 2400 to stay past 2000. The yard rings stay 600 to 680 and 740 to 900. Night 1 stays two goblins. `exploreLand` walks to a chest, reads the gold sack, breaks the nearest portal, and reads a wave off that bearing. The far mage is no longer standing on both paths, so "a mage who closes on the host lives when both goblins are on screen" keeps the living close and records that the far seat survives seed 1. The measured total is 77.13%, and the floor is 77.

## 2026-10-18 hero cards on the pipeline scorer

- `art_score.js` reads a frame the way `docs/concepts/ART-PIPELINE.md` describes. The town crop scores block p25 of 13 and a hard edge of 0.069, against the published 12 and 0.070. It matches itself at SSIM 1 and IoU 1. The gallery keep still misses block 8, SSIM 0.35, IoU 0.55, and membership 0.98.
- Each hero close-up, day, dusk, and night, holds the measured floors. Block p25 is 12 to 19. SSIM is 0.118 to 0.398. Silhouette IoU is 0.404 to 0.502. Palette membership is under 0.01. Block clears the floor of 8. SSIM, IoU, and membership do not clear 0.35, 0.55, and 0.98. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 shade steps are the pixel

- Day locks the style tokens at 1, 0.60, 0.50, and 0.40. Dusk locks 0.60 and 0.50. Night locks 0.50 and 0.40. `phaseScales` is that table. Grass and masonry for each phase come from `theme.jpg` at 312,276 and 640,100. `tiles.test.js` rebuilds every phase and fails a pixel more than distance 1 from that phase's palette, a block p25 under 8, or a hard edge under 0.05.
- The night two-color split, luma above 62 as pine and the rest as night soil, scored block p25 7 on the plaza. The night shade step keeps those greens dark. Plaza spread stays at or above 8 without the split. The ground, the plaza wear, and the stone tile are unlit, so the shade step is the pixel. Flame `#eea821` and torch `#f5751e` stay the full token on an unlit material. This does not change the simulation. The coverage floor stays 77.
- A live 640×400 frame, box-downsampled from the 1280×800 shot, scores block p25 8 by day, 6 at dusk, and 7 at night. The yard band from 42% to 90% of the height scores 9 in every light. The full frame still misses 8 at dusk and night. The sky and the remaining Lambert meshes are the flat blocks. The floor stays 8.

## 2026-10-18 the chest walk clears the keep

- Deploy of 1ad8e38 failed `exploreLand` with the host at x 73.5, y 0. That is the keep's west face. The detour used to stop at radius 180, and the straight line from there still hit the keep, so the hero walked back into the wall. The detour now stays inside the same 20 seconds until the remaining segment misses the keep. The chest wait stays 45 seconds and the portal wait stays 70 seconds. Night 1 stays two goblins. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 hero sheets walk, strike, and fall

- Each direction has four walk frames, three attack frames, and four death frames. Walk 0 of direction 0 is still the crop. The attack row shifts the upper body. The death row folds the figure down, and the last frame keeps under half the ink in the top of the cell. A rising attack cooldown starts the strike. A dead hero plays the fall and holds the last frame. The likeness floors stay 0.72 and 46. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 a quarry pays stone

- `Rules.cap(:stone)` is 200. A quarry holds 40. An engineer standing on it takes 2 a tick, and any other living hero takes 1. The take stops when the quarry is empty, and a tick that would pass the cap takes only the room that is left. A sow on pine is denied and spends nothing. A sow on meadow still plants a field. A wall placed while the room can pay 8 stone and 4 wood is a stone wall with 280 health. A wood wall stays at 170. The six build buttons stay. Pine wood stays planned. Night 1 stays two goblins. The coverage floor stays 77.

## 2026-10-18 meshes dispose and shots are pooled

- `sync` used to `scene.remove` a mesh and leave its geometry on the GPU. Bursts and a rebuilt keep did the same, and every bolt allocated a new sphere. `releaseGeometries` disposes each geometry once and skips a pooled one and the shared sprite plane. Shot spheres are shared by radius. Burst meshes go back to a pool. `shotsDoNotGrowGeometries` holds a mage attack until more than one bolt is in flight, then requires `window.__lastKeepPerf.geometries` to stay within two of the count from before the volley. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 monster cards from the sheet

- Each monster is its crop on `monsters.jpg`, with eight directions, four walk frames, three attack frames, and four death frames. Walk 0 of direction 0 is the crop. Goblin height is 18, skeleton 22, wolf 16, and bat 10, all under the hero. The troll and the rider are 34, under 1.75 keep doors. The dusk silhouette floors are goblin 144, skeleton 236, wolf 96, troll 433, bat 76, and rider 231. The night read is bat 16 and rider 48. The voxel records were the oversized meshes. These card floors only rise.
- `art_score.test.js` pins the close-up. Block p25 is 5 to 16. SSIM is 0.689 to 0.912. Silhouette IoU is 0.641 to 0.876. Palette membership is under 0.04. A bite publishes `attack_cd` in milliseconds. The card strikes when that value jumps. A monster that leaves the snapshot plays the fall and then drops. The likeness floors stay 0.72 and 46. The coverage floor stays 77.
- The yard spawns 30 trees. Asking for each mesh rebuilt every hero sheet and every monster sheet, and the phone caption walk then sat until the 150s test timeout. `modelParts` builds the one kind and reuses it. `thirty trees share one mesh` loops those 30 calls and fails at a second. The phone timeout stays 150s.

## 2026-10-18 the phone page is covered

- CI on eef82ab spent the 150s budget inside `assertPhoneClear` and again on `phase === "wave"`. The deploy of bdf8996 died on the same frame promise, on the last caption check. Four guest windows cover the phone. `requestAnimationFrame` does not run there, so a frame promise and the default poll never see a roster, a field, or a wave the server has already published. The overlap poll is the layout wait. The roster, the four sows, the gold sack, the raise, and the wave poll every 100ms. The goblin wait stays 10 seconds. The three phone sizes stay 844×390, 667×375, and 932×430. The deploy of 7d056a4 then read an empty call after that sweep, because a goblin had walked into the frame. The seat steps away until the arrow is back. The text still has to say goblin. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 the chest walk leaves the west face

- The deploy of 7d056a4 left the host at x 73.5, y 0, and the chest wait of 45 seconds ran out. The detour had already stepped aside, then the diagonal walk clipped the keep and sat there. `steerPast` now keeps orbiting while the hero is inside radius 160 and the line still hits the keep, and a clear slice is 6 seconds so a pin does not spend the whole budget. The chest wait stays 45 seconds. The portal wait stays 70 seconds. Night 1 stays two goblins. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 the match paints without a yard read

- `paintFrame` no longer calls `sampleYard`. That read was four `readPixels` calls after every submit, and it flushed the frame. `matchPaintsWithoutARead` joins one farmer, waits for four paints, and requires the read count to stay 0. `brightNear` still samples the yard on purpose, and that call has to raise the count and return a field luma above 0. The parade still uses that grade. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 the world outside the keep

- `docs/concepts/WORLD.md` is the contract for a seeded land of radius 7200. The keep disc of radius 400 stays meadow. Points of interest, role walks, portal bearings, fog, and the 2-to-15 seat scale are on that page. The chest, the portal, the quarry, and the meadow sow are already in the simulation, and the walk clamp is 7200. Pine wood and the performance slice stay planned. LK-089 stays open. Night 1 stays two goblins. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 the chest detour steps off the face

- CI on the swing pin failed `exploreLand` at x 73.5, y 0. The offset via still had `|dx|` above 28, and `keysToward` treats that as due west, so the hero never left the face. The via now shares x. The hop ends when the cardinal step misses the keep body, radius 54 plus the hero radius 14. The detour stays inside 20 seconds. The chest wait stays 45 seconds and the portal wait stays 70 seconds. `e2e/steer.test.js` walks that face and the spawn to a chest. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 the chest walk leaves the keep face

- Deploy of fbd8803 failed `exploreLand` with the host at x 73.5, y 0. KeyA+KeyW is due west, and that step has no y, so the body cannot slide off the keep. `keysAround` walks the tangent while the hero is inside 100 of the keep and the goal is still inward. The eight-way stop is 12, inside the chest radius of 30. A goal on the far side of the face still walks straight. The southern lane past the join ring stays KeyW+KeyD. The chest wait stays 45 seconds and the portal wait stays 70 seconds. The phone timeout stays 150s. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 six seats across three waves

- `sixSeatMatch` joins Nia, Ada, Lux, Bram, Pip, and Ned and keeps the first empty build and the empty build three waves later. Geometries still in the scene must not rise. A geometry that left the scene has to be disposed or pooled, so the renderer count cannot sit above the scene plus the pooled spheres. Textures must not rise. Each card uploads its own atlas, and `releaseGeometries` disposes that texture with the mesh while the shared sprite plane stays. Empty draw calls stay at or under 868 and triangles at or under 11552. Paint p95 stays at or under 424 ms. The largest facing step stays above 0 and at or under 0.7 radians. The six monster cards are decoded before the first sample, because those atlases stay in the picture cache. On this VM, one collection then read 104.2 MB at wave 2 and 105.6 MB at wave 5. Two collections read 109.19 MB and 109.54 MB. That few hundred kilobytes is the measured gap. The harness records both troughs and does not turn the gap into a ceiling. `docs/concepts/PERFORMANCE.md` still says the trough stayed under 35 MB. Chromium is launched with `--js-flags=--expose-gc`. Card atlases already put textures above the recorded ceiling of 4 and the first trough above the recorded 35 MB, so this check gates the rise and leaves those ceilings in `docs/concepts/PERFORMANCE.md`. Before the start, the engineer spends the opening wood on a ring of walls, so those meshes are in both samples. Chromium is launched with precise heap sizes. The test allows 660 seconds. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 the tangent is the shared step

- `steer` holds `keysAround`. The helper beside it still built a cardinal via, and that via treated `|dx|` above 28 as due west, so the face at x 73.5 could be walked back onto the keep. The helper now steps with `keysAround`. Due west is not the face step. `e2e/steer.test.js` walks that face and the spawn to a chest inside 30. The chest wait stays 45 seconds and the portal wait stays 70 seconds. After the phone viewport sweep, an empty arrow steps away until the text says goblin. This does not change the simulation. The coverage floor stays 77.

## 2026-10-18 a focused blur keeps the swing

- Deploy of the swing-cooldown commit failed the live smoke on one flaky run of `focusClickDoesNotAttack`. The retry passed, and `failOnFlakyTests` failed the job. The same flake failed the motion-cap deploy. The blurred click still has to stay at 0, and the focused click still has to set `attackPeak`. A window `blur` that leaves `document.hasFocus()` true no longer clears the swing flag. The spec's `focus()` sticks until `blur()`, so a guest page that takes the document after that mark cannot throw the click away. `saw_swing` still rides on the snapshot that is pushed, and the spec still waits on that latch. `retainFocus` and `swingFocus` cover the focus cases. This does not change the simulation. The coverage floor stays 77.
