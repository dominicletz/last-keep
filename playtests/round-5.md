# Playtest round 5

Target: https://agentyard.letz.tw after pull request 12 (audio, silhouettes, the build ring, and edge calls that step off the roster). Room `ME475J`. The same five specialists, one room. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer.

Shots: `playtests/round-5/shots/`.

This round is the comparison with round 4, room `ZT4PJ2`.

The image for that merge was already serving when this room opened. The deploy workflow's browser step had failed once on the five-player walk (travel stayed 0). The same check, run again against this production build, passed. The room below is that build: the Sound control is on the bar, and the figure hook lists five different bodies.

## Gameplay

Ada pressed start. The corner said `Next: 2 goblins`. The clock left `Waiting to start` and counted `Night in 10s`, then `Night in 9s`. The raise control still read `Raise the keep 24 wood 8 gold` at gold 0, in the same brown as Copy invite.

Wave 1 opened with an empty yard, the keep at 900, and `Frenzy in 58s`. Round 4's same moment was one call, `2 goblins`. This seed drew the pair across two edges, and the grass said `goblin` twice, once on the right and once along the bottom. Neither word sat on a roster name. `playtests/round-5/shots/06-Ada.png`

The party met them in the trees. One died, gold went to 2, and the keep stayed 900. Bram's armed wall placed a brown block and the wood chip dropped to 44, then chopping put it back. The second goblin died in the frenzy. The build for wave 2 opened at 2 kills, score 1020, gold 3, wood 70, and the keep still 900. Round 4 cleared the same wave at score 1020 and keep 900 with gold 2, because that party did not walk into the trees. `playtests/round-5/shots/15-Ada.png`

Left alone, wave 2 reached the door and the keep fell. The panel said wave 2, survived 1, 2 kills, score 1020. That is the same fall as room `ZT4PJ2`. Gold was still 3, so the raise was not paid. The control is still painted like a live button. `playtests/round-5/shots/16-Ada.png`

Arming Bram's wall drew a yellow ring around his reach and the yard said `Too close to the keep` while the ghost sat on the tower. `playtests/round-5/shots/03-Bram.png`

Top 3:

1. Wave 1 can still end at keep 900. The call is readable, and this seed split it into two `goblin` words. `playtests/round-5/shots/06-Ada.png`
2. Wave 2, unattended, still deletes the keep. `playtests/round-5/shots/16-Ada.png`
3. Raise the keep still looks ready at gold 3. LK-048.

## Graphics

Lux saw five bodies in the hook, and the picture separates them by prop: a red shield, a blue robe and staff, a green hood, a wide yellow brim, and a hammer. They still stand as blocks. The brim reads as a yellow slab when Nia is a little way off. The yard is flat olive daylight. The keep is a grey box with a red roof on an orange octagon. The outer ring is still bare trunks. `playtests/round-5/shots/04-Ada.png`

The build ring is a yellow octagon on the grass, large enough to read, and it is absent until a build is armed. `playtests/round-5/shots/03-Bram.png`

Wave 1's two calls sat on the grass, not on the roster and not across the wood chip. Round 4 had one `skeleton` call on Pip's row. That overlap did not come back in this room. The wall Bram paid for is still a short brown block. LK-033. `playtests/round-5/shots/08-Ada.png`

At the fall, the seven are a pile of blocks at the door. They are not a slab across the top bar. Each row in the snapshot has its own spread. The pile still reads as one mass. `playtests/round-5/shots/16-Ada.png`

The chrome is still panels: wood, food, and gold are one chip, the clock is text, and score is a number. The diegetic pass is the queued theming work. This round does not open a second copy of that item.

Top 3:

1. The five hooks differ, and the props read at this zoom. The shapes are still blocks on a daylight yard. `playtests/round-5/shots/04-Ada.png`
2. Edge calls stayed off the roster. `playtests/round-5/shots/06-Ada.png`
3. The door pile still clumps, and the wall is still a brown block. `playtests/round-5/shots/16-Ada.png`, `playtests/round-5/shots/08-Ada.png`

## Music and sound

Bram's client unlocked on the first key. Ada's unlocked when she pressed start. Before that the bus had already stored `day` and the loop name was `day`, with `unlocked` false, which is the browser holding the synth until a gesture.

On the first second of wave 1 the bus read `day`, `night`, `horn`. Hits and a kill followed. Placing the wall added `build`. The clear added `day` and `sting`. The fall added `keep-hit` and `fall`. Round 4's same seats heard nothing.

The Sound control and the volume slider sit on the bar. This harness did not reload the page, so persistence is the automated check, not a second observation here. The loop name went to `silent` when the keep fell.

Top 3:

1. The night opens with a horn, and the bus records it. `playtests/round-5/shots/06-Ada.json`
2. The clear plays the sting and returns to the day loop. `playtests/round-5/shots/15-Ada.json`
3. The fall records `keep-hit` and `fall`. `playtests/round-5/shots/16-Ada.json`

## Game logic

Pip checked the shots against the snapshots and `docs/GAME-INTERACTIONS.md`.

