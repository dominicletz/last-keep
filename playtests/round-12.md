# Playtest round 12

Target: https://agentyard.letz.tw at `e0e9fd8` (deploy run 41109556810). That image has the drawn swing from wave 2. Room `9GMEX3`. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer.

Shots: `playtests/round-12/shots/`.

The party stood on the join ring. Nobody walked to a spawn, a pine cell, or the map table. The attack button was held only on wave 1. From the wave 1 clear through the fall it stayed up, so those kills are the drawn swing. #130, the walk out to the pack, stayed unmerged. This round does not extend that swing and does not remove it.

This round is the comparison with round 11, room `BRG82T`, where the same pack reached the yard and the keep fell from 850 to 0.

## Gameplay

Ada pressed start. The clock left `Waiting to start` at `Night in 9s`. Wave 1 opened at keep 900 with `Frenzy in 60s` and two goblins. The nearest was 641 from Ada and 501 from Lux. `playtests/round-12/shots/02-Ada.png`

For eight seconds the button stayed up. Kills stayed 0. Every attack cooldown stayed 0. At tick 741 the nearest goblin was 317 from Lux, outside the bolt reach of 200, so that window does not show a body inside strike reach. `playtests/round-12/shots/03-Ada.png`

The button then went down and stayed aimed at the nearest body. At tick 752 every cooldown was up (Ada 300, Lux 400, Bram 50, Pip 200, Nia 300) while Lux's nearest was still 293. The two goblins died. The clear was score 1020, 2 kills, gold 10, wood 48, keep 900. Gold 10 is the rank-0 purse of 8 plus the two bounties. Raise still asks for 8 gold and 24 wood, and the party did not spend it. `playtests/round-12/shots/04-Ada.png`

Wave 2 opened as four goblins, three skeletons, and one wolf, keep 900, gold 10. The button stayed up. At tick 1753 Lux's cooldown was 200 and her nearest body was 110, inside the bolt reach, and the kill count was still 2. The next sample, tick 1792, was 3 kills. The pack was gone at tick 1978: 10 kills, gold 27, keep 900. Ada stayed at (120, 0). Her nearest body stayed past 270 and her cooldown stayed 0, so the warrior's melee never drew. Lux, Pip, and Nia carried the cooldowns. `playtests/round-12/shots/05-Ada.png`, `playtests/round-12/shots/06-Ada.png`

Wave 3 opened as four goblins, three skeletons, three wolves, one troll, and two bats. The button stayed up. It cleared at 23 kills, gold 57, keep 900. Lux ended at 22 health and Nia at 80. `playtests/round-12/shots/07-Ada.png`, `playtests/round-12/shots/08-Ada.png`

Wave 4 opened as five goblins, four skeletons, three wolves, and one boss. The button stayed up. The boss was the last body. From tick 4003 to 4306 the keep fell from 742 to 5 while that boss sat 152 from Ada and 94 from Lux, and Lux and Pip kept swinging. Lux had died at (-71, 97) and returned at 90 health on (-97, 52) while the keep still stood. The boss died at tick 4346. Heartwood raised the keep from 5 to 285 and the max from 900 to 1180. Kills 36, gold 100. `playtests/round-12/shots/09-Ada.png`, `playtests/round-12/shots/10-Ada.png`

Wave 5 opened as five goblins, four skeletons, three wolves, and one troll, keep 285. The button stayed up. Nia fell and returned at 120 health on (56, -95). The clear was 49 kills, gold 128, keep 124. The relics were heartwood, granary, whetstone, swiftness, and banner. `playtests/round-12/shots/11-Ada.png`, `playtests/round-12/shots/12-Ada.png`

