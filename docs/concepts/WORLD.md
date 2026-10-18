# The world outside the keep

The keep stays in the middle. Heroes still defend it together, and nights still come from every side. The land around that keep is no longer one circle.

Today `Rules.map_radius/0` is 1800. Heroes clamp to that disc. Wave 1 still drops two goblins about 620 to 659 from the origin, and later nights use a farther ring. Seventy bare trunks sit in three rings and have no wood. The layout is the same on every side. A party that walks for a minute has seen the whole map.

This page is the contract for the land that replaces that disc. The simulation does not follow it yet. Edges in [`../GAME-INTERACTIONS.md`](../GAME-INTERACTIONS.md) that name this land are `planned` in [`../interactions.json`](../interactions.json).

## The land

`World.generate/1` takes the room seed and returns one world. The same seed returns the same biomes, the same blocked cells, and the same points of interest. Visit order does not matter. `World.chunk/3` is the same bytes as the matching slice of `World.generate/1`.

The bound is a radius of 7200, four times the current clamp. The shape inside that bound is not a circle and not a mirror. Biomes are pine forest, meadow, ruins, river, ford, and cliff. Rivers and cliffs block walking. A ford is the walkable cell in a river. Clearings and paths are meadow cells that the generator connects, not rings drawn with a compass.

The keep disc of radius 400 is always meadow. It holds no pine, river, cliff, or point of interest. Rank 4 dirt ends near 310, so the town, the houses, and the spawn ring at radius 120 stay inside that disc. Night 1 spawn distance stays on the old ring. Only the bearing changes, and only once portals exist.

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

From wave 2 on, the plan's monsters are split across living portals. The total count stays the count `Waves.plan/2` would have built for that wave. Destroying a portal removes that portal's share from the next plan. Bearings that belonged to it do not return. If no portal lives, the plan is empty, the timer still runs, and an empty field clears the night. The horizon does not invent a replacement portal.

Fog is one map for the room. A chunk starts hidden, except the chunks that touch the keep disc. A hero reveals the chunk under their feet and the eight neighbors. A living scout also reveals the ring at Chebyshev distance 2. Hidden points of interest are not in that player's snapshot.

Claimed land is the keep disc, plus any chunk whose portal is dead. A building outside a hero's reach still fails. A building in an unclaimed chunk fails even inside that reach, with the reason "The land is not held." Fields still need meadow. Clearing a portal is how a wall line steps outward. Raising the keep still widens the town at the center. It does not claim the map.

## Seats from 2 to 15

The land does not grow with the party. Portal count, chest count, and chunk count stay on the seed.

Monster health from the wave scales as it does today. For each connected hero past 2, that health also gains 6 percent, and the bonus stops at 15 heroes. Two players see no bonus. Night 1 with two players is still the stock goblin a fireball deletes.

Vagrants do not take the seats those players use. The seat cap stays 15, which is `Rules.max_players/0`.

The server keeps one discovered set. Each snapshot carries the chunks within Chebyshev distance 2 of that hero, not the whole 7200-radius grid. A farmer in the yard and a scout in the pines do not force one payload.

## What the server stores

`State` gains a `world` map. The seed is the room seed. `chunks` is a map from `{cx, cy}` to the generated chunk. Chunk size is 512, so the bound uses coordinates from -14 to 14.

`discovered` is a set of chunk ids. `portals`, `chests`, `camps`, `quarries`, `shrines`, `merchant`, and `hermit` record what is still there. A tick reads a chunk through `World.chunk/3` only when that id is missing from `chunks`. Later ticks reuse the stored chunk.

Elixir owns this. The channel parses input and calls `Sim`. It does not decide biomes, drops, or portal bearings.

## What the client draws

The camera still follows the hero. `clamp_map` uses 7200 only once heroes can walk the generated land. Before that slice, the clamp stays 1800.

The client draws chunks that arrived in the snapshot and culls with the same frustum check monsters already use. It does not build a mesh for a hidden chunk.

Way-finding stays in the world. There is no corner map and no new glass button. The glass count stays 10. A map table stands at x 0 and y 160, inside the keep disc. A hero within 80 of it sees revealed chunks as a cloth on that table. Off screen, the nearest living portal and the nearest unopened chest in revealed land use the same edge beacon as the next-wave hint.

Terrain and these points of interest will be drawn by the pixel-art lane in that lane's style. This lane owns the ids and the positions. That lane owns the meshes. Until a mesh exists, a chest uses the gold-sack colors, a portal uses the brazier, a quarry uses stone blocks, a camp uses a cottage, and a shrine uses the keep banner. Replacing a mesh does not rename the id.

## What stays the same

Night 1 is two goblins. The keep is the loss. Food still heals the keep from beside it. A raise still spends wood and gold from anywhere the hero stands, and it still stakes houses on the town rings. Feed still needs the hero beside the keep. The five heroes, the six monsters, and the six build buttons stay. Hold still waits until the host starts.

## How a slice proves itself

The concept slice is this page, the planned edges, and the backlog rows. `mix test` still passes. The simulation does not change. The coverage floor stays 74.

The generation slice adds `World.generate/1`. One test builds two worlds from seed 3 and requires equal biomes, blockers, and points of interest. One test requires the keep disc clear. One test flood-fills from the origin and requires every point of interest on the fill. One test requires each symmetry disagreement fraction to be at least 0.35. These tests call `World`, which is the interface a later tick will call.

The exploration slice wires `world` into `State` and raises the walk clamp to 7200. A server test opens a chest at a known coordinate and requires gold to rise by 24 once, and a second open to add nothing. A server test breaks one portal and requires the next wave plan to omit that portal's bearing, with night 1 still two goblins when two portals remain. A browser scenario walks a hero to a chest and reads the new gold. Another walks to a portal, breaks it, and reads a wave that does not spawn on that bearing.

The resource slice adds stone, `Rules.cap(:stone)` of 200, and the meadow check on sow. A farmer sow on pine fails and spends nothing. An engineer at a quarry gains stone faster than a warrior at the same node. A stone wall pays 8 stone and 4 wood and has 280 health. The interaction test's resource list gains `stone` in this slice, not before, because `Rules.cap/1` has to exist.

The performance slice keeps generation off the hot tick. A test builds every chunk, records the generator count, ticks 20 times with 15 connected heroes, and requires that count to stay put. A time ceiling belongs to the perf harness when that harness has a trunk baseline. This slice does not invent a looser timeout to go green. If the harness is absent, the generator count is the gate.

## Locked numbers

| Name | Value |
| --- | --- |
| World radius | 7200 |
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
