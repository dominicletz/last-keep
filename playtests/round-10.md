# Playtest round 10

Target: https://agentyard.letz.tw after the phone seats, the woods raise, and the wave clock. Room `WCZY6G`. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer. Kit joined the same room on an 844 by 390 phone and used the stick.

Shots: `playtests/round-10/shots/`.

This round is the comparison with round 9, room `6DB8UR`, round 8, room `7UA762`, round 7, room `EM9YG3`, round 6, room `KR8DDW`, and the round-5 baseline.

## Gameplay

Ada pressed start. The clock left `Waiting to start`. Dusk read `Night in 6s`. Wave 1 opened at keep 900 with `Frenzy in 57s`. The grass said `2 goblins` once. `playtests/round-10/shots/02-Ada.png`, `playtests/round-10/shots/07-Ada.png`, `playtests/round-10/shots/08-Ada.png`

The party walked to the pair and struck. The clear was score 1020, 2 kills, gold 3, wood 56, and keep 900. The clock read `Night in 31s`. Round 9 cleared the same wave at the same score with gold 2. `playtests/round-10/shots/12-Ada.png`

Raise asked for 24 wood and 8 gold. The sack had gold 3 and wood 65, so the button stayed disabled. Ada was at (-122, -252). The click did not spend, did not write `Stand by the keep`, and left town at 0. This room never held the 8 gold a raise costs, so the woods stake from LK-082 was not on the bar. `playtests/round-10/shots/15-Ada.png`

Wave 2 opened with four goblins, three skeletons, and one wolf. The party did not strike again. The keep fell. The panel says Wave 2, survived 1, 2 kills, score 1020. Ada was still up at 142, Bram was down at 0, and Lux was up at 90. `playtests/round-10/shots/17-Ada.png`, `playtests/round-10/shots/18-Bram.json`, `playtests/round-10/shots/19-Lux.json`

Kit's stick walked the scout from (0.5, -120) to (-189, -196). The build row names Wall, Tower, Trap, Field, Forge, and Spire with their costs. `playtests/round-10/shots/05-Kit.png`

Top 3:

1. Wave 1 still clears at keep 900, and this seed says `2 goblins` once. `playtests/round-10/shots/08-Ada.png`, `playtests/round-10/shots/12-Ada.png`
2. The phone stick walks, and the build buttons name the building and the cost. `playtests/round-10/shots/05-Kit.png`
3. Raise stays disabled at gold 3. The click does not spend, and it does not say to stand by the keep. `playtests/round-10/shots/15-Ada.png`

## Graphics

The waiting yard is green grass, dirt paths, and a round plaza. The top-right grass of the frame is rgb(79, 89, 42). The field sample is rgb(92, 100, 58), luminance 95, hue 71. Round 9's day sample was rgb(98, 136, 52), luminance 122, hue 87. The keep is a banded stone tower with a lit window and pines. The plaza reports 48 sides. The outer ring is 70 stumps and a pine wall of 86, with no wood on those trunks. `playtests/round-10/shots/02-Ada.png`

`Night in 6s` is dusk. The same top-right patch is rgb(74, 59, 28). The field sample is rgb(112, 72, 38), luminance 78, hue 28. Round 9's dusk sample was rgb(87, 75, 89), hue 291. This image is the warm edge. The keep window stays lit. `playtests/round-10/shots/07-Ada.png`

The wave is night. The opening field sample is rgb(30, 32, 14), luminance 30. The fallen frame's field sample is rgb(48, 50, 23), luminance 48, the same night as round 9. `playtests/round-10/shots/08-Ada.png`, `playtests/round-10/shots/17-Ada.png`

On the phone at 844 by 390, `You Kit` sits at y 132 to 151 and the food sack sits at y 248 to 318. The wood sack ends at x 569 and Shot starts at x 679. The call is one `2 goblins`. LK-083 held. `playtests/round-10/shots/05-Kit.png`, `playtests/round-10/shots/09-Kit.png`

Portrait is the rotate card. `playtests/round-10/shots/06-Kit.png`

Top 3:

1. Day stays green and dusk is the warm edge, hue 28, not round 9's violet. `playtests/round-10/shots/02-Ada.png`, `playtests/round-10/shots/07-Ada.png`
2. The phone health line, the sacks, and Shot keep their own seats. `playtests/round-10/shots/09-Kit.png`
3. The plaza is a 48-sided disc and the outer ring is stumps. This room did not stake a house. `playtests/round-10/shots/02-Ada.png`, `playtests/round-10/shots/15-Ada.png`

## Music and sound

Ada's bus while the party waited was the day loop, unmuted, volume 0.7. The wave added `night` and `horn`. The clear recorded `hit`, `kill`, and `sting`. The fall recorded `fall` and `keep-hit`. `playtests/round-10/shots/02-Ada.json`, `playtests/round-10/shots/08-Ada.json`, `playtests/round-10/shots/12-Ada.json`, `playtests/round-10/shots/17-Ada.json`

Mute was not reloaded.

Top 3:

1. The night opens with a horn, and the bus records it. `playtests/round-10/shots/08-Ada.json`
2. The clear plays the sting and the kill. `playtests/round-10/shots/12-Ada.json`
3. The fall is `fall`, and the bites on the keep are `keep-hit`. `playtests/round-10/shots/17-Ada.json`

## Game logic

Waiting snapshot: phase `build`, wave 1, wood 48, food 8, gold 0, keep 900, monsters 0, light `day`, tick 436. The screen says `Waiting to start` and `2 goblins`. `playtests/round-10/shots/02-Ada.json`

Dusk snapshot: light `dusk`, clock `Night in 6s`, tick 874. `playtests/round-10/shots/07-Ada.json`