Wave 6 opened as six goblins, five skeletons, four wolves, and one troll, keep 124. The button stayed up. Six more kills landed. At tick 6169 the phase was `over`, the clock said `Fallen`, the keep was 0, and 10 monsters were left: five goblins, four skeletons, and one troll. Lux was at 0 and down. Ada was 150, Bram 120, Pip 100, and Nia 120, all still up. The panel read `Wave 6. Survived 5. 55 kills. Score 5550.` `playtests/round-12/shots/13-Ada.png`, `playtests/round-12/shots/14-Ada.png`

Defence, by the button:

| stretch | button | kills | keep |
| --- | --- | --- | --- |
| Wave 1, tick 594 to 741 | up | 0 | 900 to 900 |
| Wave 1, tick 752 to 975 | held | 2 | 900 to 900 |
| Wave 2 | up | 8 | 900 to 900 |
| Wave 3 | up | 13 | 900 to 900 |
| Wave 4 | up | 13 | 900 to 5, then 285 after heartwood |
| Wave 5 | up | 13 | 285 to 124 |
| Wave 6 | up | 6 | 124 to 0 |

Of 55 kills, 2 were the held button and 53 were the drawn swing. The keep lost no health while the button was held. Every point it lost was during a button-up wave.

Top 3:

1. Wave 2 no longer fell the keep. The standing party cleared it at 900, and waves 3, 4, and 5 as well. `playtests/round-12/shots/06-Ada.png`
2. Two of the 55 kills were the held button. The other 53 were the drawn swing, and that swing is what the keep lost its health to. `playtests/round-12/shots/04-Ada.png`, `playtests/round-12/shots/14-Ada.png`
3. The party fell on wave 6 with the button up and 10 monsters left. The walk in #130 was not in this image. `playtests/round-12/shots/14-Ada.png`

## Graphics

The waiting yard is the green clearing, dirt paths, and a banded stone keep with a lit window. Night is the dark yard. Dusk was not held on a frame, and this round did not resample pixels. `playtests/round-12/shots/01-Ada.png`, `playtests/round-12/shots/05-Ada.png`

The map cloth and the fog edge were not walked, so LK-106 and LK-107 were not rechecked.

The fallen panel covers the yard and reads the wave, the kills, and the score. `playtests/round-12/shots/14-Ada.png`

Top 3:

1. The day yard still reads as grass, paths, and the stone keep. `playtests/round-12/shots/01-Ada.png`
2. The night yard is dark enough that the wave line and the calls carry the fight. `playtests/round-12/shots/05-Ada.png`
3. The cloth and the fog edge were not in this room. LK-106 and LK-107 stay open.

## Music and sound

Ada's waiting bus was the day loop, unmuted, volume 0.7, and still locked. The night unlocked it and added `night` and `horn`. The fights recorded `hit`, `kill`, and `sting`. The boss bites recorded `keep-hit`. The fall recorded `fall`, and the loop went silent. `playtests/round-12/shots/01-Ada.png`, `playtests/round-12/shots/02-Ada.png`, `playtests/round-12/shots/14-Ada.png`

Mute was not reloaded.

Top 3:

1. The night opens with a horn. `playtests/round-12/shots/02-Ada.png`
2. The boss bites on the keep are `keep-hit`. `playtests/round-12/shots/10-Ada.png`
3. The fall is `fall`, and the loop goes silent. `playtests/round-12/shots/14-Ada.png`

## Game logic

Waiting snapshot: phase `build`, wave 1, wood 48, gold 0, keep 900 of 900, monsters 0, light `day`. The screen says `Waiting to start` and `2 goblins`. Five seats are connected. No console errors. `playtests/round-12/shots/01-Ada.png`

Wave 1 clear: phase `build`, wave 2, kills 2, score 1020, gold 10, wood 48, keep 900. The next line is `4 goblins`, `3 skeletons`, `1 wolf`. `playtests/round-12/shots/04-Ada.png`

Wave 2 clear: kills 10, gold 27, keep 900. The gold step is the eight-gold purse plus the bounties, 4 plus 3 plus 2. `playtests/round-12/shots/06-Ada.png`

