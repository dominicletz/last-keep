# Bram, Engineer

I am the builder in this room. I am not the host. The roster showed Bram, Lux, Ada, and Pip. I spent the round on wood, the hotbar, and the dirt.

## Fun

The hotbar is the part that works. Wall, trap, field, tower, forge, and spire are listed with prices, and the first wall did land while we were still waiting. Wood went from 48 to 44, which is the 4 wood on the wall button (`playtests/round-1/shots/01-Bram.png`, `playtests/round-1/shots/02-Bram.png`).

That was the only piece I got down. The corner then said "Too far." A yellow diamond and a brown block were on the yard, the night clock started, and a red enemy was already standing on the dirt. Trap is 6 wood and I still had 40, and I never got a trap down in time. The run ended on the fallen screen: wave 1, survived 0, 0 kills, score 0 (`playtests/round-1/shots/05-Bram.png`). I came to build a line. I left with one wall and a dead keep.

## Clarity

Waiting, wood, and prices were readable. "Waiting for the host" sat next to "Waiting to start," with "Next goblin 2" under the wave. I could not tell what the 2 counts. The top box says a forge adds 15% damage while it stands, a spire makes mages deal more and recover faster, and a boss drops one relic. I never saw a forge, a spire, or a relic. Gold stayed 0 through the wait, so the tower, forge, and spire prices were on screen and out of reach.

"Too far" is a small line in that same corner, under the wave box, while the big banner still says we are waiting (`playtests/round-1/shots/02-Bram.png`). The wall button stayed highlighted, so I knew the tool was still wall. Nothing on the dirt showed how far I am allowed to build. A pale dot sat on the grass to the west, off the yard.

The wall I paid for does not read as a wall. It is a short black bar against the keep. In the same shot a brown block was sitting on the east dirt. I had bought one wall and I was looking at two new shapes. By the night countdown a yellow diamond was on the west dirt and wood was 40, another 4 gone (`playtests/round-1/shots/03-Bram.png`). Field is priced at 4 wood and the diamond is yellow, so that is as far as I can match them. Nothing labeled the diamond or the block. Pale dots and an orange circle also hung over the grass in that shot, with no label.

The red enemy in `playtests/round-1/shots/04-Bram.png` is one stacked shape: a pale head on a red body, with a white 2 on the body. I could not tell which way it faced, or what the 2 meant. During that shot food had moved from 8 to 12 and gold from 0 to 2, and nothing said why. My own bar read 81/125. On the fallen screen it read 125/125 again (`playtests/round-1/shots/05-Bram.png`). The keep bar did change with the ending: 900/900 in the frenzy shot, 0/900 on the fall. "Copy invit" is cut off on every shot.

## Difficulty

From this seat wave 1 ends before a builder finishes a trap. I placed one wall during the wait. The next click was too far. Night was in 7 seconds with the yellow diamond and the brown block already on the yard (`playtests/round-1/shots/03-Bram.png`). Then the corner said frenzy in 48 seconds, the red shape was already on the dirt, I was at 81 health, and the keep was still full (`playtests/round-1/shots/04-Bram.png`). No trap appeared on that dirt. The next screen was the fall: wave 1, survived 0, 0 kills, score 0, wood still 40.

## Bugs

- After the wall, the corner said "Too far" and a pale dot sat on the grass. No range was drawn on the yard. Wood moved from 48 to 44, the price of the one wall that landed. `playtests/round-1/shots/02-Bram.png`
- The placed wall reads as a short black bar. A brown block was on the yard in the same beat, so I could not tell which shape was the wall. `playtests/round-1/shots/02-Bram.png`, `playtests/round-1/shots/03-Bram.png`, `playtests/round-1/shots/04-Bram.png`
- The only enemy was one stacked red shape with a white 2 on the body. `playtests/round-1/shots/04-Bram.png`
- My health read 81/125 during frenzy and 125/125 on the fallen screen. `playtests/round-1/shots/04-Bram.png`, `playtests/round-1/shots/05-Bram.png`
- The keep fell on wave 1 with 0 kills. The frenzy shot still showed the keep at 900/900 with that red shape already on the yard. An earlier pass expected wave 1 to leave the keep high. It did not in this room. `playtests/round-1/shots/04-Bram.png`, `playtests/round-1/shots/05-Bram.png`
- The invite button is clipped to "Copy invit" on every shot, including `playtests/round-1/shots/01-Bram.png`.

Wall placement itself did work, the refused click did not take a second 4 wood, "Too far" was gone by the next shot, the score was on the HUD during the run, and the forge, spire, and relic lines were on the HUD.

## Top 3 changes

1. Draw the build range on the dirt, and put "Too far" on the spot I clicked. The corner line ate the rest of the prep, and the trap never got down.
2. Draw a wall as a wall. The piece I paid 4 wood for is a black dash, and the brown block on the same yard made it unclear what I had bought. I need to see the line before I place the next piece.
3. Give the builder a readable beat on wave 1 before a body is standing on the yard. The keep went from full to fallen with 0 kills while I still had 40 wood and no trap. The enemy has to read as more than one stacked shape, and I have to be able to walk onto the dirt and place the trap.
