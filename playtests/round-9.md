# Playtest round 9

Target: https://agentyard.letz.tw after the moss day, the cool dusk, the named phone builds, and the fight-zoom heroes. Room `6DB8UR`. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer. Kit joined the same room on an 844 by 390 phone and used the stick.

Shots: `playtests/round-9/shots/`.

This round is the comparison with round 8, room `7UA762`, round 7, room `EM9YG3`, round 6, room `KR8DDW`, and the round-5 baseline. The cottage plaza and the caption seating merged while the room was open and are not in these frames.

## Gameplay

Ada pressed start. The clock left `Waiting to start`. Dusk read `Night in 8s`. Wave 1 opened at keep 900 with `Frenzy in 60s`. The grass said `2 goblins` once. `playtests/round-9/shots/01-Ada.png`, `playtests/round-9/shots/04-Ada.png`

The party cleared the pair. The clear was score 1020, 2 kills, gold 2, wood 47, food 8, and keep 900. Round 8 cleared the same wave at the same score with gold 4. `playtests/round-9/shots/08-Ada.png`

Bram armed a wall. The click spent wood from 48 to 44. `playtests/round-9/shots/02-Bram.png`

Wave 2 opened with four goblins, three skeletons, and one wolf, keep 900. The clear was score 2100, 10 kills, gold 12, wood 72, keep 867. `playtests/round-9/shots/09-Ada.png`, `playtests/round-9/shots/10-Ada.png`

Raise was orange at that gold and wood. Ada was at (-232, -396). The click wrote `Stand by the keep` and left wood at 72, gold at 12, and town at 0. No houses were staked. LK-082. `playtests/round-9/shots/11-Ada.png`

Wave 3 opened at keep 867 with goblins, wolves, skeletons, one troll, and two bats. The keep was 291, with 15 kills, when the published snapshot stopped. `playtests/round-9/shots/12-Ada.png`, `playtests/round-9/shots/13-Ada.png`

Kit's stick walked the scout from (0.5, -120) to (-120, -240). The build row names Wall, Tower, Trap, Field, Forge, and Spire with their costs. `playtests/round-9/shots/05-Kit.png`, `playtests/round-9/shots/06-Kit.png`

Top 3:

1. Wave 1 still clears, and this seed says `2 goblins` once. The keep stayed at 900. `playtests/round-9/shots/04-Ada.png`, `playtests/round-9/shots/08-Ada.png`
2. The phone stick walks, and the build buttons name the building and the cost. `playtests/round-9/shots/05-Kit.png`
3. Raise stays orange away from the keep, and the click does not stake the town. LK-082. `playtests/round-9/shots/11-Ada.png`

## Graphics

The waiting yard is lit grass. The field sample is rgb(98, 136, 52), luminance 122, hue 87. Round 8's day was rgb(97, 110, 50), luminance 103, hue 73. The keep is a banded stone tower, pines stand inside the ring, and the paths are dirt. The outer ring is bare trunks. Three sacks sit at the foot of the tower. `playtests/round-9/shots/01-Ada.png`

`Night in 8s` is dusk. The same field sample is rgb(87, 75, 89), luminance 79, hue 291. Round 8's dusk was rgb(102, 73, 16), luminance 75, hue 40. The yard is violet, and the keep window stays warm. `playtests/round-9/shots/03-Ada.png`

The wave is night. The field sample is rgb(48, 50, 23), luminance 48, hue 64. A goblin call, a wolf, a troll, and bats are on the wave-3 yard. `playtests/round-9/shots/12-Ada.png`

On the phone, the food sack covers `You Kit 100 / 100`, the roster runs through the relic lines, and `2 goblins` sits on Shot. LK-083. `playtests/round-9/shots/05-Kit.png`, `playtests/round-9/shots/06-Kit.png`

Portrait is the rotate card. `playtests/round-9/shots/24-Kit.png`

The desktop wave line stays inside the window. Far from the keep, the roster still runs through the relic lines on this image. The caption seating that followed this room is not in these frames. `playtests/round-9/shots/12-Ada.png`

Top 3:

1. Day is moss and dusk is violet. The mustard day and the orange dusk are gone. `playtests/round-9/shots/01-Ada.png`, `playtests/round-9/shots/03-Ada.png`
2. The phone names its builds, and the sacks and the call sit on the health line and the Shot button. `playtests/round-9/shots/06-Kit.png`
3. The plaza is still the dark ring, and this room did not stake a house. `playtests/round-9/shots/01-Ada.png`, `playtests/round-9/shots/11-Ada.png`

## Music and sound

Ada's bus while the party waited was the day loop, unmuted. The wall click added `build`. The wave added `night` and `horn`, and the loop name became `night`. The clear recorded `hit`, `kill`, and `sting`, and the loop name went back to `day`. A bite on the keep recorded `keep-hit`. `playtests/round-9/shots/01-Ada.json`, `playtests/round-9/shots/02-Bram.json`, `playtests/round-9/shots/04-Ada.json`, `playtests/round-9/shots/08-Ada.json`, `playtests/round-9/shots/10-Ada.json`

The room did not reach the fall, so `fall` is not on this bus. Mute was not reloaded.

Top 3:

1. The night opens with a horn, and the bus records it. `playtests/round-9/shots/04-Ada.json`
2. The clear plays the sting and the kill and returns to the day loop. `playtests/round-9/shots/08-Ada.json`
3. A bite on the keep is `keep-hit`. `playtests/round-9/shots/10-Ada.json`

## Game logic

