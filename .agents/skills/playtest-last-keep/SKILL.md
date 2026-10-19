---
name: playtest-last-keep
description: "Run a Last Keep playtest with five specialists in one shared room. Use when a round of human-like play should produce screenshots and a written report, not when the browser proof suite is the check."
disable-model-invocation: true
---

# Playtest Last Keep

Five specialists play together in one room. They do not split into separate games. Each one may pick a hero. The report is written from the speciality, not from the hero's role. The browser proof stays `.agents/skills/verify-last-keep/SKILL.md`. This skill does not copy the steps in `e2e/scenarios.js`.

## Harness

`e2e/playtest/room.js` joins the party. It calls `createHost` and `joinQuery` from `e2e/scenarios.js`. `e2e/playtest/cli.js` keeps that party open so each specialist can be driven one action at a time.

```sh
node e2e/playtest/cli.js serve playtests/live
node e2e/playtest/cli.js shot playtests/live
node e2e/playtest/cli.js act playtests/live '{"player":"Ada","hold":["KeyW"],"ms":800}'
node e2e/playtest/cli.js act playtests/live '{"player":"Bram","build":"1","click":{"x":700,"y":420}}'
node e2e/playtest/cli.js stop playtests/live
```

`shot` writes `playtests/live/shots/NN-Name.png` and a sibling `.json` snapshot. The snapshot is for the game-logic specialist and for the aggregate. Gameplay, graphics, music, and character design choose the next action from the picture. Clicks are pixels on the 1280 by 800 screenshot. Keys are `KeyW`, `KeyA`, `KeyS`, `KeyD`. `build` is `1` through `6`. `skill` is `q`, `e`, or `r`. `start` presses the host's start button.

Unset `BASE_URL` for a local server. Set it to `https://agentyard.letz.tw` to play the deployed game. The local Chrome path is `CHROME_PATH`.

Phones play with the touch joystick and the portrait buttons, in landscape. A feed tap uses the `f` bit, and lifting the thumb clears it so the next heal can rise. The build row names the building and its cost, and portrait is a full-screen rotate card. Far from the keep, the roster and the relic lines stay above the build bar. On a phone the food sack, the health line, the roster, the relic lines, the wave line, and the goblin call keep their own seats and stay off the buttons at 844×390, 667×375, and 932×430, including a goblin call on the side opposite the pack. The call is the walk sample that paints it. A north walk that stops gaining ground steps outward instead of sitting on KeyW, and the west mark stays x=-700. This harness stays the 1280 by 800 mouse and keyboard room. Do not drive a specialist with the stick.

`e2e/playtest.spec.js` is the harness check: five heroes, one roster, and a warrior who walks. The HUD captions (wave, relics, resources, roster, abilities, builds) should read on the yard without a stack of panels.

## Specialists

They share one room. The hero is only the seat they play.

1. Gameplay, Ada, warrior, host. Starts the night. Judges whether a minute of play is readable, fair, and worth another minute. Reads `docs/GAME-INTERACTIONS.md`.
2. Graphics, Lux, mage. Judges whether bodies, buildings, the yard, and the night read at a glance. The wave line sits in the yard and stays off the sacks and the other world pins. `pictureGrade` keeps four luma bands, a spread of at least 2, a focal median at least 5 luma off the near ground, and ground noise at or under 12. The clearing tile on `theme.jpg` is noisier than that cap, at 12.43.
3. Music and sound, Bram, engineer. Judges what is heard. Name the day loop, the night loop, the horn, the clear, and the hit, kill, build, keep, and fall cues if they play. If the build is silent, the report says so. Mute and volume should survive a reload.
4. Game logic, Pip, scout. Cross-checks the screenshot against the saved snapshot and against `docs/GAME-INTERACTIONS.md`. A planned edge is a finding. Screen and state that disagree are a finding. A hero's health on the fallen screen is the same snapshot the fight HUD reads. A downed hero is not refilled because the keep died on that tick.
5. Character design, Nia, farmer. Judges whether each hero and monster reads as that character at fight zoom, and whether the roster says who is who. A hero that only reads in the close-up is a finding. The warrior is steel plate, a helmet with a visor slit, pauldrons, a kite shield with a gold cross, and a silver sword. The mage is a pointed hat, a deep blue robe that flares, gold trim, and a staff. The scout is a green hood, a cloak, and a bow. The farmer is a straw hat, denim, and a pitchfork. A brim that covers the body is a finding. The engineer is leather, an apron, and a hammer. A hero whose head leaves the top of the frame is a finding. Steel that goes orange or mint at dusk or night is a finding. The yard figure is the concept card at world height 32. A card that covers the keep door, or whose ground disk meets another hero, is a finding. A side that is only a squashed front is a finding for the art pipeline, and it does not put the giant voxel mesh back. The pipeline score on the close-up is block p25 12 to 19, SSIM 0.118 to 0.398, silhouette IoU 0.404 to 0.502, and palette membership under 0.01. A monster is its crop from monsters.jpg. The goblin, skeleton, wolf, and bat stay under the hero. The wolf is 18 and the bat is 16 so the gameplay camera still clears 20 internal pixels. The troll and the rider stay under 1.75 keep doors. Their close-up score is block p25 5 to 16, SSIM 0.689 to 0.912, silhouette IoU 0.641 to 0.876, and on-palette membership at least 0.98. `readability` in `art_score.js` is the yard check: ink height and the silhouette gap against the ground under that pixel, at day, dusk, and night, on the path and on the grass. Height under 20 or contrast under 60 is a finding. The camera stays put. The bone rim is the palette step that lifts the edge.

