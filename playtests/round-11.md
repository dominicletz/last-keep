# Playtest round 11

Target: https://agentyard.letz.tw after shared fog, claimed land, pine wood (#127), and the forge and trap cards. Room `BRG82T`. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer.

Shots: `playtests/round-11/shots/`.

#129, the remaining standing cards, was still open during the room, so this image did not have it. It merged after the room. #128, the wave-clear purse, merged while the room was open and was not on this image. #130, the wave 2 reach, was still open.

This round is the comparison with round 10, room `WCZY6G`, round 9, room `6DB8UR`, round 8, room `7UA762`, round 7, room `EM9YG3`, round 6, room `KR8DDW`, and the round-5 baseline.

## Gameplay

Ada pressed start. The clock left `Waiting to start` at `Night in 10s`. Wave 1 opened at keep 900 with `Frenzy in 57s`. The two goblins were on opposite sides, (62, -542) and (379, 416), so the grass said `goblin` twice and `portal` once. `playtests/round-11/shots/06-Ada.png`

The party walked to them and struck. The clear was score 1020, 2 kills, gold 2, wood 102, and keep 850. The clock read `Night in 28s`. Round 10 cleared the same wave at the same score with gold 3 and keep 900. Raise still asks for 8 gold. This image is the one before #128. `playtests/round-11/shots/07-Ada.png`

Wood went from 48 to 77 while the party stood in the yard. Ada was at the table. Bram, Lux, Nia, and Pip had not moved. Pip then walked to (666, -514) and wood went from 77 to 78. He did not stand on one pine cell, so a full cell of 12 was not seen. A wall click there, hypot 841, said `The land is not held.` and left wood at 78 and buildings at 0. Bram then placed a trap at (0, -180). Wood went from 78 to 72, the engineer's 6. The forge button asks for 30 wood and 14 gold. Gold was 0, so the forge was not placed. `playtests/round-11/shots/02-Ada.png`, `playtests/round-11/shots/04-Pip.png`, `playtests/round-11/shots/05-Bram.png`

Wave 2 opened as four goblins, three skeletons, and one wolf. At `Frenzy in 45s` the closest body was already hypot 204. Bram was on them at 5 health. The party struck. Kills went from 2 to 8 and gold from 2 to 9. The keep fell from 850 to 0. One goblin and one skeleton were still up. Pip was at (-646, 608) and did not reach the pack. `playtests/round-11/shots/08-Ada.png`, `playtests/round-11/shots/09-Ada.png`, `playtests/round-11/shots/11-Ada.png`

Top 3:

1. Wave 1 still clears at gold 2 on this image. The raise wants 8. `playtests/round-11/shots/07-Ada.png`
2. The wave 2 pack is in the yard, the party can hit it, and the keep still falls. `playtests/round-11/shots/11-Ada.png`
3. The yard paid 29 wood while the party stood still, and a wall outside the disc does not spend it. The walk across pine added 1. `playtests/round-11/shots/02-Ada.png`, `playtests/round-11/shots/04-Pip.png`

## Graphics

The waiting yard is green grass, dirt paths, and a banded stone keep with a lit window. The day field at (640, 500) is rgb(82, 96, 55), luminance 87. The night field at (200, 200) is rgb(46, 50, 24), luminance 46. Dusk was not held on a frame. `playtests/round-11/shots/01-Ada.png`, `playtests/round-11/shots/06-Ada.png`

Ada stood on the map table at (0, 160). The cloth flag was on and the snapshot listed 25 chunks, then 40 after Pip walked. The picture is a brown board with one pale mark. `playtests/round-11/shots/02-Ada.png`, `playtests/round-11/shots/04-Ada.png`

Pip at (666, -514) is past the last drawn chunk. The ground there is one flat olive field, and the pines stop on a hard diagonal. The edge says `portal`. `playtests/round-11/shots/03-Pip.png`, `playtests/round-11/shots/04-Pip.png`