Waiting snapshot: phase `build`, wave 1, wood 48, food 8, gold 0, keep 900, monsters 0, light `day`. The screen says `Waiting to start` and `2 goblins`. The field sample is luminance 122, hue 87. `playtests/round-9/shots/01-Ada.json`

Dusk snapshot: light `dusk`, clock `Night in 8s`, field luminance 79, hue 291. `playtests/round-9/shots/03-Ada.json`

Wave 1 snapshot: two monsters, both `goblin`. The screen says `2 goblins` once. `playtests/round-9/shots/04-Ada.json`

Clear snapshot: phase `build`, kills 2, score 1020, gold 2, wood 47, keep 900, light `day`. The sign says Wave 2. `playtests/round-9/shots/08-Ada.json`

Wave 2 snapshot: four `goblin`, three `skeleton`, one `wolf`. The clear is 10 kills, score 2100, gold 12, keep 867. `playtests/round-9/shots/09-Ada.json`, `playtests/round-9/shots/10-Ada.json`

Wave 3 snapshot: goblins, wolves, skeletons, one `troll`, two `bat`. The calls are `4 goblins`, `3 skeletons`, `troll`, `2 wolves`, `bat`, `wolf`, and `bat`. `playtests/round-9/shots/12-Ada.json`

After the keep reached 291, Ada, Lux, Bram, and Kit all stayed on Frenzy in 43s, 15 kills, and keep 291. LK-084. `playtests/round-9/shots/13-Ada.json`, `playtests/round-9/shots/19-Bram.json`

Top 3:

1. Wave 1 is two goblins and one `2 goblins` call. `playtests/round-9/shots/04-Ada.json`
2. The wolf, the troll, and the bats are in the wave-3 snapshot. `playtests/round-9/shots/12-Ada.json`
3. The published snapshot then stops. Every seat holds the same tick. LK-084. `playtests/round-9/shots/13-Ada.json`

## Character design

The create screen is five cards. Warrior is selected with a gold outline. `playtests/round-9/shots/00-home-picker.png`

The roster reads Pip Scout, Kit Scout, Bram Engineer, Nia Farmer, Ada Warrior, Lux Mage. Up close, Ada's shield is the blue mark and Bram's hammer is the brown mark. The model bounds run from 82 to 107. At the wave-3 camera the bodies are still small next to the pines. `playtests/round-9/shots/01-Ada.png`, `playtests/round-9/shots/12-Ada.png`

Kit's phone buttons are Dash, Shot, Mark, and Volley, each with a portrait. `playtests/round-9/shots/05-Kit.png`

Top 3:

1. The picker is portrait cards. `playtests/round-9/shots/00-home-picker.png`
2. The shield and the hammer still separate the warrior and the engineer up close. `playtests/round-9/shots/01-Ada.png`
3. The phone skills name the scout's Dash, Shot, Mark, and Volley. `playtests/round-9/shots/05-Kit.png`

## Fidelity

Scored against the concept sheets from this yard. 1 is unlike the sheet. 5 would be the sheet at game zoom. Rounds 5 through 8 stay. This room's image is the fight-zoom deploy. The cottage plaza merged during the room and is not in these frames, so town stays where round 8 left it.

| area | round 5 | round 6 | round 7 | round 8 | round 9 | note |
| --- | --- | --- | --- | --- | --- | --- |
| mood | 1 | 2 | 3 | 4 | 4 | Day is rgb(98, 136, 52), luminance 122, hue 87. Dusk is rgb(87, 75, 89), luminance 79, hue 291. Night is rgb(48, 50, 23), luminance 48. The mustard day and the orange dusk are gone. The yard is still a flat wash. |
| town | 2 | 3 | 3 | 3 | 3 | The keep is a banded stone tower with pines and dirt paths, and Bram's wall spent 4 wood. Raise did not stake a house. The plaza is still a dark ring and the outer ring is bare trunks. |
| heroes | 2 | 3 | 3 | 3 | 4 | The shield, the hammer, the hood, the brim, and the staff are on the models, and the bounds run from 82 to 107. At the wave-3 camera the bodies are still small beside the pines. |
| monsters | 2 | 3 | 4 | 5 | 5 | Wave 3 had goblins, skeletons, wolves, a troll, and two bats. The rider was not in this room. The meshes are still voxels. |
| ui | 2 | 3 | 4 | 4 | 4 | The food sack names the feast, wave 1 is one `2 goblins` call, and the desktop wave line stays in the window. On the phone the food sack covers the health line and the call sits on Shot. |

## Aggregate

Held from round 8, and visible here:

1. The night is not silent. Day, build, horn, night, hit, kill, sting, and keep-hit are on the bus. LK-024 held.
2. Wave 1 is one `2 goblins` call. `playtests/round-9/shots/04-Ada.png`
3. The day field is moss, luminance 122 and hue 87, and dusk is the violet step, hue 291. LK-077 held.
4. The phone stick walks, and the build row names the building and the cost. `playtests/round-9/shots/05-Kit.png`

Still open, and what this room added:

1. Medium, gameplay. Raise stays orange away from the keep, and the click does not stake houses. LK-082. `playtests/round-9/shots/11-Ada.png`
2. Medium, graphics. On the phone, the food sack covers the health line and `2 goblins` sits on Shot. LK-083. `playtests/round-9/shots/06-Kit.png`
3. Medium, logic. After keep 291 on wave 3, every seat holds Frenzy in 43s. LK-084. `playtests/round-9/shots/13-Ada.json`

What got tighter on this image, and what the yard still refuses:

- The day sample moved from hue 73 to hue 87, and dusk moved from hue 40 to hue 291.
- The phone can walk and can read its build names.
- The town did not grow, and the snapshot stopped before the rider.
