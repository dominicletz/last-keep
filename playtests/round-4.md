# Playtest round 4

Target: https://agentyard.letz.tw after pull request 10. Room `ZT4PJ2`. The same five specialists, one room. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer.

Shots: `playtests/round-4/shots/`.

This round is the comparison with round 3, room `64MLX4`.

## Gameplay

Ada pressed start. The corner said `Next: 2 goblins`. The raise control said `Raise the keep 24 wood 8 gold` and sat on its own, beside `Copy invite`.

Wave 1 opened with the yard empty, the keep at 900, and the clock at frenzy in 60 seconds. The call on the grass said `2 goblins`. Round 3's same moment said the single word `goblin`, and the party stood still until the bites had started. This time the party clicked the red body when it arrived. Both died. The build for wave 2 opened at 2 kills, score 1020, gold 2, and the keep still 900. Round 3 left that keep at 624.

Wave 2 opened at frenzy in 59 seconds with 7 monsters and the keep still 900. The pack was not in the yard. Left alone, they reached the door, Ada fell to 6 health, and the keep fell on wave 2 with those same 2 kills. The minute is still the fight. Gold stayed 2, so the raise was not paid. The control is inert at that price and it is still painted like a live button.

Top 3:

1. A pair off the yard now reads as `2 goblins`, and wave 1 can end with the keep full. `playtests/round-4/shots/12-Ada.png`, `playtests/round-4/shots/03-Ada.png`
2. Wave 2 still deletes an unattended keep once the seven arrive. `playtests/round-4/shots/04-Ada.png`
3. Raise the keep looks ready at gold 2. A click did not spend the wood.

## Graphics

Lux saw the top bar stay readable. `Copy invite`, the raise control, and the roster each have their own place. On the first second of wave 2 the yard was empty of bodies and the grass carried the calls: `skeleton`, `2 goblins`, `goblin`. No red slab covered the wood chip or the roster. Round 3's wave 2 picture was those slabs. `playtests/round-4/shots/15-Ada.png`

One `skeleton` call sits on Pip's roster row. When the seven reach the door they are large foreground bodies, two of them stacked, and a sliver can touch the bottom of the wood chip. The buttons stay readable. `playtests/round-4/shots/16-Ada.png`

The outer ring is still bare grey trunks. The green cones are the trees.

Top 3:

1. The slab over the top bar is gone. `playtests/round-4/shots/15-Ada.png` against `playtests/round-3/shots/08-Ada.png`
2. A call can sit on a roster name. `playtests/round-4/shots/15-Ada.png`
3. Two bodies at the door still read as one. `playtests/round-4/shots/02-Lux.png`

## Music and sound

Bram heard nothing. Start, the clear, the second night, and the fall were silent. LK-024 stays open. A wave that begins a minute out still has no horn.

Top 3:

1. The build is silent.
2. The clear of wave 1 has no sting.
3. The fall of the keep has no hit.

## Game logic

Pip checked the shots against the snapshots and `docs/GAME-INTERACTIONS.md`.

| shot | screen | snapshot |
| --- | --- | --- |
| 12-Ada | empty yard, the call `2 goblins`, keep 900, frenzy in 60s | phase wave, wave 1, monsters 2, keep 900 |
| 03-Ada | Wave 2, Night in 30s, Next: 4 goblins, 3 skeletons, keep 900, gold 2 | phase build, wave 2, kills 2, score 1020, monsters 0, keep 900, wood 48 |
| 15-Ada | calls around an empty yard, keep 900, frenzy in 59s, gold 2 | phase wave, wave 2, monsters 7, keep 900, kills 2, score 1020 |
| 04-Ada | The keep has fallen. Wave 2. Survived 1. 2 kills. Score 1020. | phase over, keep 0, kills 2, score 1020 |

The 7 on the first second of wave 2 match the build line `4 goblins, 3 skeletons`. The keep's health did not move between that build and that second, so this pack did not spawn in the yard. Round 3's room showed the same spawn, then hid it under slabs. This room shows the calls.

Wood stayed 48 and gold stayed 2, so the raise edge did not spend. No card was offered. Food is still a number. Elites still do not drop relics (LK-021). The spire still does not unlock spells (LK-022). The city still does not grow on its own (LK-023).

Top 3:

1. Snapshot monsters 2, screen `2 goblins`. They agree. `playtests/round-4/shots/12-Ada.json`
2. Snapshot monsters 7 and keep 900 on the first second of wave 2. The yard is empty. `playtests/round-4/shots/15-Ada.json`
3. Food still has no sentence. LK-046.

## Character design

Nia read the same five roster rows: Nia Farmer, Ada Warrior, Lux Mage, Pip Scout, Bram Engineer. The names stay on the figures. The roster stayed visible when wave 2 started. Round 3 covered it with slabs.

The five bodies are still one block person. A color and a weapon separate them. The goblin pair is one red block with a floating 2. The skeletons are words on the grass until they arrive, and then they share that same block language.

Top 3:

1. The roster survives the start of wave 2. `playtests/round-4/shots/15-Nia.png`
2. Heroes still share one silhouette. `playtests/round-4/shots/01-Nia.png`
3. A goblin pair still has one outline. `playtests/round-4/shots/02-Lux.png`

## Aggregate

Held from the last deploy, and visible here:

1. The top bar is clear on the first second of wave 2. LK-040. `playtests/round-4/shots/15-Ada.png`
2. Copy invite, Raise the keep, and the roster no longer share a corner. LK-041. `playtests/round-4/shots/01-Ada.png`
3. A pair in one direction is `2 goblins`. LK-042. `playtests/round-4/shots/12-Ada.png`
4. Wave 1 ended at keep 900 once that call was readable. Wave 2 began at keep 900 with frenzy in 59 seconds. LK-029 held.

New or still open:

1. Medium, graphics. An edge call can cover a roster name. LK-047. `playtests/round-4/shots/15-Ada.png`
2. Medium, gameplay. The raise control looks live while gold is short. The click did not spend. LK-048.
3. Medium, graphics and character. Two bodies still read as one. LK-044. `playtests/round-4/shots/02-Lux.png`
4. High, music. The build is silent. LK-024.
5. Medium, character. Heroes share one silhouette. LK-045.
6. Wave 2, unattended, still brings the keep down. The spawn is far. The minute is the fight.
