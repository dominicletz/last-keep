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
| LK-025 | queued playtest loop | gameplay | medium | Playtest rounds use five specialists in one room (gameplay, graphics, music and sound, game logic, character design). Each writes a section. The report ends with one ranked fix list. The roster is the playtest skill. The bots are not built yet. | open |
| LK-026 | Dominic manual | logic | high | Monsters overlap. They need server-side separation so a wall line can funnel them through a gap. | open |
| LK-027 | Dominic manual | logic | high | Heroes walk through each other and through monsters. Bodies should block. The warrior dash is the exception that passes through monsters. | open |
| LK-028 | Dominic manual | logic | high | The keep can be walked into. It should be solid for heroes and monsters, and monsters should bite it from the edge. | open |
| LK-029 | Dominic manual | gameplay | high | Monsters spawn on top of the yard. Push the spawn ring out, enlarge the map, and keep the time to reach the keep fair. | open |
| LK-030 | Dominic manual | gameplay/graphics | medium | A ring of trees is only scenery. Players cannot chop it. Make those trees harvestable, or draw them so they are obviously not wood, and say which in the interaction doc. | open |
| LK-031 | Dominic manual | gameplay | high | No keep upgrade. Spending wood and gold should enlarge the buildable town and pull the camera back, with no card pick. | open |

No implemented hero is isolated. Farmer, engineer, scout, warrior, and mage each have an outgoing edge in `docs/interactions.json`.