Wave 4 boss: keep 5 of 900, relics empty, one boss at 152 from Ada. The clear snapshot is keep 285 of 1180 and relics `heartwood`. That is 5 plus 280. `playtests/round-12/shots/10-Ada.png`

Wave 5 clear: relics `heartwood`, `granary`, `whetstone`, `swiftness`, `banner`. Killing the boss and the elites paid them. The party never stood on a shrine. `playtests/round-12/shots/12-Ada.png`

Fallen snapshot: phase `over`, clock `Fallen`, keep 0 of 1180, kills 55, gold 138, score 5550, wood 48. Lux is 0 and down. The others are alive at the health the fight HUD had. A downed hero is not refilled because the keep died on that tick. Lux's earlier return, and Nia's, happened while the keep still stood. `playtests/round-12/shots/14-Ada.png`

Wood stayed 48. The join spots were not a pine cell, and nobody walked onto one.

Top 3:

1. Wave 1 paid gold 10, the purse of 8 plus two bounties. LK-094 held. `playtests/round-12/shots/04-Ada.png`
2. Heartwood on the boss added 280 to the keep's health and to its max. `playtests/round-12/shots/10-Ada.png`
3. Lux stayed at 0 on the fallen snapshot. The earlier returns were while the keep lived. `playtests/round-12/shots/14-Ada.png`

## Character design

The roster reads Pip Scout, Bram Engineer, Nia Farmer, Ada Warrior, Lux Mage. Ada's card stands on the ring, clear of the keep door, with the shield readable at that zoom. The other four hold the join ring through wave 2. `playtests/round-12/shots/01-Ada.png`, `playtests/round-12/shots/05-Ada.png`

Wave 3's calls name bats and a troll. Wave 4's calls name the boss. The fallen yard still names a troll and goblins. `playtests/round-12/shots/08-Ada.png`, `playtests/round-12/shots/14-Ada.png`

Top 3:

1. The five roles read on the roster. `playtests/round-12/shots/01-Ada.png`
2. The warrior card stays off the keep door. `playtests/round-12/shots/01-Ada.png`
3. The later nights put bats, a troll, and the boss on the calls. The rider was not isolated in a close frame. `playtests/round-12/shots/08-Ada.png`

## Fidelity

Scored against the concept sheets from this yard. 1 is unlike the sheet. 5 would be the sheet at game zoom. This round did not resample pixels. The cloth was not opened, so the ui score stays 3.

| area | round 11 | round 12 | note |
| --- | --- | --- | --- |
| mood | 4 | 4 | Waiting yard is the green clearing. Night is the dark yard. Dusk was not held. |
| town | 4 | 4 | Banded keep and lit window. No building was placed. The fog edge was not walked. |
| heroes | 4 | 4 | Roster and the ring cards. Height was not remeasured. |
| monsters | 5 | 5 | Goblins, skeletons, wolves, bats, a troll, and the boss. The rider was not isolated. |
| ui | 3 | 3 | Fallen panel is Wave 6, 55 kills, score 5550. The cloth was not opened, so LK-106 stays. |

## Aggregate

1. The keep survived wave 2. Round 11 fell from 850 to 0 on that pack. This room cleared it at 900 with the button up, and cleared waves 3, 4, and 5 the same way. LK-097 is closed on that evidence. `playtests/round-12/shots/06-Ada.png`, `playtests/round-12/shots/14-Ada.png`
2. Of 55 kills, 2 were the held button on wave 1 and 53 were the drawn swing. The keep took every point of damage during the button-up waves, and none during the hold. The swing stays as merged until Dominic decides on #130.
3. The run ended on wave 6. Survived 5. Ten monsters were still up. Lux was down and was not refilled. `playtests/round-12/shots/14-Ada.png`

LK-106 and LK-107 were not rechecked. The party never stood on the map table or past the last chunk.

LK-094 held. Wave 1 paid 10 gold.