## Report

`playtests/round-N.md` has one section per speciality, in the order above. Each section has what that lens saw, bugs with the screenshot path, and a top 3. The aggregate then dedupes and ranks by severity and how many specialists hit it. Disagreements stay in the list. Append every new finding to `playtests/BACKLOG.md`. Re-check items already marked done.

Upgrades come from buildings and finds. There is no card pick.

The waiting yard is a whole frame, not one patch. `frameMood` fails contrast under 9 or a lime share over 0.08. Dusk fails a cool wash over 0.25 or a warm tail under 0.03. Night fails the flat-field contrast. `frameGround` fails when the near-ground spread is under 8. That is the 25th percentile of block deviation from 42% to 90% of the frame, from the top. The framebuffer is flipped to top-down first. A bottom-up read scores the far wash. `twoPlayerNight` reads the framebuffer in day, dusk, and night. A formula that passes while the canvas is a flat tint is not a pass. The pine wall is `forestLook.wall`, at least 80, inside the seventy stumps and felled logs. The clearing is the concept tile at `theme.jpg` 312,276, and the keep stone, course, and joint wear the masonry crop at 640,100. Day snaps both crops to 1, 0.60, 0.50, and 0.40. Dusk snaps them to 0.60 and 0.50. The night tile is steps 0.50 and 0.40. Collapsing those greens to two colors drops block p25 under 8. The house, the field, the fence, the path, the forge, and the ground torch are phase tiles. The forge and the trap are standing cards. A flat trap sits under the path. The pine figure scores block p25 4, so the pine stays the mesh. Tower, the mage tower, the keep, and the felled wood still miss a tile floor, so they stay meshes. Six flame panes keep the far cottage at or above 619.

A bat or a dark rider that is darker than the night grass is not on the yard, even when the snapshot says the body is in frame. The wings are bone, the rider's helm and cuirass are plate, and both wear a bone rim. `paradeShowsEveryKind` reads those pixels.

Graphics fidelity uses `art_score` as well as the eye. The concept town crop has to clear block p25 8 and hard edge 0.05. The gallery keep ink is still under both. `readability` is one function. Monsters clear 20 pixels and contrast 60. Heroes on the path and the grass clear 32 and 29. The keep clears 197 and 25. Those floors only rise. A fidelity row in `playtests/BACKLOG.md` records those numbers beside the 1 to 5 score.

The town ring of houses is staked by the keep raise, and wheat beyond a click is farmer labor. The town cottages are timber and thatch and the outer ring is felled wood. A raise spends wood and gold only inside radius 100, and that raise stakes the ring. Feed still needs the hero beside the keep. The wave clock moves on every tick while the keep stands and the room is not waiting to start. Frenzy does not freeze the phase. The walk clamp is 7200. A cleared wave pays the gold the next raise costs. Wave 1 pays 8, on top of the kill bounties. A chest pays 24 gold once when a hero stands on it. Night 1 is still two goblins, on the bearings of the two nearest living portals. A broken portal is left out of that night. A quarry pays stone, an engineer takes 2 a tick and anyone else takes 1, and a sow on pine spends nothing. A pine cell pays 12 wood. A yard tree within 48 takes the chop. The seventy bare trunks stay bare. A camp wakes one vagrant for 8 gold. The ally follows the nearest living hero and uses that role's strike. The ally is not a seat. A shrine grants one relic the party does not hold. The hermit and the merchant stay planned. Fog is one discovered set. A scout reveals one extra chunk ring, and the map table at (0, 160) shows explored land within 80. The wave beacon stays the goblin line. A revealed chest or portal off screen is its own land beacon. Claimed land is the keep disc plus the chunk of a dead portal. A build outside both says the land is not held. A barricade on that land spends no wood. Generation stays off the hot tick: after every chunk exists, 20 ticks with 15 connected heroes leave the generator count put. Outside radius 100 the bar and the phone context button stay visible and disabled. Hover, click, and tap say `Walk to the keep`, and the server refuses. The control enables once the hero is in range and the purse covers the cost. Heartwood, granted once, raises the keep's max health by 280. A frame with a monster on screen stays at or under 700 draw calls and 9800 triangles. A bone rim the camera draws is one call and two triangles, and it stays its own sprite.