| shot | screen | snapshot |
| --- | --- | --- |
| 06-Ada | empty yard, two `goblin` calls, keep 900, frenzy in 58s | phase wave, wave 1, monsters 2, keep 900, cues `day night horn` |
| 08-Ada | one red body, `slain`, wood 44, gold 2, keep 900 | phase wave, kills 1, score 10, a building is down |
| 15-Ada | Wave 2, Night in 35s, Next: 4 goblins, 3 skeletons, score 1020, keep 900 | phase build, wave 2, kills 2, score 1020, monsters 0, keep 900, wood 70, gold 3 |
| 16-Ada | The keep has fallen. Wave 2. Survived 1. 2 kills. Score 1020. | phase over, keep 0, kills 2, score 1020, 7 monsters still listed, cues include `keep-hit` and `fall` |

The two wave-1 goblins are ids 36 and 37, spreads `(6, -6)` and `(-7, 7)`. The gap is about 18. They were off the screen when the call split, so the split is the octant bucket, not two meshes drawn as one.

The 7 on the fallen screen are 4 goblins and 3 skeletons. That matches the build line `4 goblins, 3 skeletons`. No card was offered. Food is still a number. Elites still do not drop relics (LK-021). The spire still does not unlock spells (LK-022). The city still does not grow on its own (LK-023).

Top 3:

1. Snapshot monsters 2, and the screen shows two calls. They agree that two exist. The words are singular. `playtests/round-5/shots/06-Ada.json`
2. The clear snapshot matches the panel: score 1020, keep 900, next wave `4 goblins, 3 skeletons`. `playtests/round-5/shots/15-Ada.json`
3. Food still has no sentence. LK-046.

## Character design

Nia read the same five roster rows: Nia Farmer, Bram Engineer, Pip Scout, Ada Warrior, Lux Mage. The names sit on the figures. The roster stayed visible when wave 1 started and when the keep fell.

The create screen is still a form. Each hero is a name, a one-line role, and a small color swatch. Warrior is selected with a gold outline. There is no portrait. The queued card pass is the theming item for that picker. `playtests/round-5/shots/home-picker.png`

On the yard the warrior reads as the shield, the mage as the blue robe and staff, the scout as the green hood, the engineer as the hammer and apron, and the farmer as the wide brim. That is ahead of round 4, where one block and a weapon did all the work. It is behind the concept sheet: no cross on the shield, no red cape, no crystal, no grain sack, no planks. The goblin is still a red block. The skeleton is a darker block in the same pile.

Top 3:

1. Five different bodies, readable by prop, still not the concept characters. `playtests/round-5/shots/04-Ada.png`
2. The picker is swatches and sentences, not cards. `playtests/round-5/shots/home-picker.png`
3. A goblin is still a red block. `playtests/round-5/shots/14-Ada.png`

## Fidelity

Scored against the concept sheets (dusk yard, the five hero figures, the monster line) before those sheets are in the repo. 1 is unlike the sheet. 5 would be the sheet at game zoom. These are the before scores for the theming round.

| area | score | note |
| --- | --- | --- |
| mood | 1 | Olive daylight. The sheet is dusk, dark pines, and warm windows. |
| town | 2 | A keep, a dirt octagon, and one torch. Not a stone tower, thatch, crops, or a palisade. |
| heroes | 2 | Five props match the roles. The meshes are still blocks. |
| monsters | 2 | A red goblin and, in the pile, skeletons. No ogre, wolf, bat, or dark rider. |
| ui | 2 | The ring, the calls, and the name tags are in the world. The stock, the clock, and the score are panels. |

## Aggregate

Held from round 4, and visible here:

1. Wave 1 can end with the keep at 900 once the party can see the call. LK-029 held. `playtests/round-5/shots/15-Ada.png`
2. Edge calls did not cover roster names. LK-047 held. `playtests/round-5/shots/06-Ada.png`
3. The build ring shows while a build is armed. LK-032 held. `playtests/round-5/shots/03-Bram.png`
4. The five heroes no longer share one silhouette. LK-045 held in the hook and, by prop, in the picture. `playtests/round-5/shots/04-Ada.png`
5. The night is no longer silent. LK-024 held: day, horn, night, hit, kill, build, sting, keep-hit, fall.

New or still open:

1. Low, gameplay. A wave-1 pair can straddle the octant bucket and read as two `goblin` words. LK-060. `playtests/round-5/shots/06-Ada.png`
2. Medium, gameplay. Raise the keep looks live while gold is short. LK-048. `playtests/round-5/shots/15-Ada.png`
3. High, graphics. The wall is still a brown block. LK-033. `playtests/round-5/shots/08-Ada.png`
4. High, gameplay. Wave 2, unattended, still fell at 2 kills and score 1020. Same numbers as room `ZT4PJ2`. `playtests/round-5/shots/16-Ada.png`
5. The door pile still clumps even though each body has its own spread. LK-044's offset is in the snapshot. `playtests/round-5/shots/16-Ada.png`
6. Food is still a number. LK-046.
