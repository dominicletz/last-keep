# Art pipeline

The concept sheets in `docs/concept/` are isometric pixel art. The live yard is orthographic 3D with flat faces, drawn through a nearest-neighbor buffer. A low-resolution quantize and a dark edge on those faces leave the faces flat. The picture has to be sprites and tiles taken from the sheets, snapped to the buffer the game already uses, and locked to the `STYLE.md` palette.

`docs/concepts/measure.png` is the measurement. The left panels are crops of `theme.jpg`. The middle panels are `test/gallery/house/day.png` and `test/gallery/keep/day.png`, cut to the ink and scaled with nearest-neighbor. The right panels run the quantize-and-outline pass described below. The keep's block score stays at 1.

## What the sheets are

`heroes.jpg`, `monsters.jpg`, and `theme.jpg` are each 1280×720. They are JPEG, so a raw unique-color count is not a palette: `theme.jpg` has 64,842 distinct colors and 643 buckets when each channel is divided by 16. The painted palette is the forty tokens in `STYLE.md`. Each token is the jpeg-js lower median of a cited patch.

A 48-color median cut of `theme.jpg`, after a box downscale to 320×180, reconstructs that image with a mean per-channel error of 3.10. The same error is 4.79 at 16 colors, 3.68 at 32, and 2.86 at 64. A small palette can hold the sheet. The lock below uses the named tokens and darker steps of each token, so night can dim a color without adding a hue.

## Pixel density

On the keep, after each channel is quantized by 16, a horizontal run of one color has mode 1, median 1, and mean 1.78. A painted mark on the sheet is one or two image pixels.

The game buffer is `frameFor(1280, 800)`: 640×400 internal pixels, `pixelSize` 2, `halfH` 168. One internal pixel covers 0.84 world units. The keep crop in `STYLE.md` (`theme.jpg` at 548,28, 188×230) is about 200 pixels tall. The ink box of `test/gallery/keep/day.png` is 153×197. The keep already occupies about as many internal pixels as the sheet gives it.

A buffer 320 to 480 pixels tall would make that keep shorter than the sheet's keep. The pipeline keeps 640×400 and nearest upscale. `pixelSize` stays 2.

## Outlines and dither

An 8×8 block, colored by `channel // 16`, is the dither measure. The 25th percentile of unique colors in those blocks is the block score.

| crop | box on `theme.jpg` | block p25 | block p50 | hard edge |
| --- | --- | --- | --- | --- |
| town | 480,250, 340×270 | 12 | 15 | 0.070 |
| house | 500,150, 180×160 | 10 | 14 | 0.063 |
| field | 740,300, 250×140 | 13 | 19 | 0.165 |
| keep | 548,28, 188×230 | 6 | 10 | 0.044 |

The keep crop includes sky, so its block score sits under the town. The town crop is the yard floor. Hard edge is the share of horizontal pairs, sampled every second pixel, whose luma differs by more than 28. Luma is `0.2126 r + 0.7152 g + 0.0722 b`.

On the warrior crop, after the same 16-step quantize, 3.5% of ink pixels are darker than luma 40 and touch a neighbor at least 30 luma brighter. Outlines are a one-pixel dark rim. The town crop's dark-edge share, a jump over 45 whose darker pixel is under luma 50, is 0.012.

Exact neighbor matches are the wrong test. On the town crop, 1.0% of adjacent samples are equal. On the heroes sheet the figure sits on a flat ground, and 47.5% match. On the gallery keep, 93.1% match. A floor that demands flat neighbors passes today's keep and fails the town crop.

## Light and camera

Stone pixels on the keep crop, within distance 28 of the stone token `#4b3c33` or the course token `#654e41`, have luma 68.4 on the upper left (2,221 pixels), 68.3 on the upper right (334), 65.7 on the lower left (2,144), and 61.5 on the lower right (1,256). The lit courses are the upper ones. The lower right face is the dark face. Windows and the brazier use the flame and torch tokens. Day light in the game stays on the neutral rig so the armor token stays grey.

The client camera is orthographic. At town rank 0 it sits at `focus + (150, 135, 150)` and looks at `(focus.x, 32, focus.z)`. The elevation is `atan(0.9 / √2)`, 32.5°, and the yaw is 45°. Walls on the sheet stay vertical: in the town crop, 1,115 strong edges continue straight down and 353 continue on the diagonal. The pipeline does not move this camera. It snaps the camera and every sprite origin to an internal pixel so a moving figure does not shimmer between texels.

