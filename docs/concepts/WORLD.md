# The world outside the keep

The keep stays in the middle. Heroes still defend it together, and nights still come from every side. The land around that keep is no longer one circle.

`Rules.map_radius/0` is 7200. A hero stops on the first cell outside that disc, and `Rules.walk_backstop/0` is 9600. Wave 1 still drops two goblins about 620 to 659 from the origin. From wave 2, each monster steps 40 units toward the origin from a living portal. Seventy bare trunks sit in three rings and have no wood.

The chest and the portal already follow this page. The rest of it is the contract for the slices that have not landed. Edges in [`../GAME-INTERACTIONS.md`](../GAME-INTERACTIONS.md) that name that remaining land are `planned` in [`../interactions.json`](../interactions.json).

## How a bounded land reads as endless

The frame the player sees ends on the yard plane. `GROUND_SPAN` in `assets/js/ground.js` is 760, so the plane runs from -380 to 380. Past that quad the clear color shows. That is the hard rectangle. The seeded land already continues to radius 7200. The picture does not.

Three games keep a finite play space and still fill the frame. The notes below are what this slice copies. Each one names the page it came from.

Kingdom Two Crowns walks a strip and stops. The Kingdom wiki page Plain says every land ends in two cliffs, or in one cliff and a beach. The Cliff portal page puts a portal on that cliff face. It opens at night and sends the Greed. Destroying it stops that side until the portal rebuilds. The picture past the cliff is still a picture. A Steam thread on the Two Crowns water describes distant mountains that barely scroll, nearer cliffs and trees that scroll a little, and water that scrolls fastest. A player on the New Lands forum, recalling a developer stream, says those layers sit at real depth in a 3D scene. The walk ends on rock or water. The sky and the far layers do not end with it.

Octopath Traveler keeps each place on a small board. Digital Foundry's 2018 article says the bokeh depth of field uses the 3D depth under the pixels, holds a shallow range in focus, and reads as a tilt-shift miniature. The far edge of the board goes soft. Last Keep already has that camera and that fog. Soft blur on an empty clear color is still an edge. The ground has to continue under the blur.

Don't Starve Together generates one finite tile map from a seed. The wiki page Map says a new world is black on the map except the ground around the character, and walking fills the map in. The tiles were generated before anyone walked there. The tile-definition notes split land, ocean, and impassable. Ocean is a tile. The character does not walk it. The guide All About Night treats the dark as the unlit part of that same ground. A light falls off. It does not delete tiles. Shipwrecked's Ocean Fog page puts mist at the charted edge. Entering it wraps the character. The edge reads as fog over a place.

This slice copies those three stops.

Undiscovered chunks are drawn from the same seed as land under mist. Points of interest stay out of the snapshot until the chunk is discovered. Past radius 7200 the picture keeps pine, cliff, hill, and mountain. That mesh fades to the clear color before the far plane, so no camera shows a clear-color ground edge. The walk stops on the first cell outside the disc. That edge follows the 36-unit grid, so it is jagged. `Rules.walk_backstop/0` is 9600 and only catches a hero a gap would send past the skirt. From wave 2 on, each monster appears 40 units toward the origin from a living portal, within 80 of that door. Breaking that portal drops its share. Night 1 stays two goblins on the yard ring. No march multiplier. `five heroes reach the wave 2 pack before the keep falls` still clears on seed 1.

Sources, read before this slice was built:

