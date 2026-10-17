# Playtest round 6

Target: https://agentyard.letz.tw after the voxel figures, the sack economy, the hero portraits, and the day-to-night light. Room `KR8DDW`. The same five specialists, one room. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer.

Shots: `playtests/round-6/shots/`.

This round is the comparison with round 5, room `ME475J`. The production smoke for this image was `6 passed` before the room opened.

## Gameplay

Ada pressed start. The clock left `Waiting to start` and read `Night in 7s` while the yard warmed. Wave 1 opened with the keep at 900 and `Frenzy in 50s`. The pair was off the screen. The grass said `goblin` twice, once along the top and once on the left, the same split as room `ME475J`. The top word sat on the Raise the keep button. `playtests/round-6/shots/04-Ada.png`

The party walked into them during the frenzy. Hits landed. The keep fell from 900 to 753 before both died on one click. The clear was score 1020, 2 kills, gold 2, wood 62, and `Night in 21s`. Round 5 cleared the same wave at score 1020 with the keep still 900, because that party met the pair before the frenzy. This party did not. `playtests/round-6/shots/07-Ada.png`

Raise the keep still reads `Raise the keep 24 wood 8 gold` in the same brown as Copy invite, at gold 0 and again at gold 2. LK-048. `playtests/round-6/shots/01-Ada.png`

Bram armed a wall. The yellow ring drew around his reach and the yard said `Too close to the keep` while the cursor sat on the tower. The click out on the grass did not spend wood. `playtests/round-6/shots/02-Bram.png`

Wave 2 was already biting when the shot landed: four goblins and three skeletons in the snapshot, keep 713, frenzy in 42s. It was not left to fall. `playtests/round-6/shots/08-Ada.png`

Top 3:

1. Wave 1 still clears, and this seed still splits the call into two `goblin` words. The frenzy bites are what dropped the keep. `playtests/round-6/shots/04-Ada.png`, `playtests/round-6/shots/07-Ada.png`
2. Raise the keep still looks live while gold is short. LK-048. `playtests/round-6/shots/07-Ada.png`
3. The next pack is a counted beacon: `4 goblins` and `3 skeletons` on the build after the clear. `playtests/round-6/shots/07-Ada.png`

## Graphics

The waiting yard is dark olive. The keep is a banded stone tower with a lit window, pines stand inside the ring, and the paths are dirt. The outer ring is still bare trunks. Three sacks sit at the foot of the tower: Gold 0, Wood 48, Food 8. `playtests/round-6/shots/01-Ada.png`

`Night in 7s` is dusk. The grass goes brown and the keep window and the brazier read warm. `playtests/round-6/shots/03-Ada.png`

The wave is night. The field is near black and the window stays lit. The two goblins, once the party reaches them, are short olive figures with orange eyes. They are not the red blocks from round 5, and they are not the concept goblins: no spear reads at this zoom. The skeletons in wave 2 are darker grey blocks beside them. A white `11` and a `4` float on the pile. `playtests/round-6/shots/06-Ada.png`, `playtests/round-6/shots/08-Ada.png`

The five heroes separate by prop when the camera is close: Ada's blue shield, Nia's wide brim, Pip's green hood, Bram's hammer, Lux's staff. At the edge of the plaza they shrink back to chunks. `playtests/round-6/shots/01-Nia.png`

The keep sign is pinned on the yard. Next to the tower it lists wave, clock, score, the next pack, and keep hp. Once Ada walks toward the fight, that sign slides off the right edge. On the way back it wraps into a narrow column: `Frenzy in` on one line and `42s` on the next. LK-075. `playtests/round-6/shots/06-Ada.png`, `playtests/round-6/shots/08-Ada.png`

The build ring is still the yellow octagon, and it is absent until a build is armed. `playtests/round-6/shots/02-Bram.png`

Top 3:

1. Dusk and night are different from the day, and the keep window stays lit. The day field is still olive. `playtests/round-6/shots/03-Ada.png`, `playtests/round-6/shots/04-Ada.png`
2. Goblins and skeletons are different colors. At game zoom both are still blocks. `playtests/round-6/shots/08-Ada.png`
3. The wave line leaves with the camera. `playtests/round-6/shots/06-Ada.png`

## Music and sound

Ada's bus while the party waited was the day loop, unmuted, volume 0.7. Pressing start unlocked it. The wave added `night` and `horn`, and the loop name became `night`. `playtests/round-6/shots/04-Ada.json`

Hits stacked while the goblins were in reach. Keep bites recorded `keep-hit`. The clear recorded `sting` and `kill` and the loop name went back to `day`. `playtests/round-6/shots/07-Ada.json`

No build cue played, because the wall click did not place. Mute was not reloaded this room, so that survival was not rechecked. The Sound control and its slider were on the bar the whole time.

Top 3:

1. The night opens with a horn, and the bus records it. `playtests/round-6/shots/04-Ada.json`
2. The clear plays the sting and the kill and returns to the day loop. `playtests/round-6/shots/07-Ada.json`
3. A bite on the keep is `keep-hit`, separate from a body hit. `playtests/round-6/shots/07-Ada.json`

## Game logic