## Three approaches

**(a) Low internal resolution, palette quantize, outline.** Box-downscale the gallery frame to 360 pixels tall, median-cut to 48 colors, nearest-upscale to the original size, and set a pixel to one third of its RGB where the luma jumps by more than 35.

The gallery keep ink box scores block p25 of 1 and hard edge 0.024. After this pass the same box still scores block p25 of 1 and hard edge 0.024. The gallery house ink box (48×43) scores block p25 of 3 before the pass and 3 after it. The pass can darken a silhouette. It does not put mortar, wheat, or grass variation onto a flat face. Mean distance to the nearest `STYLE.md` token is 13.4 on `theme.jpg` and 8.4 on the gallery keep, so a "closer to the tokens" score would also pass the keep.

**(b) Sprite billboards.** On the goblin crop (`monsters.jpg` at 16,328, 236×246), an 8×8 block that is at least half ink against the sheet background scores block p25 of 13 and p50 of 17 (252 blocks). The gallery goblin day ink box scores block p25 of 3. A billboard taken from the sheet carries the sheet's score. A mesh at the same pixel height does not.

Aligned luma SSIM of that goblin crop against the gallery goblin ink, both box-resized to 64×64, is 0.028. Silhouette IoU, both box-resized to 64×80, ink where luma differs from the border pixel by more than 12, is 0.296. The keep crop against the gallery keep is SSIM −0.053 and IoU 0.351. `test/gallery/goblin/compare.png`, split in half, scores SSIM 0.043.

**(c) Tiles, or 3D under the pixel pass.** A 48×48 patch at `theme.jpg` 366,314, repeated to the town crop, scores block p25 of 14. Its luma SSIM against the town crop, both box-resized to 160×90, is 0.039. The gallery house day frame against that town crop scores 0.087. Block score alone accepts a noisy grass tile. The town crop is houses, wheat, a path, and a fence, so one repeated tile does not match it, and a lit mesh under pass (a) stays at block p25 of 1.

## The choice

Keep the 640×400 nearest buffer. Snap the camera and sprite origins to that grid. Lock every displayed pixel to the palette below. Draw heroes and monsters as billboards from the sheets. Draw the ground, the keep, and the buildings as tiles from the sheets. The simulation keeps positions and colliders in 3D. The pixels of the picture come from the tiles and the sprites.

The snap and the palette lock are the part of (a) that the scores support. The detail comes from the sheets in (b) and (c).

## How a sheet becomes a tile

1. Crop the figure at its `STYLE.md` kind row. The yard crop, which has no kind row, is `theme.jpg` at 480,250, 340×270.
2. Box-downscale that crop onto the internal pixel grid, so one internal pixel covers one painted mark. Snap each pixel to the nearest locked color.
3. Hand-clean jpeg noise and a broken outline. A cleaned pixel stays on the locked palette.
4. Run the scorer. A tile ships when it meets the floors. A later floor may be higher. It may not be lower.

The locked palette is each of the forty `STYLE.md` tokens at 1, 0.60, 0.50, and 0.40, with channels rounded and clamped. A pixel is a member when its distance to the nearest locked color is at most 1. Steps at 1, 0.65, and 0.40 put the lit dusk sunset under luma 90, so the warm tail drops under 0.03, and they put a dark tuft on a brown, so the stone-to-pine gap drops under 25. The 0.60 step keeps that sunset, and the 0.50 step keeps the tuft. Three.js writes linear light into an offscreen target. Showing those bytes as sRGB flattens the yard: a day ground stored that way scores under the spread floor of 8. The pass encodes sRGB, then picks the nearest locked color.

Hero and monster sheets are eight directions at world yaw 0°, 45°, 90°, 135°, 180°, 225°, 270°, and 315°, with yaw 0 facing +x. Each direction has at least four walk frames, three attack frames, and four death frames. A frame is at least 56 internal pixels tall at town rank 0, the same floor `STYLE.md` uses for the day raster. The heroes agent `bc-c0cd18ed` draws those sheets to this spec.

Building and prop tiles follow the kind rows: wall, tower, trap, field, forge, mage tower, keep, tree, scenery, and house, plus the ground, the path, and the pine. Grass, masonry, the house, the field, the wall, the path, the forge, the trap, the tower, the mage tower, the keep, the tree, and the felled wood are phase tiles. Each of those holds block p25 8 and hard edge 0.05 in day, dusk, and night. A placed forge, trap, tower, and mage tower are standing cards. A choppable tree and each pine in the wall are the tree card. The felled-wood card is the cut timber at theme.jpg 360,480, 48×80. The old box at 1080,160 is the ogre, so it is not the card. The outer ring draws that timber card. The live keep stays `keepParts`, so the courses, the three masonry colors, and the readability floor stay. The gallery keep is the keep crop. A flat trap sat under the path and under its contact disc, so the trap stands.