- [Plain](https://kingdomthegame.fandom.com/wiki/Plain), Kingdom wiki.
- [Cliff portal](https://kingdomthegame.fandom.com/wiki/Cliff_portal), Kingdom wiki.
- [Two Crowns parallax thread](https://steamcommunity.com/app/701160/discussions/0/3001047413716382185/).
- [New Lands parallax thread](https://steamcommunity.com/app/496300/discussions/1/5064850575742403848/). The 3D-layer sentence there is a player's memory of a stream.
- [Octopath Traveler, Digital Foundry, 2018](https://www.digitalfoundry.net/articles/digitalfoundry-2018-octopath-traveler-a-hybrid-game-for-a-hybrid-console).
- [Map](https://dontstarve.wiki.gg/wiki/Map/DST), Don't Starve wiki.
- [Tile definitions](https://vietnd69.github.io/dst-api-webdocs/docs/game-scripts/tiledefs), Don't Starve Together API notes.
- [All About Night](https://dontstarve.wiki.gg/wiki/Guides/All_About_Night), Don't Starve wiki.
- [Ocean Fog](https://dontstarve.fandom.com/wiki/Ocean_Fog), Don't Starve wiki.

## The land

`World.generate/1` takes the room seed and returns one world. The same seed returns the same biomes, the same blocked cells, and the same points of interest. Visit order does not matter. `World.chunk/3` is the same bytes as the matching slice of `World.generate/1`.

The bound is a radius of 7200. `World.open?/2` is true only for a cell inside that disc. The stop follows the cell grid, so the edge is jagged. The shape inside the disc is not a mirror. Biomes there are pine forest, meadow, ruins, river, ford, and cliff. A hero walks a river cell and a cliff cell inside the disc. The flood fill that places points of interest still treats those cells as blocked. A ford is the walkable cell in a river. The skirt past the disc is pine, cliff, hill, or mountain, and every skirt cell is closed. Hill and mountain are picture biomes. `World.biome/3` still returns void outside the disc. Clearings and paths are meadow cells that the generator connects.

The keep disc of radius 400 is always meadow. It holds no pine, river, cliff, or point of interest. Rank 4 dirt ends near 310, so the town, the houses, and the spawn ring at radius 120 stay inside that disc. Night 1 spawn distance stays on the old ring. The bearing is a living portal.

A symmetry check samples land cells on a 144-unit lattice outside the keep disc and inside 7200. For each cell it compares the biome to the x-mirror, the y-mirror, and the half turn. A pair counts only when both cells lie inside the bound. Each of those three disagreement fractions has to be at least 0.35. A disc of one biome fails. A forest mirrored across x = 0 fails the x-mirror.

Every point of interest has to be reachable on foot from the keep. The walk grid is the same 36-unit step the build tool already snaps to. The fill starts at the origin and steps through meadow, pine, ruins, and ford. It does not step through river or cliff. If a point of interest sits outside the fill, `World.generate/1` adjusts that seed's noise the same way every time, up to eight tries, and then the test fails. The retry is part of the pure function, so the seed still names one world.

## Points of interest

Counts come from the seed, not from the player count. A two-player room and a fifteen-player room with the same seed get the same land.

| Kind | Count | What a hero can do |
| --- | --- | --- |
| Portal | 6 | Stand on it and strike it until it breaks. Its later waves stop. |
| Chest | 8 | Open it once. The room gains the gold inside. |
| Camp | 4 | Wake one vagrant. That ally fights and does not take a seat. |
| Quarry | 3 | Gather stone. An engineer gathers more per tick. |
| Shrine | 2 | Grant one relic the party does not hold. |
| Merchant | 1 | Pay gold for food or stone. |
| Hermit | 1 | The next chunk ring around the hermit becomes revealed. |

Portals sit between radius 1400 and 5200. Other points sit on walkable land outside the keep disc.

A camp's vagrant is one of the five roles, chosen by the seed from roles that are not already seated. Waking the vagrant spends 8 gold. The vagrant is an ally that follows the nearest living hero and uses that role's strike. The ally is not a player, does not connect, and does not count toward the seat cap. Four camps are the cap even when fifteen players are seated.

A destroyed portal stays destroyed for the room. Opening a chest, waking a vagrant, and taking a shrine are also once each.

## Resources and why a role walks out

Wood in the yard is the near stand. The pine forest is the stand that refills a wall line after that yard is cut. Any living hero still chops a pine that has wood. The seventy bare trunks stay bare. They are not this forest.

Stone is a new stock, cap 200. A quarry node holds 40 stone. An engineer takes 2 per work tick. Any other living hero takes 1. A stone wall costs 8 stone and 4 wood and has 280 health. A wood wall stays 8 wood, or 4 for an engineer, at 170 health. The ogre bite is why the stone exists. A wood wall is what the yard can afford. The quarry is the engineer's walk.

A field can be sown only on meadow. Pine, ruins, river, ford, and cliff refuse the sow. Wheat does not take there. The keep disc is meadow, so the crofts the farmer already stakes in the yard still place. A meadow outside that disc is the farmer's walk.

Gold from a field stays the small daytime mint. A chest is the hoard that pays a keep raise. Each chest holds 24 gold, once. Anyone standing on it can open it. The scout's extra reveal is how the party finds the next one before the day ends.

## Danger, night, and discovery

Day inside radius 800 has no ambient monsters. From 800 to 2400 the seed places wolves and skeletons, twelve of them in the whole world, not one per chunk. Past 2400 those twelve can include trolls. They are part of the world, not of the wave plan. Killing one removes it until the next day rebuilds the ambient list from the seed.

Night still enrages living monsters when the wave timer reaches zero. Ambient monsters take that same enrage. The wave timer still advances every tick while the keep stands and the room is not waiting to start.

Wave 1 stays two goblins, slower and softer, at `Rules.spawn_distance/2` for wave 1. Their bearings are the two nearest living portals. If fewer than two portals live, the missing bearings come from the old single angle in `Waves.plan/2`. The count stays 2. The yard test that wants them between 600 and 680 still passes.

From wave 2 on, each monster is placed 40 units toward the origin from a living portal, round-robin over the nearest portals. The first position is within 80 of that door. The total count stays the count `Waves.plan/2` would have built for that wave. A portal at 0 hp is already gone from `state.world.portals`, so the next wave places nothing within 80 of it. If no portal lives, the spawn list is empty, the timer still runs, and an empty field clears the night. The picture does not invent a replacement portal.

Fog is one map for the room. A chunk starts hidden, except the chunks that touch the keep disc. A hero reveals the chunk under their feet and the eight neighbors. A living scout also reveals the ring at Chebyshev distance 2. Hidden points of interest are not in that player's snapshot.

Claimed land is the keep disc, plus any chunk whose portal is dead. A building outside a hero's reach still fails. A building in an unclaimed chunk fails even inside that reach, with the reason "The land is not held." Fields still need meadow. Clearing a portal is how a wall line steps outward. Raising the keep still widens the town at the center. It does not claim the map.

## Seats from 2 to 15

The land does not grow with the party. Portal count, chest count, and chunk count stay on the seed.

Monster health from the wave scales as it does today. For each connected hero past 2, that health also gains 6 percent, and the bonus stops at 15 heroes. Two players see no bonus. Night 1 with two players is still the stock goblin a fireball deletes.

Vagrants do not take the seats those players use. The seat cap stays 15, which is `Rules.max_players/0`.

The server keeps one discovered set. Each snapshot carries the chunks within Chebyshev distance 2 of that hero, not the whole 7200-radius grid. A farmer in the yard and a scout in the pines do not force one payload.

## What the server stores

`State` keeps a `world` map. The seed is the room seed. `chunks` is a map from `{cx, cy}` to the generated chunk. Chunk size is 512, so the bound uses coordinates from -14 to 14.

`discovered` is a set of chunk ids. `portals`, `chests`, `camps`, `quarries`, `shrines`, `merchant`, and `hermit` record what is still there. A tick reads a chunk through `World.chunk/3` only when that id is missing from `chunks`. Later ticks reuse the stored chunk.

Elixir owns this. The channel parses input and calls `Sim`. It does not decide biomes, drops, or portal bearings.

## What the client draws

The camera follows the hero. A test may set `window.__lastKeepLook` to `{x, z}`, and the seat uses that point until the hook is cleared. The start screen has no snapshot. It paints seed 1 and attempt 0.

`Snapshot.render/1` carries `seed` and `attempt`. The client paints the horizon from `pictureCell`, and those biome names match `World.picture/3`. The texture is a 6144-unit window around the camera, 256 texels, repainted when the camera chunk changes. A flat plane stays 48000 so the far clip still lands on land. A second mesh, 3200 on a side and 20 segments, follows the ground under the camera and lifts cliff, hill, and mountain from the same cells. The segment count stays inside the 9800-triangle wave ceiling. Both meshes exist from the first frame. The yard keeps the scene fog. Its outer edge stipples into that window. The horizon fades on its own, from 1.15 spans to 2.2 spans. The yard plane stays `GROUND_SPAN` 760. Cells whose chunk is missing from the snapshot darken toward the fog color on that same texture. A hidden chest, portal, or camp is not drawn. Far pines are one instanced mesh, at most 180, rebuilt when the camera chunk changes. A living portal is one instanced gate, two posts and a glowing opening. Breaking the portal removes that instance. There is no point light on the door.

Way-finding stays in the world. There is no corner map and no new glass button. The glass count stays 10. A map table stands at x 0 and y 160, inside the keep disc. A hero within 80 of it sees revealed chunks as a cloth on that table. Off screen, the nearest living portal and the nearest unopened chest in revealed land use the same edge beacon as the next-wave hint. That beacon stays up during a wave.

Terrain and these points of interest will be drawn by the pixel-art lane in that lane's style. This lane owns the ids and the positions. That lane owns the meshes. Until a mesh exists, a chest uses the gold-sack colors, a quarry uses stone blocks, a camp uses a cottage, and a shrine uses the keep banner. A portal is the gate. Replacing a mesh does not rename the id.

## What stays the same

Night 1 is two goblins. The keep is the loss. Food still heals the keep from beside it. A raise requires the hero at the keep. Until then the button stays disabled, and the hint says "Walk to the keep". Inside that range it still spends wood and gold and stakes houses on the town rings. Feed still needs the hero beside the keep. The five heroes, the six monsters, and the six build buttons stay. Hold still waits until the host starts.

## How a slice proves itself

The concept page is this document. Generation, exploration, and the resource slice have landed. Heroes stop on the skirt, `Rules.walk_backstop/0` is 9600, a chest pays 24 gold once, and a broken portal leaves that bearing out of the night. A quarry pays stone, pine refuses a sow, and a stone wall costs 8 stone and 4 wood. A pine cell pays 12 wood, and a yard tree in reach takes the chop. A camp wakes one vagrant for 8 gold. A shrine grants one relic the party does not hold. The hermit and the merchant stay planned. The performance slice has landed. The coverage floor is 77.

The generation slice adds `World.generate/1`. One test builds two worlds from seed 3 and requires equal biomes, blockers, and points of interest. One test requires the keep disc clear. One test flood-fills from the origin and requires every point of interest on the fill. One test requires each symmetry disagreement fraction to be at least 0.35.

The exploration slice wires `world` into `State` and raises the walk clamp to 7200. A server test opens a chest at a known coordinate and requires gold to rise by 24 once, and a second open to add nothing. A server test breaks one portal and requires the next wave plan to omit that portal's bearing, with night 1 still two goblins when two portals remain. A browser scenario walks a hero to a chest and reads the new gold, breaks a portal, and reads a wave that does not spawn on that bearing.

The resource slice added stone, `Rules.cap(:stone)` of 200, and the meadow check on sow. A farmer sow on pine fails and spends nothing. An engineer at a quarry gains stone faster than a warrior at the same node. A stone wall pays 8 stone and 4 wood and has 280 health. Pine wood stays planned. The interaction test's resource list includes `stone`.

The performance slice keeps generation off the hot tick. `twenty ticks with fifteen heroes leave the generator count put` builds every chunk, records the generator count, ticks 20 times with 15 connected heroes, and requires that count to stay put. A time ceiling belongs to the perf harness when that harness has a trunk baseline. This slice does not invent a looser timeout to go green. If the harness is absent, the generator count is the gate.

The fog slice is the shared discovered set, the scout's extra ring, and the map table. A farmer reveals Chebyshev distance 1. A living scout reveals distance 2. The farmer's terrain payload does not include the scout's distant chunks, and the cloth at the table does. A chest outside the discovered set is absent from the snapshot. A hero within 80 of (0, 160) receives the cloth. A hero at the spawn does not. `a scout's ring is on the shared map and stays out of the farmer's terrain` and `readTheMap` are the proof. Pine wood stays planned. The coverage floor stays 77.

The claimed-land slice holds the keep disc of radius 400 and the chunk of a portal that has died. `the keep disc is held and a far chunk is not` places inside the disc, refuses a point past the hero's reach with "Too far", and refuses a point in a living portal's chunk with "The land is not held." Raising the town rank does not add a claimed chunk. `a dead portal claims its chunk and a field there still needs meadow` breaks that portal and then places the wall, and a sow on pine in the same chunk still spends nothing. `a barricade on unheld land spends nothing` refuses the engineer's three walls before the wood and the cooldown, then spends that wood once the same chunk is claimed. `holdTheLand` walks past the disc, reads the refusal, breaks the seed-5 west portal, and places the wall. The coverage floor stays 77.

The pine slice is the forest cell. `a pine pays wood and a yard tree wins when it is in reach` stands on the seed-5 pine at (432, 0), reads one wood after the warrior's chop, and reads nothing once that cell is at 0. A meadow under the spawn pays nothing. A yard tree within 48 pays from the tree and leaves the cut map empty. `chopThePine` walks to that same cell and reads the wood sack. The walk stays 20 seconds. The seventy bare trunks stay bare. The camp, the shrine, the hermit, and the merchant stay planned. The coverage floor stays 77.

The camp slice wakes one vagrant for 8 gold. `a camp spends 8 gold once and the ally is not a seat` spends that gold once and leaves the ally off the seat list. `wakeTheCamp` opens the seed-5 yard chest at (216, 720), walks to the camp at (-3852, -3384), and reads gold 16 and one vagrant. The ally is not a seat. The chest wait stays 45 seconds. The camp walk stays 120 seconds. The shrine, the hermit, and the merchant stay planned. The coverage floor stays 77.

The shrine slice grants one relic the party does not hold. `a shrine grants one relic once` stands on a shrine, reads one relic, and leaves one shrine. A second tick leaves both lengths unchanged. `a shrine with every relic already held is still once` removes the shrine and leaves the five relics. `takeTheShrine` walks to the seed-5 shrine at (4140, 0) and reads one relic. The walk stays 120 seconds. The hermit and the merchant stay planned. The coverage floor stays 77.

The horizon slice paints past the disc and brings later nights out of the doors. `the same seed paints the same picture` and `the picture fixture is the client contract` lock `World.picture/3`. `pictureCell matches the committed fixture` reads that file, including a skirt point and the seed-1 cells at (0, 0), (432, 0), (800, 0), and (2000, 0). `a hero stops on the skirt and still crosses a river` reaches the closed cell and still crosses a river. `wave 2 does not spawn in the yard` requires each monster within 80 of a living portal. `a broken portal sends no monster on the next wave` breaks the nearest door. Night 1 stays two goblins. `the fog edge is not a flat fill` reads the start screen, the keep, and a bound camera. The coverage floor stays 77.

## Locked numbers

| Name | Value |
| --- | --- |
| World radius | 7200 |
| Walk backstop | 9600, `Rules.walk_backstop/0` |
| Door step | 40 toward the origin, within 80 |
| Chunk size | 512 |
| Keep-clear radius | 400 |
| Walk cell | 36 |
| Symmetry floor | 0.35 on x-mirror, y-mirror, and half-turn |
| Portals, chests, camps, quarries, shrines | 6, 8, 4, 3, 2 |
| Merchant, hermit | 1 each |
| Chest gold | 24, once |
| Quarry stone | 40 stored, 2 per tick for an engineer, 1 otherwise |
| Stone cap | 200 |
| Stone wall | 8 stone, 4 wood, 280 health |
| Vagrant cost | 8 gold |
| Health bonus | 6 percent per connected hero past 2, through 15 |
| Reveal | chunk plus neighbors, plus one ring while a scout lives |
| Map table | x 0, y 160, read within 80 |
