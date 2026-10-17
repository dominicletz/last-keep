# Playtest round 3

Target: https://agentyard.letz.tw after pull request 9. Room `64MLX4`. Five specialists, one room. Ada hosted as the warrior. Lux played the mage, Bram the engineer, Pip the scout, and Nia the farmer. Each report is the speciality, not the hero.

Shots: `playtests/round-3/shots/`.

## Gameplay

Ada pressed start. The corner said `Next: 2 goblins`, wood was 48, and the new control said `Raise the keep 24 wood 8 gold`. The first night opened with an empty yard and the clock at frenzy in 47 seconds. The only sign of the pack was the word `goblin` in the grass. The party stood still. By frenzy in 4 seconds the two goblins were one red body on the keep and the keep had ticked from 900 to 896. The click that should have been a swing landed on the stack. One kill later the keep was 702, gold was 1, and the floater said Slain over a 3. The night cleared at 2 kills, score 1020, gold 2, keep 624.

Ada then walked into the keep and stopped at x 73.5. The keep's radius is 54 and her radius is 14, so she stopped on the wall. A wall click on that same spot said `Too close to the keep` and wood stayed 48.

Wave 2 opened with the keep still at 624 and the clock at frenzy in 48 seconds. The pack was not already chewing the door. Gold 2 cannot pay the raise, and the button still looked live.

Top 3:

1. The offscreen call is one tiny word, so the first minute looks empty and the keep is chewed before anyone swings. `playtests/round-3/shots/03-Ada.png`
2. Raise the keep looks available when the party cannot pay. Gold was 2 and the cost was 8.
3. Two bodies on the keep still fight as one target, so clicks miss. `playtests/round-3/shots/04-Ada.png`

## Graphics

Lux could tell the outer ring from the harvest trees. The ring is bare grey trunks. The one green cone on the yard is a tree that can be chopped. Names sit on the figures. The yard at the start is readable.

The raise control shoved `Copy invite` into the roster column as soon as the night started. On wave 2 the monsters past the camera drew as giant red slabs across the wood chip, the raise control, and the roster. Two goblins at the door were one red block with a floating 2, then one block under the word Slain.

Top 3:

1. Monsters behind the camera fill the top of the picture. `playtests/round-3/shots/08-Ada.png`
2. Copy invite, Raise the keep, and the roster occupy the same corner. `playtests/round-3/shots/03-Ada.png`
3. A pair of goblins reads as one body. `playtests/round-3/shots/04-Ada.png`

## Music and sound

Bram heard nothing. Start, the walk, the bites, the slay, and the wave change were silent. There is still no day bed, no hit, no build, and no horn. LK-024 stays open.

Top 3:

1. The build is silent.
2. A wave that starts fifty seconds out has no horn to say the pack is coming.
3. A bite on the keep has no hit to say the number on the keep is moving.

## Game logic

Pip checked the saved shots against `docs/GAME-INTERACTIONS.md`.

| shot | screen | snapshot |
| --- | --- | --- |
| 03-Ada | empty yard, the word goblin, keep 900, frenzy in 47s | phase wave, wave 1, monsters 2, keep 900, Ada at (120, 0), range 180 |
| 04-Ada | one red body, floating 2, keep 896 | monsters 2, keep 896, wood 48, buildings 0 |
| 05-Ada | Slain, floating 3, keep 702, gold 1 | kills 1, score 10, monsters 1, keep 702, gold 1 |
| 07-Ada | Ada against the keep, Too close to the keep, Next: 4 goblins, 3 skeletons, keep 624, gold 2 | Ada at (73.5, 0), range 180, buildings 0, wood 48, keep 624, monsters 0, phase build |
| 08-Ada | red slabs on the top bar, frenzy in 48s, keep 624 | phase wave, wave 2, monsters 7, keep 624, kills 2, score 1020 |

The count of 7 on wave 2 matches the build line `4 goblins, 3 skeletons`. The keep did not drop between the build and the first second of wave 2, so this pack did not spawn in the yard. That closes the round 2 failure of LK-029 for this room. The screen still showed one body while the snapshot said two monsters, and it showed the word goblin while the snapshot said two. Those are presentation bugs, not a second spawn ring.

Ada's stop at 73.5 matches a solid keep. The deny text matches a wall placement inside the keep pad, and wood did not move, so the click did not spend. Gold 2 against a cost of 8 means the raise edge was refused by the price. No card was offered. The planned edges that are still open are elites dropping relics (LK-021), the spire unlocking spells (LK-022), and a city that grows on its own (LK-023). The keep upgrade is the growth that exists, and this room never paid for it. Food is still a number with no sentence.

Top 3:

1. Snapshot monsters 2, screen label `goblin`. `playtests/round-3/shots/03-Ada.json`
2. Snapshot monsters 2, screen one red body. `playtests/round-3/shots/04-Ada.json`
3. Food has no rule the player can read.

## Character design

Nia read five names in the roster: Nia Farmer, Ada Warrior, Lux Mage, Pip Scout, Bram Engineer. Her own row and her figure carried the name Nia, and the You line said `You Nia 120 / 120`. The five bodies are one block person. A color and a weapon are what separate the farmer from the mage. Goblins are a red block. Two of them become one block. Skeletons did not get a readable body on this night because the pack was off the yard and then drawn as slabs.

Top 3:

1. The roster is the only place a hero's role is clear. `playtests/round-3/shots/01-Nia.png`
2. A goblin pair has no second silhouette. `playtests/round-3/shots/04-Ada.png`
3. The slabs on wave 2 hide the roster, so the party list disappears when the night starts. `playtests/round-3/shots/08-Ada.png`

## Aggregate

1. High, graphics, everyone on wave 2. Monsters past the camera draw as slabs over the top bar. LK-040. `playtests/round-3/shots/08-Ada.png`
2. High, graphics, everyone after the night starts. Raise the keep collides with Copy invite and the roster. LK-041. `playtests/round-3/shots/03-Ada.png`
3. High, gameplay and logic. The offscreen pack is a single unlabeled word, so the keep loses 276 health before the first kill. LK-042. `playtests/round-3/shots/03-Ada.png`
4. Medium, graphics and character. Two separated goblins still read as one body. LK-044. `playtests/round-3/shots/04-Ada.png`
5. Medium, gameplay. The raise control looks ready when gold is short. LK-043.
6. High, music. The build is silent. LK-024, still open.
7. Medium, character. Heroes share one silhouette. LK-045.
8. Low, logic. Food is only a number. LK-046.

Re-checked and still holding: the five names, `Next: 2 goblins`, the invite text inside the window, bare trunks against one green tree, a solid keep, and a wave 2 that starts with the keep at the same health it had during the build. The build range is still not drawn (LK-032). No wall was placed, so the black-bar wall (LK-033) was not seen again. Ada's health stayed 150, so the flicker in LK-036 did not show.
