# Hero sprite pipeline (HD-2D)

How a hero becomes an 8-direction pixel sheet with a walk and an idle. Since 2026-11-01 the frames come from Grok Imagine stills and Grok video clips, cut down by one script. The hand-built Blender path is superseded (see the end of this page).

## Why video

Every pro pipeline keeps all frames on one source, because separate drawings drift: the shield changes arms, the cape changes length, and the walk frames do not meet. Octopath and Triangle Strategy paint from a turned base body. Dead Cells renders one 3D model. The box mesh we built in Blender kept the frames consistent, but it never looked like the concept. An image-to-video model, started from the concept pose, keeps the likeness and the consistency inside one clip. No paid service beyond Grok, no TRELLIS, no PixelLab.

## Screen convention

S faces the camera. E faces screen-right. N is the back. W faces screen-left. The sword is in the warrior's right hand and the blue kite shield with the gold cross is on his left arm. No view is a mirror of another. Never flip a frame to make a missing direction, because that moves the shield to the other arm.

Sheet columns follow `pictureColumn`: S, SW, W, NW, N, NE, E, SE.

## Steps

### (a) Four views on white

Generate front (S), left (W), back (N), and right (E) stills with the image model, one per prompt, from the concept `assets/reference/warrior/concept.png`. Template:

> The same warrior as the reference, full body, standing, feet flat, seen from <front / his left side, facing screen-left / behind / his right side, facing screen-right>. Camera at the game's 3/4 view, about 30° above eye level. Sword in his right hand, blue kite shield with a gold cross on his left arm, red cape. Plain pure white background, no shadow, no floor, nothing cropped.

Reject a still that moves the shield to the right arm, crops the feet, or adds a floor. `sprite_from_video.py` normalizes every pose to the same height and foot line, so the stills do not need to match in size. The poses go in `assets/reference/warrior/video/dirs/<DIR>.png`.

### (b) Turntable for the diagonals

Make one 8 s clip from the S still: the camera orbits the standing warrior once at constant speed, at the same 3/4 elevation, white background. The keyframes are S at 0 s, W at 2 s, N at 4 s, and E at 6 s; check them against the stills from (a). Each diagonal is the sharpest frame (Laplacian variance) within ±5 frames of its 45° point: SW at 1 s, NW at 3 s, NE at 5 s, SE at 7 s. Save them as `dirs/SW.png`, `dirs/NW.png`, `dirs/NE.png`, `dirs/SE.png`. The clip is `assets/reference/warrior/video/turntable.mp4`.

### (c) Walk and idle clips

For each of the 8 directions, make two 2 s clips started from `dirs/<DIR>.png`, with first frame = last frame = that pose:

- `walk-<DIR>.mp4`: > walks in place facing the same way, one full stride cycle that loops, camera locked, no turning, white background.
- `idle-<DIR>.mp4`: > stands still and only breathes; sword, shield, and cape stay still; camera locked, white background.

Grok clips are not perfectly camera-locked, so the script scales and anchors every frame on its own.

### (d) Build and check

```
python3 script/sprite_from_video.py assets/reference/warrior/video \
    priv/static/images/hd2d/warrior-walk.png --report /tmp/report.json
python3 script/check_sprite_sheet.py priv/static/images/hd2d/warrior-walk.png \
    --poses assets/reference/warrior/video/dirs \
    --concept assets/reference/warrior/concept.png --out /tmp/approval
```

Both need python3 with numpy, scipy, and Pillow, and ffmpeg/ffprobe on PATH. The same inputs give the same bytes.

`sprite_from_video.py`:

1. Decodes each clip with ffmpeg and cuts out the white background (border-connected near-white, plus enclosed pure-white holes of 24 px or more), then keeps blobs of at least 2% of the largest.
2. Walk: the cycle ends at the frame most like frame 0 after 55% of the clip. The 8 walk frames sit at k·cycle/8, each the sharpest frame within ±1. Idle: 4 frames evenly over the clip, each the sharpest within ±1.
3. Places each frame in a 128 px cell with a box filter. The fill is 86 px and the 1 px outline makes the hero 88 px tall. The boots sit on row 116 and the outline on row 117. The head centre sits on x = 64. The scale is per frame, clamped to the clip's median ±5%.
4. Builds one palette of 28 colours plus the outline RGB 24 (Lab k-means, weighted toward saturated pixels so the shield blue, the gold cross, and the cape survive). It quantizes every frame, removes lone speckles, draws the outline, and writes the albedo and `-normal.png` (a port of `normalsFromAlbedo`). The normal alpha is the albedo alpha.

The sheet is 8 columns by 12 rows (8 walk, then 4 idle), 1024×1536. The client loads it from `priv/static/images/hd2d/warrior-walk.png`.

`check_sprite_sheet.py` checks:

- Sheet size, alpha only 0 or 255, at most 32 colours.
- The palette keeps the concept's shield blue, gold cross, skin, and red cape within ΔE 15.
- Every silhouette edge is outline, height 88 ±2, one foot line ±1, no lone speckles.
- The shield side for each direction is the side the start pose shows. A pose with less than 2 px of offset or no visible blue has no side to hold.
- The back view shows the cape and no face. The front view shows the shield blue, the cross, and the face.
- The 8 directions differ from each other and from each other's mirror by at least 300 px.
- The walk lower half changes by at least 16 px per step, and contact frames 0 and 4 differ.
- The idle is subtle: its largest silhouette change is at most 0.6 of the walk's median.

With `--out` it writes `contact.png` (concept, 1x and 2x rows, all walk rows at 2x), `walk.gif`, and `idle.gif`. It exits 1 if any check fails. `assets/js/hd2d/strip.test.js` re-checks the committed PNG in node (size, alpha, palette, outline, height, foot line, shield side, back and front views, distinct directions, walk motion), so a bad sheet cannot land when nobody runs the Python check. CI does not run ffmpeg or the Python scripts.

### (e) Approval

Dominic approves the warrior from the contact sheet and the GIFs before any other hero goes through this pipeline. Regenerate a clip that fails a check, rather than relaxing the check.

## In the client

`litHero` in `assets/js/hd2d/picture.js` draws the warrior on a square card of 128 sheet texels. The nominal texel is 32/88 world units, so the hero stays `spriteHeight` (32) tall and his boots stand on y = 0. Every frame `present` calls `snapHeroCard`, which scales the card so one texel covers a whole number of screen pixels at its depth for the drawing camera. That covers the start screen too. Under half a pixel per texel the card keeps its nominal size. Other heroes stay on the 4-frame voxel atlas.

## Superseded: the Blender box mesh

Until 2026-11-01 the frames came from `script/warrior_sheet.py`: a box mesh built by hand, written to `assets/models/warrior.blend` and `warrior.glb` under Blender 4.2.9, and drawn by the script's own z-buffer into 64 px cells (a 40 px hero). It was consistent but did not match the concept. The script and the models were removed with the video sheet. The script would have overwritten the sheet. They are still in git history. `docs/VERIFICATION.md` records that history.

## Sources

1. https://business.4gamer.net/article/1810/18101801/
2. https://news.denfaminicogamer.jp/kikakuthetower/231218g
3. https://www.ndw.jp/trianglestrategy_pixelart-interview/
4. https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
5. https://pixeli.pebbly.space/knowledge/rules/37-views-and-directions
