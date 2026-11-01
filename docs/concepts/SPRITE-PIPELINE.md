# Hero sprite pipeline (HD-2D)

How a hero becomes an 8-direction pixel sheet with a walk and an idle. The references stay drawings. The frames come from one posed mesh.

## What the pros do

Octopath painted pixel sprites and lit them with normal maps. Poses were cut from one base sprite, puppet-warped, then fixed by hand. Triangle Strategy drew an unclothed body in 8 directions and spun it before clothing, because the camera turns. Outlines there are RGB 24, never pure black. Dead Cells built a simple 3D model, keyed one cycle, and rendered it tiny with no anti-aliasing plus a normal map per frame.

The shared rule is that every frame comes from one source. Separate drawings drift: the shield changes arms, the cape changes length, and the walk frames do not meet.

## Chosen mesh

The mesh is a hand-built Blender model. No TRELLIS, no PixelLab, and no paid service. The warrior is boxes in `script/warrior_sheet.py`: open helmet, beard, belt, red cape, sword in the right hand, blue kite shield with a gold cross on the left arm. The hero faces +Z. Left is +X.

`figure()` is the rig. One walk of 8 frames (two contacts, two passes) and one idle of 4 frames move the same boxes. Feet and the sword hand are the joints. There is no second skeleton.

Blender 4.2.9 writes `assets/models/warrior.blend` and `assets/models/warrior.glb` when that script runs under `blender --background --python`. The pixels do not come from Cycles. The same z-buffer paints the flat bands whether the process is Blender or `python3`. CI runs `python3 script/warrior_sheet.py --check` and does not download Blender. The 4.2.9 linux tarball is 339MB, and `download.blender.org` answers 403 to this runner, so a fetch would spend the 10 minute job before a pixel was drawn. A local Blender 4.2.9 run of that file (`a10f621e649a`, `blender --background --python script/warrior_sheet.py -- --check`) rewrites the sheet through the same z-buffer and leaves the PNG bytes unchanged. Albedo `93a24b27a14a5c01fa430aa2d16a4a4f85d44da6303696ebf8f0b5b04e437a18`. Normal `59191ad6cfccfe4a70431078f3c10e5d227aae3130e8f869d98d0d4034dff94a`. Those hashes are what `python3` locks. Cycles does not paint a frame.

## Render and pixelize

The camera elevation is `atan(0.9 / sqrt(2))`, about 32.5 degrees, the game's follow slope. Eight yaws sit 45 degrees apart. Column 0 is south, and the orbit is clockwise: S, SW, W, NW, N, NE, E, SE. That is `pictureColumn`, not the left-to-right order of the turnaround plate. No view is a mirror of another. The key light stays fixed in screen space. Each frame keeps an albedo and a normal. The normal's alpha is the albedo's alpha.

The hero card is 32 world units tall. `pixelStep(168, 400)` is 0.84, so the fill is `round(32 / 0.84)` = 38 px inside a 64 px cell. A 1 px outline of RGB 24 sits outside that fill, so the measured height is 40. Nearest-neighbour downsamples the hi-res buffer, then the fill is scaled to 38 before the outline, because a yaw changes how tall a box projects. The foot row of the first cell is the baseline for every cell. The sword tip stays above the boot sole, because the scaler uses the whole opaque span and a blade below the feet would become the ground.

The sheet is 8 columns by 12 rows (8 walk, then 4 idle), 512×768. The warrior picture uses that strip: `directions` 8, `frames` 12, `walk` 8, `idle` 4. Other heroes stay on the 4-frame voxel atlas. `spriteWalk` stays 4.

## Acceptance

`validate()` in the script, `the committed walk sheet is the rasterizer rebuild`, and `no direction equals another or its mirror, and the walk stays on the palette` in `assets/js/hd2d/strip.test.js` require all of the following. The node test reads the committed PNG, so deleting a line from `validate()` does not hide a bad sheet.

- No direction's twelve frames equal another direction or that direction's horizontal mirror.
- Columns 3, 4, and 5 (NW, N, NE) have cape pixels and no skin on every row. A grazing face texel on those columns is recoloured to the helmet mid band before the fill.
- The shield stays on the hero's left in every cell. Hero left is +X. Screen x grows toward the viewer's right, so the shield is right of the body on columns 0, 1, 2, and 7, and left of the body on columns 3, 4, 5, and 6. The gap is at least 2 px. The south contact still has skin.
- The lower half changes by at least 8 px between consecutive walk frames, in every direction. Contact frames 0 and 4 differ by that much too. On the south view the lowest boot pixels lead with the left foot on frame 0 and the right foot on frame 4.
- Every cell's height is within 1 px of 40, and every foot row is within 1 px of the first cell's foot row. The script still requires the exact height 40 and one shared foot row, which sits inside that band.
- Every opaque pixel is in the three-band palette or the outline. The normal alpha matches the albedo alpha.

The concept, the turnaround, and the walk reference stay under `assets/reference/warrior`. They are not the frames. `warrior reference plates stay committed` locks their sizes.

The yard around that hero is `docs/concepts/ENVIRONMENT-ART.md`. The same texel step, `pixelStep(168, 400)` = 0.84, sizes the ground.

## Sources

1. https://business.4gamer.net/article/1810/18101801/
2. https://news.denfaminicogamer.jp/kikakuthetower/231218g
3. https://www.ndw.jp/trianglestrategy_pixelart-interview/
4. https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
5. https://blenderartists.org/t/mimicking-dead-cells-workflow-from-3d-animation-to-2d-animation/1124638
6. https://pixeli.pebbly.space/knowledge/rules/37-views-and-directions
