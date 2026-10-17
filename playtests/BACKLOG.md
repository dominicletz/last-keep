# Playtest backlog

Every finding from a playtest lands here. A later round may close an item. It does not delete it.

Status is `open`, `in progress`, `done in PR #N`, or `won't do` plus a reason. A done item names the test that guards it.

The interaction graph is [`docs/GAME-INTERACTIONS.md`](../docs/GAME-INTERACTIONS.md). Gameplay and game logic review it each round. A `planned` edge in [`docs/interactions.json`](../docs/interactions.json) is an open item below.

## Done

| id | source | speciality | severity | item | status | test |
| --- | --- | --- | --- | --- | --- | --- |
| LK-001 | owner playtest, PR #2 round | graphics | high | Monsters and edge labels were missing on the yard | done in PR #4 | `expectGoblinsOnYard` |
| LK-002 | owner playtest, PR #4 round | gameplay | high | The build timer started before the party was ready | done in PR #4 | `the night waits until the host starts` |
| LK-003 | owner playtest, PR #4 round | gameplay | high | Walls could not be placed | done in PR #4 | `placeWall` |
| LK-004 | owner playtest, PR #4 round | logic | high | New keep left the room | done in PR #4 | `restart keeps the same party and waits again` |
| LK-005 | owner playtest, PR #4 round | logic | medium | Zero and blank high scores were listed | done in PR #4 | `scoreList` |
| LK-006 | owner playtest, PR #2 round | gameplay | high | An invite link showed the join form instead of entering | done in PR #2 | `twoPlayerNight` query join |
| LK-007 | Dominic, PR #5 round | graphics | high | Fireball was invisible | done in PR #5 | `a mage fireball damages a goblin and bursts`, `assertCombat` |
| LK-008 | Dominic, PR #5 round | logic | high | A click spent wood without a new building | done in PR #5 | `a refused wall does not spend wood, and an attack does not build`, `clickDoesNotSpendWithoutABuilding` |
| LK-009 | Dominic, PR #5 round | gameplay | high | The click that focused the window swung the weapon | done in PR #5 | `focusClickDoesNotAttack` |
| LK-010 | Dominic, PR #5 round | graphics | medium | The wave label flickered backwards | done in PR #5 | `the shown wave moves forward once when a wave clears`, `assertWaveStable` |
| LK-011 | Dominic, PR #5 round | graphics | medium | Forge, spire, and relic copy were missing from the HUD | done in PR #5 | `assertBonuses` |
| LK-012 | Dominic, PR #5 round | character | medium | Elites looked and behaved like ordinary monsters | done in PR #5 | `armor, a fast lunge, a forge, and a boss slam are different` |
| LK-013 | Dominic, PR #5 round | graphics | medium | Movement snapped between snapshots | done in PR #5 | `npm test` interpolation, `window.__lastKeep.smoothing` |
| LK-014 | Dominic, production VDQPTZ | graphics | high | Hit numbers sat still, and a goblin's bite read as a stuck 4 | done in PR #6 | `assertCombat` rising floater |
| LK-015 | Dominic, production VDQPTZ | gameplay | high | The first wall click after pressing 1 only showed the ghost | done in PR #6 | `placeWall` blur then one click |
| LK-016 | Dominic, production VDQPTZ | gameplay | high | Wave 1 reached the keep at once and two bites nearly downed the warrior | done in PR #6 | `two idle heroes who keep swinging clear wave 1 with the keep still high`, `a couple of wave 1 bites do not down the warrior` |
| LK-017 | Dominic, production VDQPTZ | graphics | medium | The run score appeared only after the keep fell | done in PR #6 | `twoPlayerNight` `[data-score]` |
| LK-018 | Dominic, production VDQPTZ | graphics | medium | WASD interpolation had not been checked on a moving hero | done in PR #6 | `movementIsInterpolated`, `a position update is interpolated and does not jump` |
| LK-019 | Dominic, production VDQPTZ | graphics | medium | An invalid placement reason stayed until the next action | done in PR #6 | `an invalid placement reason fades instead of sticking`, `invalidPlacementExplains` |
| LK-020 | Dominic, production VDQPTZ | graphics | medium | The picture stretched when the window was not 16:9 | done in PR #6 | `squarePixels`, `frame.test.js` |
| LK-058 | Dominic | graphics | high | The concept sheets were missing, so the gallery left the concept slot empty and the palette was copied from the builders. The sheets are `docs/concept/heroes.jpg`, `monsters.jpg`, and `theme.jpg`. Each gallery slot shows that asset's crop, and every palette token cites its sheet and region. | done in PR #18 | `npm run models`, `gallery.test.js` citation check |
| LK-061 | keep gallery, asset keep | graphics | high | The gallery day sky was brick `#8a4030`, dusk was maroon, and night was nearly black. Those fills were not sampled from `theme.jpg`. The grass token `#292b10` was a shadow at 460,374, 42 away from the thatch roof and 26 away from the moss, so it was not the roof, and it was not the clearing. The grass token now cites the moss, and the gallery backgrounds are shades of the blue-violet sky. | done in PR #22 | `sceneColorProblems`, `the gallery sky and the yard ground stay on the concept moss and dusk` |
| LK-062 | keep gallery, asset keep | graphics | high | At gallery zoom the keep was a small dark lump, and at night it disappeared. The concept keep is a tall stone belfry with crenellations, timber houses, a warm window, and pines behind it. The rank-0 keep now has those parts, and a night frame has to keep a lit window above the sky. | done in PR #22 | `nightLightProblems`, `the keep tower grows a course of stone at each rank` |
| LK-063 | keep gallery, asset keep | graphics | high | The concept keep is grey stone masonry with block courses and crenellations. The tower body was one brown `#554034`, sampled from a shaft course at 636,124. The stone token is now the lit belfry block, with a greyer course and a mortar joint, and the roof stays thatch. | done in PR #24 | `keepStoneProblems`, `the keep body stays near the belfry stone and is not one brown tone` |
| LK-064 | PR #23 hero sheets, assets warrior mage scout farmer engineer | graphics | high | At gallery and game zoom the new props were a handful of pixels, so the hero sheet could not be judged. The buffer is now 640×400, heroes stay at least 24px tall through rank 4, and each hero and monster has an 80px close-up beside the concept crop. Portraits are that close-up. | done in PR #25 | `heroHeightProblems`, `the gallery matches the goldens and a second run` |
| LK-065 | PR #25 after-shot, assets warrior mage scout farmer engineer | graphics | high | The warrior close-up was a brown block. The concept warrior is grey steel plate, a helmet, a blue shield with a gold cross, and a silver sword. Bodies now use the concept colors: warrior light grey plate and blue shield, mage deep blue with gold trim, scout forest green, farmer straw and denim, engineer leather. Day light no longer clips that grey to orange. | done in PR #26 | `heroColorProblems`, `a brown warrior close-up fails the concept palette` |
| LK-066 | PR #25 after-shot, asset town | graphics | high | The town plaza was a flat orange-brown octagon. The concept ground is mossy green grass with dirt paths and stone. The plaza fill is the grass token, the ring is the stone token, and the cross stays the path token. | done in PR #27 | `sceneColorProblems`, `the gallery sky and the yard ground stay on the concept moss and dusk` |
| LK-067 | PR #25 after-shot, asset keep | graphics | high | The live keep was the same brown read as a single shaft. The masonry courses are the in-game mesh, not only the gallery. The body is the shadowed belfry block, the lighter course is the lit face, and the mortar stays. The page reports those three colors. | done in PR #28 | `townLook.keepColors`, `twoPlayerNight` |
| LK-068 | PR #25 after-shot, asset hud | graphics | high | The HUD was a stack of opaque panels: the wave box, the relic panel, the resource box, the roster, the ability bar, and the build bar. Those slots are edge captions. A fill above 0.35, a border of 2px or more, or a combined box of 105000px or more fails. | done in PR #29 | `assertDiegeticHud`, `twoPlayerNight` |
| LK-069 | concept monsters.jpg, assets goblin skeleton wolf troll bat boss | graphics | high | The sheet has six bodies. The sim and the gallery had no bat, and the live boss was not the dark rider mesh. The six kinds are planned into the nights, night 1 stays two goblins, and the live mesh is the gallery model. | done | `the six concept monsters are in the nights`, `townLook.bestiary` |