The trap at (0, -180) is the ground torch card, a small fire on the path. It is not a mesh box. The forge card was not on the yard. #129's other standing cards were not on this image. The pines are still meshes. `playtests/round-11/shots/05-Bram.png`

Top 3:

1. The map cloth does not draw the chunks the snapshot lists. `playtests/round-11/shots/02-Ada.png`
2. Undiscovered ground is a flat olive cut. `playtests/round-11/shots/04-Pip.png`
3. The trap reads as the ground torch. `playtests/round-11/shots/05-Bram.png`

## Music and sound

Ada's waiting bus was the day loop, unmuted, volume 0.7, and still locked. The trap shot is unlocked. The trap added `build` on Ada's bus and on Bram's. The wave added `night` and `horn`. The clear recorded `hit`, `kill`, and `sting`. The fall recorded `fall` and `keep-hit`. `playtests/round-11/shots/01-Ada.png`, `playtests/round-11/shots/05-Bram.png`, `playtests/round-11/shots/06-Ada.png`, `playtests/round-11/shots/07-Ada.png`, `playtests/round-11/shots/11-Ada.png`

Mute was not reloaded.

Top 3:

1. The night opens with a horn, and the bus records it. `playtests/round-11/shots/06-Ada.png`
2. Placing the trap plays `build`. `playtests/round-11/shots/05-Bram.png`
3. The fall is `fall`, and the bites on the keep are `keep-hit`. `playtests/round-11/shots/11-Ada.png`

## Game logic

Waiting snapshot: phase `build`, wave 1, wood 48, gold 0, keep 900, monsters 0, light `day`. The screen says `Waiting to start` and `2 goblins`. Five seats are connected. Chunks differ by seat: Bram 16, Nia and Lux 20, Ada and Pip 25. The cloth is off. Chests and portals are absent. `playtests/round-11/shots/01-Ada.png`

Map snapshot: Ada within 80 of (0, 160), cloth on, 25 chunks from cx -2..2 and cy -2..2. Nia, still at (-97, 70), has 20 local chunks and no cloth. After Pip reached (651, -500), Ada's cloth listed 40 and Nia's local list stayed 20. The same portal, (180, -1584), is on every seat. `playtests/round-11/shots/02-Ada.png`, `playtests/round-11/shots/04-Ada.png`

The cloth picture does not match that list. One pale mark is on the board. `playtests/round-11/shots/02-Ada.png`

Land snapshot: Pip at hypot 841, the click said `The land is not held.`, wood stayed 78, buildings stayed 0. `playtests/round-11/shots/04-Pip.png`

Wave 1 snapshot: two goblins. The clear is phase `build`, kills 2, score 1020, gold 2, wood 102, keep 850, light `day`. The next line is `4 goblins`, `3 skeletons`, `1 wolf`. `playtests/round-11/shots/06-Ada.png`, `playtests/round-11/shots/07-Ada.png`

Wave 2 snapshot: eight bodies, keep 850, `Frenzy in 45s`, closest hypot 204. Mid-fight keep 452, kills 7, gold 8, Lux at 0 and down. The next shot, clock `Frenzied. They are faster`, keep 116, Lux is alive at 90. Fallen snapshot: phase `over`, clock `Fallen`, keep 0, kills 8, gold 9, score 1080. One goblin and one skeleton remain. Ada is 148 and alive. Nia is 87 and alive. Bram is 125 and alive. Pip is 100 and alive. Lux is 90 and alive. `playtests/round-11/shots/08-Ada.png`, `playtests/round-11/shots/09-Lux.png`, `playtests/round-11/shots/10-Lux.png`, `playtests/round-11/shots/11-Ada.png`

A downed hero returns at full kit health on the spawn ring. The wave wait is 160 ticks. The day wait is 40. The fallen phase does not respawn. That rule was missing from the graph. It is recorded now.

Top 3:

