# Environment art (HD-2D)

How the yard, the keep, one pine, and one cottage sit next to the warrior sheet. The hero pipeline is `docs/concepts/SPRITE-PIPELINE.md`. This page is the sample of the same density on the world. Dominic approves this sample with the warrior before the rest of the yard is remade.

## What the pros do

Octopath painted the world as low-poly meshes with pixel textures, then lit those textures. Acquire tried the coarseness until it sat between a photo and a dot: finer than that and the model went photoreal, coarser and it was only a low-poly prop. They put normals on the dots so a torch moved the shading, narrowed the camera so the perspective stayed gentle, and built houses smaller than the people, the FF6 chibi scale, because a life-size house next to a sprite stopped reading as a diorama. A 16×16 tile stamped across a field, so they added tile variation. Depth of field, bloom, and a tilt-shift grade sit on top. Water is the exception they allowed to go photoreal. Triangle Strategy uses that split on the battlefield: the map is the diorama and the units are the spun sprites in the hero pipeline. The Live A Live remake wraps the 3D locations in pixel textures so they sit with the sprites, and Historia started the look on the tree, because the field is full of them. They kept a narrow field of view so the wide lens did not bend the walls. Their depth of field is lighter than Octopath's, on purpose.

The rule this sample takes from that is one texel step shared by the hero and the ground, nearest sampling so the step stays a hard pixel, and a normal on the stone that is actually a mesh.

## Texel step

`pixelStep(168, 400)` is 0.84. That is one hero pixel in world units. A surface is inside the step when its world size divided by its texel count is at most 0.84. Finer is allowed. Coarser is the miss.

| surface | before | after | verdict |
| --- | --- | --- | --- |
| yard plane | 760 / 512 = 1.484 | 760 / 905 = 0.840 | remade |
| plaza disc | 300 / 256 = 1.172 | 300 / 357 = 0.840 | remade |
| keep stone | 72 / (48 × 2) = 0.75 wide, 104 / (64 × 4) = 0.406 tall | same | already inside |
| pine card | 48 / 96 = 0.50 wide, 40 / 112 = 0.357 tall | same | already inside |
| cottage card | 56 / 96 = 0.583 wide, 64 / 110 = 0.582 tall | same | already inside |

`GROUND_TEX` is `round(760 / 0.84)` = 905. `PLAZA_TEX` is `round(300 / 0.84)` = 357. The pine and the cottage take their world size from `yardCards` and their pixel size from the concept crop. The keep face is the rank-0 tower and courses, 72 by 104, over the masonry crop 48×64 repeated 2 by 4 (`stoneRepeat`).

## Sample

The ground is still `grassAt` from the concept clearing tile, plus the path `#5e4529`, the stone `#4b3c33`, the course `#654e41`, and the sunset `#e58e54`. The pine shade `#2c3416` was already the disc under the keep. Mixes between those are the path blend the yard already had. This sample adds no hex. `tiles.test.js` still requires `tile-data.js` to equal the bake of `theme.jpg`, so the pine, the masonry, the grass, and the cottage crop are not repainted.

A 48 px grass tile sampled on the pixel grid stamps a period. Outside radius 148, a 36-unit block shifts the sample so the next copy does not line up. Inside that disc the shift stays off, and the path flecks stay on the 512 px grid they were written for. A hero-texel buffer with the shift everywhere dropped the keep's day edge to 24.7, under the floor of 25. The disc of 148 measures 25.20. Radius 150 drops the night mage at (160, 0) under the hero floor of 29, because that card's edge rays land inside the disc. The floors stay 25 and 29.

The keep albedo was already nearest. Its normal was linear, which blurs the mortar. Both filters are nearest now. The contact shadow under a hero stays linear: it is a falloff disc, and nearest sampling would stair-step the alpha. The pine and the cottage are sprites. A sprite has no normal slot. Their albedo is the locked crop, already nearest, already inside the hero step, so this sample does not replace those bytes.

`groundPixels` is the rebuild. A second call matches the first byte for byte. There is no committed yard PNG and no Blender step.

## Acceptance

`the yard texel is the hero texel and the grass tile does not stamp` checks the 0.84 step, a 48 px shift that is not a copy, and the byte match. `the pine, the cottage, and the keep stone are at least as fine as the hero` checks the three densities above. `the keep reads against the yard at the gameplay camera` keeps height 197 and contrast 25. `dress lights the keep with a normal map and emissive windows` keeps the masonry normal nearest. `the concept tiles match the bake and stay on the phase palette` keeps the crops.

## Sources

1. https://business.4gamer.net/article/1810/18101801/
2. https://jp.ign.com/project-octopath-traveler/26082/jrpgoctopath-traveler
3. https://www.siliconera.com/project-octopath-traveler-developers-answer-project-started-troubles-developing-hd-2d/
4. https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true
5. https://www.ndw.jp/trianglestrategy_pixelart-interview/
6. https://www.polygon.com/23278977/live-a-live-hd-2d-remake-square-enix-jrpg/
7. https://gamemakers.jp/article/2023_02_21_30973/
