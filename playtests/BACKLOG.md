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

## Open

| id | source | speciality | severity | item | status |
| --- | --- | --- | --- | --- | --- |
| LK-021 | Dominic, interaction graph | logic | high | Elites do not drop relics. CONCEPT.md says bosses and elites do. Only a boss drops one. | open |
| LK-022 | Dominic, interaction graph | gameplay | high | The spire does not unlock spells. It only raises mage damage and shortens mage cooldowns. | open |
| LK-023 | Dominic, interaction graph | gameplay | medium | There is no city-growth layer. The party places every building by hand. | open |
| LK-024 | queued playtest loop | audio | high | The game has no audio layer. The next playtest's music report should add ambient day/night, combat, hit, death, build, and a wave horn, starting with a first layer if the build is still silent. | open |
| LK-025 | queued playtest loop | gameplay | medium | Five specialists share one room through `e2e/playtest/`. The check is `e2e/playtest.spec.js`. | done |
| LK-026 | Dominic manual | logic | high | Monster bodies block, and a gap in a wall lets one through at a time. Guarded by "a gap in a long wall lets goblins through one at a time" and "two goblins that share a spot step apart". | done |
| LK-027 | Dominic manual | logic | high | Heroes stop on heroes and on monsters. The warrior dash is the pass through a monster. A scout dash stops. Guarded by "heroes and monsters stop on each other, and only the warrior dash passes". | done |
| LK-028 | Dominic manual | logic | high | The keep is solid. Heroes stop at the wall and monsters bite from the edge. Guarded by "the keep is solid and a monster bites it from the edge". | done |
| LK-029 | Dominic manual | gameplay | high | Wave 1 spawns about 620 to 659 out, and later waves spawn farther, on a map that clamps at 1800. Guarded by "wave 1 goblins spawn well outside the yard" and "wave 2 does not spawn in the yard". | done |
| LK-030 | Dominic manual | gameplay/graphics | medium | The outer ring is bare grey trunks with no wood. Green crowns are the trees that can be chopped. `Rules.scenery_ring/0` and `scenery.test.js`. | done |
| LK-031 | Dominic manual | gameplay | high | Raising the keep spends wood and gold, widens the build radius, and pulls the camera back. No card pick. Guarded by "raising the keep spends wood and gold and widens the town" and `town.test.js`. | done |
| LK-032 | Bram, round 1 | gameplay | high | After one wall the corner said "Too far" and a pale dot sat on the grass. No build range was drawn on the yard, and the trap never landed. `playtests/round-1/shots/02-Bram.png` | open |
| LK-033 | Bram, round 1 | graphics | high | The wall that cost 4 wood reads as a short black bar. A brown block appeared on the yard in the same beat, so the builder could not tell which shape was the wall. `playtests/round-1/shots/02-Bram.png` | open |
| LK-034 | Bram, round 1 | gameplay | high | The keep fell on wave 1 with 0 kills and 0 score while wood was still 40 and no trap was down. Re-check of LK-016: this room did not leave the keep high. The frenzy shot still showed 900/900 with one red stacked shape already on the yard. `playtests/round-1/shots/04-Bram.png`, `playtests/round-1/shots/05-Bram.png` | open |
| LK-035 | Bram, round 1 | graphics | medium | Two goblins stood in one red shape. They now step apart. Guarded by "two goblins that share a spot step apart". `playtests/round-1/shots/04-Bram.png` | done |
| LK-036 | Bram, round 1 | graphics | medium | Bram's health read 81/125 during frenzy and 125/125 on the fallen screen. `playtests/round-1/shots/04-Bram.png`, `playtests/round-1/shots/05-Bram.png` | open |
| LK-037 | Bram, round 1 | graphics | low | The invite button used to end past the window. The top bar now stays inside 1280px. Guarded by `e2e/playtest.spec.js`. `playtests/round-1/shots/01-Bram.png` | done |
| LK-038 | Ada, Lux, Bram, Pip, round 1 | graphics | high | The yard did not say which body was yours. Your name now sits on your figure, in the You line, and on your roster row. Guarded by `e2e/playtest.spec.js`. | done |
| LK-039 | Pip, round 1 | gameplay | medium | "Next goblin 2" did not read as a count. The line now says "Next: 2 goblins". Guarded by `assets/js/hud.test.js`. | done |

No implemented hero is isolated. Farmer, engineer, scout, warrior, and mage each have an outgoing edge in `docs/interactions.json`.