## Open

| id | source | speciality | severity | item | status |
| --- | --- | --- | --- | --- | --- |
| LK-021 | Dominic, interaction graph | logic | high | Elites do not drop relics. CONCEPT.md says bosses and elites do. Only a boss drops one. | open |
| LK-022 | Dominic, interaction graph | gameplay | high | The spire does not unlock spells. It only raises mage damage and shortens mage cooldowns. | open |
| LK-023 | Dominic, interaction graph | gameplay | medium | There is no city-growth layer. The party places every building by hand. | open |
| LK-024 | queued playtest loop | audio | high | Day and night loops, a horn, a clear, and hit, kill, build, keep-hit, and fall cues. Mute and volume persist. Guarded by `audio.test.js` and `twoPlayerNight`. | done |
| LK-025 | queued playtest loop | gameplay | medium | Five specialists share one room through `e2e/playtest/`. The check is `e2e/playtest.spec.js`. | done |
| LK-026 | Dominic manual | logic | high | Monster bodies block, and a gap in a wall lets one through at a time. Guarded by "a gap in a long wall lets goblins through one at a time" and "two goblins that share a spot step apart". | done |
| LK-027 | Dominic manual | logic | high | Heroes stop on heroes and on monsters. The warrior dash is the pass through a monster. A scout dash stops. Guarded by "heroes and monsters stop on each other, and only the warrior dash passes". | done |
| LK-028 | Dominic manual | logic | high | The keep is solid. Heroes stop at the wall and monsters bite from the edge. Guarded by "the keep is solid and a monster bites it from the edge". | done |
| LK-029 | Dominic manual | gameplay | high | Wave 1 spawns about 620 to 659 out, and later waves spawn farther, on a map that clamps at 1800. Guarded by "wave 1 goblins spawn well outside the yard" and "wave 2 does not spawn in the yard". | done |
| LK-030 | Dominic manual | gameplay/graphics | medium | The outer ring is bare grey trunks with no wood. Green crowns are the trees that can be chopped. `Rules.scenery_ring/0` and `scenery.test.js`. | done |
| LK-031 | Dominic manual | gameplay | high | Raising the keep spends wood and gold, widens the build radius, and pulls the camera back. No card pick. Guarded by "raising the keep spends wood and gold and widens the town" and `town.test.js`. | done |
| LK-032 | Bram, round 1 | gameplay | high | Arming a build draws a ground ring the size of that hero's reach. Guarded by `rangeRingState` in `hud.test.js` and `twoPlayerNight`. `playtests/round-1/shots/02-Bram.png` | done |
| LK-033 | Bram, round 1 | graphics | high | The wall that cost 4 wood reads as a short black bar. A brown block appeared on the yard in the same beat, so the builder could not tell which shape was the wall. `playtests/round-1/shots/02-Bram.png` | open |
| LK-034 | Bram, round 1 | gameplay | high | The keep fell on wave 1 with 0 kills and 0 score while wood was still 40 and no trap was down. Re-check of LK-016: this room did not leave the keep high. The frenzy shot still showed 900/900 with one red stacked shape already on the yard. `playtests/round-1/shots/04-Bram.png`, `playtests/round-1/shots/05-Bram.png` | open |
| LK-035 | Bram, round 1 | graphics | medium | Two goblins stood in one red shape. They now step apart. Guarded by "two goblins that share a spot step apart". `playtests/round-1/shots/04-Bram.png` | done |
| LK-036 | Bram, round 1 | graphics | medium | Bram's health read 81/125 during frenzy and 125/125 on the fallen screen. `playtests/round-1/shots/04-Bram.png`, `playtests/round-1/shots/05-Bram.png` | open |
| LK-037 | Bram, round 1 | graphics | low | The invite button used to end past the window. The top bar now stays inside 1280px. Guarded by `e2e/playtest.spec.js`. `playtests/round-1/shots/01-Bram.png` | done |
| LK-038 | Ada, Lux, Bram, Pip, round 1 | graphics | high | The yard did not say which body was yours. Your name now sits on your figure, in the You line, and on your roster row. Guarded by `e2e/playtest.spec.js`. | done |
| LK-039 | Pip, round 1 | gameplay | medium | "Next goblin 2" did not read as a count. The line now says "Next: 2 goblins". Guarded by `assets/js/hud.test.js`. | done |
| LK-040 | Lux, round 3 room 64MLX4 | graphics | high | Monsters past the camera drew as giant red slabs across the top bar. Heroes and monsters whose center is outside the camera are left undrawn. Guarded by `assets/js/cull.test.js`. `playtests/round-3/shots/08-Ada.png` | done |
| LK-041 | Lux, round 3 room 64MLX4 | graphics | high | Raise the keep pushed Copy invite into the roster. The roster sits in the corner and the top bar keeps its boxes apart. Guarded by `e2e/playtest.spec.js`. `playtests/round-3/shots/03-Ada.png` | done |
| LK-042 | Ada, round 3 room 64MLX4 | gameplay | high | Two offscreen goblins read as the single word "goblin", so the yard looked empty until they were biting. One direction now shares a counted call. Guarded by `assets/js/hud.test.js` "offscreen monsters in one direction share a counted call". `playtests/round-3/shots/03-Ada.png` | done |
| LK-043 | Ada, round 3 room 64MLX4 | gameplay | medium | Raise the keep stayed pressable at gold 2 when the cost was 8. The button stays disabled until wood and gold both cover the cost. Guarded by `raiseReady` in `assets/js/hud.test.js` and by `e2e/playtest.spec.js`, which requires the control to be disabled at gold 0. | done |
| LK-044 | Lux, round 3 room 64MLX4 | graphics | medium | Two monsters draw with separate outlines, bars, and offsets. Guarded by `bodies.test.js` and `twoPlayerNight`. `playtests/round-3/shots/04-Ada.png` | done |
| LK-045 | Nia, round 3 room 64MLX4 | character | medium | Warrior, mage, scout, farmer, and engineer each build a different body. Guarded by `heroes.test.js` and `heroSilhouettes`. `playtests/round-3/shots/01-Nia.png` | done |
| LK-046 | Pip, round 3 room 64MLX4 | logic | low | Food is still only the number in the resource chip. The screen does not say what a feast spends it on. | open |
| LK-047 | Lux, round 4 room ZT4PJ2 | graphics | medium | An edge call stops short of the roster and is right-aligned there. Guarded by `callAnchor` in `hud.test.js` and `twoPlayerNight`. `playtests/round-4/shots/15-Ada.png` | done |
| LK-048 | Ada, round 4 room ZT4PJ2 | gameplay | medium | Raise the keep is inert while gold is short and it is painted like a live button. A click in room ZT4PJ2 did not spend wood or gold. Round 5 room ME475J still paints it live at gold 3. | open |
| LK-060 | Ada, round 5 room ME475J | gameplay | low | A wave-1 pair can straddle the 45-degree call bucket and the yard says "goblin" twice instead of "2 goblins". `playtests/round-5/shots/06-Ada.png` | open |

## Fidelity

Scores are 1 to 5 against the concept sheets. A later row for the same area may be lower only when Reason is non-empty. Round 5 is the before-theming baseline.

| asset | date | score | reason |
| --- | --- | --- | --- |
| mood | 2026-10-17 | 1 | Olive daylight. The sheet is dusk, dark pines, and warm torchlight. |
| town | 2026-10-17 | 2 | A box keep, a dirt octagon, and one torch. No stone tower, thatch, crops, or palisade. |
| heroes | 2026-10-17 | 2 | Five props match the roles. The meshes are still blocks. |
| monsters | 2026-10-17 | 2 | A red goblin and skeletons in the pile. No ogre, wolf, bat, or dark rider. |
| ui | 2026-10-17 | 2 | The ring, the calls, and the name tags are in the world. Stock, clock, and score are panels. |

No implemented hero is isolated. Farmer, engineer, scout, warrior, and mage each have an outgoing edge in `docs/interactions.json`.