Wave 1 snapshot: two monsters, both `goblin`. The screen says `2 goblins` once and `Frenzy in 57s`. Tick 1041. `playtests/round-10/shots/08-Ada.json`

Clear snapshot: phase `build`, kills 2, score 1020, gold 3, wood 56, keep 900, light `day`, tick 1519. The sign says Wave 2 and `Night in 31s`. The next line is `4 goblins`, `3 skeletons`, `1 wolf`. `playtests/round-10/shots/12-Ada.json`

Raise snapshot: gold 3, wood 65, town 0, Ada at (-122, -252). The button is disabled. `playtests/round-10/shots/15-Ada.json`

Fallen snapshot: phase `over`, clock `Fallen`, keep 0, kills 2, score 1020, tick 3409. The yard still has four `goblin`, three `skeleton`, and one `wolf`. Ada's health is 142 and she is alive. Bram's health is 0 and he is down. Lux's health is 90 and she is alive. The tick moved from 1041 at `Frenzy in 57s` through the clear and on to the fall. LK-084 held. `playtests/round-10/shots/17-Ada.json`, `playtests/round-10/shots/18-Bram.json`, `playtests/round-10/shots/19-Lux.json`

Top 3:

1. Wave 1 is two goblins and one `2 goblins` call. `playtests/round-10/shots/08-Ada.json`
2. The clock leaves `Frenzy in 57s`, counts the day after the clear, and reads `Fallen` when the keep hits 0. `playtests/round-10/shots/12-Ada.json`, `playtests/round-10/shots/17-Ada.json`
3. A wounded warrior stays at 142 on the fallen snapshot, and a downed engineer stays at 0. `playtests/round-10/shots/17-Ada.json`, `playtests/round-10/shots/18-Bram.json`

## Character design

The create screen is five cards. `playtests/round-10/shots/01-home-picker.png`

The roster reads Lux Mage, Ada Warrior, Nia Farmer, Bram Engineer, Kit Scout, Pip Scout. The model bounds are warrior 92, mage 102, engineer 99, scout 88, and farmer 98. The marks are shoulders and shield, robe hat and staff, apron and hammer, hood and bow, brim and fork. `playtests/round-10/shots/02-Ada.json`

Kit's phone buttons are Dash, Shot, Mark, and Volley. Dash, Mark, and Volley are 68 by 68. Shot is 86 by 86. `playtests/round-10/shots/05-Kit.png`

Top 3:

1. The picker is portrait cards. `playtests/round-10/shots/01-home-picker.png`
2. The shield, the staff, the hammer, the bow, and the fork are on the models. `playtests/round-10/shots/02-Ada.png`
3. The phone skills name the scout's Dash, Shot, Mark, and Volley. `playtests/round-10/shots/05-Kit.png`

## Fidelity

Scored against the concept sheets from this yard. 1 is unlike the sheet. 5 would be the sheet at game zoom. Rounds 5 through 9 stay.

| area | round 5 | round 6 | round 7 | round 8 | round 9 | round 10 | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mood | 1 | 2 | 3 | 4 | 4 | 4 | Day field rgb(92, 100, 58), luminance 95, hue 71. Dusk field rgb(112, 72, 38), luminance 78, hue 28, the warm edge. Night rgb(48, 50, 23), luminance 48. The yard is still short of the painted pines. |
| town | 2 | 3 | 3 | 3 | 3 | 4 | The plaza is a 48-sided disc, the keep is banded stone with a lit window, and the outer ring is stumps plus a pine wall of 86. Gold 3 never staked a house. |
| heroes | 2 | 3 | 3 | 3 | 4 | 4 | Shield, staff, hammer, bow, and fork are on the models. Bounds run from 88 to 102. The bodies are still voxels. |
| monsters | 2 | 3 | 4 | 5 | 5 | 5 | Wave 1 was two goblins. Wave 2 had goblins, skeletons, and a wolf. The troll, the bat, and the rider were not in this night. The meshes are still voxels. |
| ui | 2 | 3 | 4 | 4 | 4 | 4 | Wave 1 is one `2 goblins` call, Raise is disabled at gold 3, and the phone health line, sacks, and Shot do not share a box. The glass bar remains. |

## Aggregate

Held from round 9, and visible here:

1. The night is not silent. Day, horn, night, hit, kill, sting, keep-hit, and fall are on the bus. LK-024 held.
2. Wave 1 is one `2 goblins` call, and the clear is score 1020 at keep 900. `playtests/round-10/shots/08-Ada.png`, `playtests/round-10/shots/12-Ada.png`
3. The phone stick walks, and the food sack does not cover `You Kit`. LK-083 held. `playtests/round-10/shots/05-Kit.png`, `playtests/round-10/shots/09-Kit.png`
4. The clock moves from `Frenzy in 57s` through the clear to `Fallen`. Tick 1041 became tick 3409. LK-084 held. `playtests/round-10/shots/17-Ada.json`
5. A downed engineer stays at 0 on the fallen snapshot, and the wounded warrior stays at 142. `playtests/round-10/shots/18-Bram.json`

LK-094, LK-095, and LK-096. The purse stayed at 3 gold after 2 kills, under the 8 a raise costs, so LK-082's woods stake was not replayed. Wave 2 fell the keep with no counterattack. The click did not write `Stand by the keep`. The town rework of the disabled button owns that hint.

What got tighter on this image, and what the yard still refuses:

- Dusk is the warm edge, hue 28, where round 9's sample was violet, hue 291.
- The phone seats measured clear at 844 by 390.
- The town ring was not staked, and this night ended on wave 2 before a troll, a bat, or the rider.