1. The shared discovered set grew on Ada's cloth while Nia's own chunk list did not. `playtests/round-11/shots/04-Ada.png`
2. The drawn cloth is one mark, not those 40 chunks. `playtests/round-11/shots/02-Ada.png`
3. Wave 1 on this image paid gold 2. Wave 2 fell the keep after the party had already reached the pack. `playtests/round-11/shots/07-Ada.png`, `playtests/round-11/shots/11-Ada.png`

## Character design

The roster reads Pip Scout, Bram Engineer, Nia Farmer, Ada Warrior, Lux Mage. The model bounds are height 32 for every hero. The marks are shoulders and shield, robe hat and staff, apron and hammer, hood and bow, brim and fork. `playtests/round-11/shots/01-Ada.png`

Bram's buttons say Mend, Wall, Trap, and Line. The trap on the path is a torch, not a hammer or a box. `playtests/round-11/shots/05-Bram.png`

Top 3:

1. The five roles read on the roster and on the figures. `playtests/round-11/shots/01-Ada.png`
2. The figures stay at height 32 and do not cover the keep door in the waiting frame. `playtests/round-11/shots/01-Ada.png`
3. The trap reads as a campfire. The forge was not on the yard. `playtests/round-11/shots/05-Bram.png`

## Fidelity

Scored against the concept sheets from this yard. 1 is unlike the sheet. 5 would be the sheet at game zoom. Rounds 5 through 10 stay.

| area | round 5 | round 6 | round 7 | round 8 | round 9 | round 10 | round 11 | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mood | 1 | 2 | 3 | 4 | 4 | 4 | 4 | Day field rgb(82, 96, 55), luminance 87. Night rgb(46, 50, 24), luminance 46. Dusk was not held. The yard is still short of the painted pines. |
| town | 2 | 3 | 3 | 3 | 3 | 4 | 4 | Banded keep, lit window, and the trap is the ground torch. The undiscovered ground is a flat olive cut. |
| heroes | 2 | 3 | 3 | 3 | 4 | 4 | 4 | Height 32. Shield, staff, hammer, bow, and fork are on the cards. |
| monsters | 2 | 3 | 4 | 5 | 5 | 5 | 5 | Two goblins, then goblins, skeletons, and a wolf. The troll, the bat, and the rider were not in this night. |
| ui | 2 | 3 | 4 | 4 | 4 | 4 | 3 | The map cloth is one pale mark while the snapshot lists 40 chunks. Raise stays dark at gold 0. The glass bar remains. |

## Aggregate

Held, and visible here:

1. The purse rose from 48 to 77 while four heroes stood still and Ada stood at the table. That is the yard-tree chop. Pip's walk to (666, -514) added 1 wood, not a full pine cell of 12, because he did not stand on one cell. LK-100's yard-tree half was visible. The pine cell was not isolated. `playtests/round-11/shots/02-Ada.png`, `playtests/round-11/shots/03-Pip.png`
2. A wall outside the disc says `The land is not held.` and spends nothing. LK-099 held. `playtests/round-11/shots/04-Pip.png`
3. The discovered set is shared. Ada's cloth went from 25 chunks to 40 while she stayed at the table, and Nia's local list stayed 20. The portal at (180, -1584) is on every seat. LK-093 held in the snapshot. `playtests/round-11/shots/04-Ada.png`
4. The night is not silent. Day, build, horn, night, hit, kill, sting, keep-hit, and fall are on the bus. LK-024 held.
5. The trap is the ground torch card and cost 6 wood. `playtests/round-11/shots/05-Bram.png`

LK-104 and LK-105. The cloth does not draw the chunks, and the fog edge is a flat fill.

LK-094 and LK-097, re-checked and not fixed here. On this image, before #128, wave 1 still paid gold 2. Wave 2 still fell the keep after the heroes had reached the pack. #130 owns that reach. #128 owns the purse and was not deployed for this room.

What got tighter on this image, and what the yard still refuses:

- The trap is a card. The forge was never placed, and #129's other cards were not live.
- The map's data is shared. The map's picture is one mark.
- This night ended on wave 2, before a troll, a bat, or the rider.