Waiting snapshot: phase `build`, hold true, wave 1, wood 48, food 8, gold 0, keep 900, monsters 0. The screen says `Waiting to start`, `Next: 2 goblins`, and the sacks say the same three numbers. `playtests/round-6/shots/01-Ada.json`

Wave 1 snapshot: two monsters, both `goblin`, both offscreen, spread apart. The screen says `goblin` twice rather than `2 goblins`. The count agrees. The word does not. LK-060. `playtests/round-6/shots/04-Ada.json`

Clear snapshot: phase `build`, kills 2, score 1020, gold 2, wood 62, keep 753 of 900, monsters 0. The sign says Wave 2, score 1020, Next: 4 goblins, 3 skeletons, Keep 753/900. The sacks say Gold 2, Wood 62, Food 8. Screen and state match. `playtests/round-6/shots/07-Ada.json`

Wave 2 snapshot: four `goblin` and three `skeleton` rows. The picture has olive bodies and grey bodies, and one edge word `skeleton`. The kinds agree with the plan that night 1 stays goblins and night 2 adds skeletons. `playtests/round-6/shots/08-Ada.json`

Food is still a number. The sack does not say what a feast spends. LK-046.

Top 3:

1. Two offscreen goblins and two `goblin` words. The count matches and the plural does not. `playtests/round-6/shots/04-Ada.json`
2. The clear sign matches the snapshot, including keep 753 and gold 2. `playtests/round-6/shots/07-Ada.json`
3. Wave 2's rows are goblins and skeletons, and the picture shows both. `playtests/round-6/shots/08-Ada.json`

## Character design

The create screen is five cards. Each card is that hero's day close-up: a grey warrior with a blue shield, a blue mage, a green scout, a farmer under a wide brim, and a brown engineer. Warrior is selected with a gold outline. The Create game button sits under the cards. `playtests/round-6/shots/home-picker.png`

The roster reads Pip Scout, Ada Warrior, Nia Farmer, Lux Mage, Bram Engineer. The names sit on the figures. Nia's brim is the wide mark. Ada's shield is the blue mark. At plaza size they are still small next to the concept cards on the picker. `playtests/round-6/shots/01-Nia.png`

A goblin in the fight is an olive block with orange eyes. A skeleton beside it is a darker block. Neither reads as the concept body at this zoom. The wolf, the bat, the ogre, and the rider did not spawn. `playtests/round-6/shots/08-Ada.png`

Top 3:

1. The picker is portrait cards, not color swatches. `playtests/round-6/shots/home-picker.png`
2. Five different bodies, readable by prop up close, still small at game zoom. `playtests/round-6/shots/01-Nia.png`
3. A goblin is no longer a red block, and it is still not the concept goblin. `playtests/round-6/shots/06-Ada.png`

## Fidelity

Scored against the concept sheets from the yard, not from the gallery crop. 1 is unlike the sheet. 5 would be the sheet at game zoom. Round 5 stays the baseline. These rows only rise.

| area | score | note |
| --- | --- | --- |
| mood | 2 | Dusk warms the yard and the keep window stays lit at night. The day field is still dark olive, not the sheet's dusk pines. |
| town | 3 | The keep is a stone tower with courses, a lit window, pines, and dirt paths. The plaza is still a dark octagon and the outer ring is bare trunks. |
| heroes | 3 | The picker cards are the close-ups, and the yard separates the shield, the brim, the hood, and the hammer. At game zoom the bodies are still small chunks, not the concept sheet. |
| monsters | 3 | A goblin is olive with orange eyes and a skeleton is a separate grey body. At game zoom neither shows ribs or a spear, and the wolf, bat, ogre, and rider were not on the yard. |
| ui | 3 | Wood, food, and gold are sacks, and the next pack is a beacon. The wave line is a yard sign that clips once the camera leaves the keep, and the glass buttons remain. |

## Aggregate

Held from round 5, and visible here:

1. The night is not silent. Day, horn, night, hit, keep-hit, sting, and kill are on the bus. LK-024 held.
2. The build ring shows while a build is armed, and a cursor on the tower says why it will not place. `playtests/round-6/shots/02-Bram.png`
3. The five heroes do not share one silhouette. The picker now shows the close-up. `playtests/round-6/shots/home-picker.png`
4. Edge calls still do not cover roster names. They can cover the Raise the keep button instead. `playtests/round-6/shots/04-Ada.png`

New or still open:

1. Low, gameplay. A wave-1 pair can still read as two `goblin` words. LK-060. `playtests/round-6/shots/04-Ada.png`
2. Medium, gameplay. Raise the keep looks live at gold 0 and at gold 2. LK-048. `playtests/round-6/shots/07-Ada.png`
3. Medium, graphics. That same `goblin` word covers the raise label. LK-074. `playtests/round-6/shots/04-Ada.png`
4. Medium, graphics. The wave line is a yard sign, so it clips off the screen and wraps at the edge. LK-075. `playtests/round-6/shots/06-Ada.png`, `playtests/round-6/shots/08-Ada.png`
5. Low, logic. Food is a sack that still only says the number. LK-046.
6. The goblin and the skeleton are readable as two kinds and are still blocks at game zoom. The other four concept bodies were not in this room.