The pixel pass quantizes the 640×400 buffer once per frame. It does not add a shadow map. The perf harness belongs to agent `bc-af503d4f`.

## The fidelity scorer

The scorer lives in `assets/js/art_score.js`, with `assets/js/art_score.test.js`. It reads an internal frame, top row first, and the concept crop registered to that frame's ink box.

| check | floor | concept town | gallery keep today |
| --- | --- | --- | --- |
| block p25 on the town crop | 8 | 12 | 1 |
| hard edge on the town crop | 0.05 | 0.070 | 0.024 |
| luma SSIM on a registered crop | 0.35 | 1 against itself | 0.505 on the keep card |
| silhouette IoU on a registered crop | 0.55 | 1 against itself | 0.850 on the keep card |
| palette membership after the lock | 0.98 | the jpeg is not the render | 1.000 on the keep ink |
| CSS 2×2 block is one color | 0.99 | guards the upscale | client uses nearest at `pixelSize` 2 |

Membership is distance at most 1 from a token at 1, 0.60, 0.50, or 0.40. The earlier lock, 1, 0.65, and 0.40, is not the spec.

Block, hard edge, SSIM, IoU, and membership fail on today's gallery frames. The CSS grid check guards `pixelSize` 2. A bilinear upscale fails it. These floors may only rise. Mood floors, ground spread 8, the stone-versus-pine hue gap of 25, and the 56-pixel hero height stay where they are.

`art_score.test.js` pins the concept-town numbers above. The gallery keep card clears SSIM 0.50 and IoU 0.84, and its ink clears membership 0.98. Those floors only rise. The concept jpeg does not have to pass membership. The frame after the lock does.

## Value and noise

`valueStructure` splits luma into four bands of 64. `spread` is how many of those bands hold at least 2% of the frame. `focalContrast` is the absolute gap between the median luma of the keep, the heroes, and any monster on the canvas, and the median luma of the near ground. The keep's screen box includes the cottage and the pines at its corners, so the subject is the inner ninety percent of that box. The near ground is rows 42% to 90% from the top, the same band as `groundSpread`, and the whole subject box stays out of it. `noiseEnergy` is the mean absolute luma step between horizontal neighbors on that ground.

The concept clearing is `theme.jpg` at 366,314, 48×48. Its noise is 12.43. The live yard, read by `pictureGrade` at the gameplay camera, measured:

| light | spread | focal luma | ground luma | focal contrast | ground noise |
| --- | --- | --- | --- | --- | --- |
| day | 2 | 58 | 53 | 5 | 8.99 |
| dusk | 3 | 55 | 48 | 7 | 11.64 |
| night | 2 | 45 | 38 | 7 | 8.62 |

The floors are spread 2 and focal contrast 5. The noise cap is 12. Spread and contrast only rise. The cap only falls. Sheet props put the full keep box at a day gap of 3 and dusk noise of 12.03. The inner subject restores the gap, and dusk sunset flecks now start at hash 0.88 so the yard stays under the cap. The clearing tile stays noisier than the cap.

Hero and keep readability is the shared `readability` in `art_score.js`. The same function scores monsters at 20 pixels and contrast 60. Heroes stand on the path and on the grass. At the rank-0 gameplay camera the shortest ink box is 32 pixels, and the quiet sample is the scout at night on the path, contrast 29.21. The keep's ink box is 197 pixels, and its quiet sample is the day edge, contrast 25.45. The floors are hero 32 and 29, keep 197 and 25, at day, dusk, and night. They only rise. This is not a second contrast.

## Gallery and the playtest rounds

`docs/gallery.html` gains a yard section: the town crop, the live frame at the same framing, and the six numbers from the scorer. `npm run models` and `.agents/skills/verify-assets/SKILL.md` fail a kind whose registered crop misses a floor.

`playtests/BACKLOG.md` keeps the 1 to 5 fidelity score. `assets/js/fidelity.test.js` still rejects a silent drop of that score. A new fidelity row also records the scorer's block, hard edge, SSIM, and IoU for that area. A round that only eyeballs the sheet is incomplete once the scorer is in the tree.
