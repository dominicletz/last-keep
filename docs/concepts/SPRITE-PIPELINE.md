# Hero sprite pipeline (HD-2D)

How a hero becomes an 8-direction pixel sheet with a walk and an idle. Since 2026-11-01 the frames come from Grok Imagine stills and Grok video clips. `script/hero_sprites.py` runs every step except the generation calls. The hand-built Blender path is superseded (see the end of this page).

## Why video

Every pro pipeline keeps all frames on one source, because separate drawings drift: the shield changes arms, the cape changes length, and the walk frames do not meet. Octopath and Triangle Strategy paint from a turned base body. Dead Cells renders one 3D model. The box mesh we built in Blender kept the frames consistent, but it never looked like the concept. An image-to-video model, started from the concept pose, keeps the likeness and the consistency inside one clip. No paid service beyond Grok, no TRELLIS, no PixelLab.

## Screen convention

S faces the camera. E faces screen-right. N is the back. W faces screen-left. The sword is in the warrior's right hand and the blue kite shield with the gold cross is on his left arm. The mage holds the staff in their right hand. The scout holds the bow in their right hand, with the spyglass at the left hip. The farmer holds the pitchfork in his right hand and carries the grain sack on his back. The engineer holds the hammer low in his right hand and carries the planks on his back. No view is a mirror of another. Never flip a frame to make a missing direction, because that moves the shield to the other arm.

Sheet columns follow `pictureColumn`: S, SW, W, NW, N, NE, E, SE. Column 0 is the hero facing the camera: walking toward screen-bottom in game, and on the start screen. Column 2 faces screen-left and column 6 faces screen-right. `heroes.test.js` locks this with the camera that `seat` places and the headings of the movement keys.

## Procedure for a new hero

Only the GenerateImage and GenerateVideo calls are manual. Everything else is `script/hero_sprites.py`, driven by the hero's config `assets/reference/HERO/hero.json`. Each step writes the same bytes when re-run. A PNG whose pixels already match is left alone, so re-running a step never dirties git.

| # | Step | Who | Command or call | Writes |
|---|---|---|---|---|
| 1 | Config | by hand | edit `assets/reference/HERO/hero.json` | |
| 2 | Concept crop and prompts | script | `python3 script/hero_sprites.py HERO prep` | `concept.png`, `prompts.json`, `prompts.md` |
| 3 | Four views | **manual** | GenerateImage calls `view-S`, `view-N`, `view-W`, `view-E` from `prompts.md` | `video/views/v-<DIR>.png` |
| 4 | Normalize views | script | `python3 script/hero_sprites.py HERO views` | `video/views/k-<DIR>.png` |
| 5 | Turntable | **manual** | GenerateVideo call `turntable` | `video/turntable.mp4` |
| 6 | Start poses | script | `python3 script/hero_sprites.py HERO dirs` | `video/dirs/<DIR>.png`, `video/diagonals.json` |
| 7 | Walk and idle clips | **manual** | 16 GenerateVideo calls `walk-<DIR>`, `idle-<DIR>` | `video/walk-<DIR>.mp4`, `video/idle-<DIR>.mp4` |
| 8 | Precheck | script | `python3 script/hero_sprites.py HERO precheck` | prints the clips to regenerate |
| 9 | Build and check | script | `python3 script/hero_sprites.py HERO build` | `priv/static/images/hd2d/HERO-walk.png`, `-normal.png`, approval files |
| 10 | Approval | **Dominic** | contact sheet and GIFs in `/workspace/lk/approval/HERO/` | |
| 11 | Client | by hand | add HERO to `SHEET_HEROES`, `HERO_MARKS` in `strip.test.js`, picture tests | |

All of it needs python3 with numpy, scipy and Pillow, plus ffmpeg and ffprobe on PATH.

### 1. The config

`hero.json` holds:

- `noun` and `possessive`: "the armored knight" and "his", or "the mage" and "their".
- `concept`: `{"file": ...}` for a concept kept as it is, or `{"source": "docs/concept/heroes.jpg", "box": [x0, y0, x1, y1]}` for a crop of the shared concept sheet (1280×720). The boxes are mage 294,112,538,575, scout 512,150,775,588, farmer 738,88,1025,588, and engineer 962,150,1262,594.
- `design`: the look in one phrase, without the held items.
- `items`: `name`, `at` (`right hand`, `left arm`, `left hip`, `back`, `right shoulder back`, or `body`), `walk` (how it moves in the walk), `still` (what must not move in the idle), `idle` (an allowed idle motion), `glows` (a light that must stay steady), and `sides` (the image side per direction, when the default is wrong).
- `turntable`: 8 s at 24 fps, keyframes W 2, N 4, E 6. An optional `design` replaces the hero's `design` in the turntable prompt only, for example to name the held items there (the engineer).
- `diagonals`: turntable frames pinned by eye (0-based). They override the picker.
- `check`: the check profile (see step 9). A hero without one can run every step except `build`.

The prompts name the hand that holds each item and the side of the image it shows on. The script turns the item's body position to each facing. An item in the right hand is image-left from the front, image-right from behind, and partly hidden behind the body in the left profile (W). A `sides` entry overrides that. The mage's staff stays image-left for S, SW, W and NW, and image-right for N, NE, E and SE, because the clips hold it out to the side.

### 2. `prep`

Crops the concept (a PIL crop of the box, saved with the PIL defaults) and writes `prompts.json` and `prompts.md`: every generation call in order, with the tool, its exact arguments (`description` or `prompt`, `reference_image_paths`, `image_path`, `last_frame_path`, `keyframes`, `duration`, `aspect_ratio`, `resolution`), the file to save the result as, and the step to run next. Paths are relative to the repository root. `hero_sprites.py HERO prompts --abs` prints them absolute. `prep` also normalizes any views that exist already.

### 3. The four views (manual)

Run `view-S` first, with the concept as its reference. Then run `view-N`, `view-W` and `view-E` with the concept and the front still. Each profile is its own image. Save each as `video/views/v-<DIR>.png` (a `.jpg` works too). Reject a still that moves an item to the other hand, crops the feet, or adds a floor.

### 4. `views`

Turns each `v-<DIR>` into `k-<DIR>.png`. The figure is min(RGB) < 225. A fragment under 2% of the figure that reaches outside the figure's box is blanked, so a speck cannot change the scale. The figure is cropped to its box, scaled with Lanczos to 520 px tall, and centred on a 720×720 white canvas with its last row at y = 639. These are the turntable keyframes and the four cardinal start poses.

### 5. The turntable (manual)

The `turntable` call: 8 s, 1:1, 720p, first frame = last frame = `k-S.png`, keyframes `k-W.png` at 2 s, `k-N.png` at 4 s, and `k-E.png` at 6 s.

### 6. `dirs`

Copies `k-S`, `k-W`, `k-N` and `k-E` to `dirs/`. A hero without view sources keeps its committed cardinals. Each diagonal is a turntable frame strictly between its two cardinals' keyframes (SW between S at 0 and W at 2 s, SE between E at 6 s and the last frame). For each candidate frame, dA and dB are the silhouette pixels (min(RGB) < 225) that differ from each cardinal. The balance is min(dA, dB) / max(dA, dB). Among the frames within 90% of the best balance, the sharpest (Laplacian variance on the figure) wins. A frame pinned in `diagonals` wins over the picker. `video/diagonals.json` records the picker's choice and the frame used.

Look at the four diagonals before the clips. A diagonal near the front can look frontal; then pin a frame further round. The picker against the eye picks, 0-based:

| Hero | Picker SW / NW / NE / SE | Pinned SW / NW / NE / SE |
|---|---|---|
| warrior | 28 / 78 / 118 / 174 | 20 / 74 / 122 / 166 |
| mage | 45 / 78 / 134 / 162 | 46 / 67 / 122 / 156 |
| scout | 28 / 79 / 123 / 165 | 32 / 72 / 120 / 164 |
| farmer | 36 / 82 / 117 / 167 | 42 / 82 / 117 / 158 |
| engineer | 30 / 70 / 118 / 170 | 30 / 70 / 118 / 154 |

### 7. Walk and idle clips (manual)

Sixteen 2 s clips, 1:1, 720p, each with first frame = last frame = `dirs/<DIR>.png`. The walk prompt keeps the facing, says "torso does not twist", and keeps each item on its side. The idle prompt holds the pose, lists what stays still, and asks for steady light.

### 8. `precheck`

Before the build, `precheck` names every clip to regenerate and why. It exits 1 if any clip fails. It checks the raw clips:

- format: square, 24 fps, 49 frames (2 s with the last frame = the first);
- the loop closes: the last frame's silhouette differs from the first by at most 0.5 (walk) or 0.6 (idle) of the walk median step;
- the clip starts on its pose: the first frame differs from `dirs/<DIR>.png` by at most 0.2 of the walk median;
- an idle stays put: no frame differs from its first by more than 0.8 of the walk median. The approved idles reach at most 0.64; walks reach at least 1.04.

Then it builds the sheet in memory and runs every check from step 9. Each failure names the clips whose frames failed it. Height, foot line, speckles, prop side and the back and front views blame the clip of the failing row. Walk legs blame the walk, idle subtle blames the idle, and a palette anchor blames the poses. The prop side and the view checks catch a walk that turns. Facing is not judged from the clip's silhouette, because that misread approved clips.

Without a `check` profile, `precheck` runs only the raw clip checks above, so it cannot see a prop that drops out of a frame. Fill the profile before trusting a pass.

Regenerate the named clips with the same call from `prompts.md` and run `precheck` again. Do not loosen a check.

### 9. `build`

Runs `sprite_from_video.py HERO`, then `check_sprite_sheet.py HERO`, and writes `contact.png`, `walk.gif`, `idle.gif` and `check.txt` to `$HERO_APPROVAL_ROOT/HERO` (default `/workspace/lk/approval/HERO`; `--approval DIR` overrides). It exits 1 if a check fails. The two scripts still run on their own:

```
python3 script/sprite_from_video.py HERO --report /tmp/report.json
python3 script/check_sprite_sheet.py HERO --out /tmp/approval
```

The builder reads `assets/reference/HERO/video` and writes `priv/static/images/hd2d/HERO-walk.png` and `HERO-walk-normal.png`. The checker reads that sheet, the poses in `video/dirs`, and `assets/reference/HERO/concept.png`. `--clips`, `--out`, `--sheet`, `--poses`, and `--concept` override the paths. The same inputs give the same bytes.

How `sprite_from_video.py` works:

1. Decodes each clip with ffmpeg and cuts out the white background (border-connected near-white, plus enclosed pure-white holes of 24 px or more), then keeps blobs of at least 2% of the largest.
2. Walk: the cycle ends at the frame most like frame 0 after 55% of the clip. The 8 walk frames sit at k·cycle/8, each the sharpest frame within ±1. Idle: 4 frames evenly over the clip, each the sharpest within ±1.
3. Places each frame in a 128 px cell with a box filter. The fill is 86 px and the 1 px outline makes the hero 88 px tall. The boots sit on row 116 and the outline on row 117. The head centre sits on x = 64. The scale is per frame, clamped to the clip's median ±5%.
4. Builds one palette of at most 28 colours plus the outline RGB 24 (Lab k-means, weighted toward saturated pixels so the shield blue, the gold cross, and the cape survive). The palette samples only the eight start poses in `dirs/`, so swapping a clip cannot move it. When it also sampled the clip frames, swapping the NE idle clip moved the front-view shield blue off its hue. It quantizes every frame, removes lone speckles, draws the outline, and writes the albedo and `-normal.png` (a port of `normalsFromAlbedo`). The normal alpha is the albedo alpha.

The sheet is 8 columns by 12 rows (8 walk, then 4 idle), 1024×1536. The client loads it from `priv/static/images/hd2d/HERO-walk.png`.

`check_sprite_sheet.py` checks the same things for every hero. The colours it reads come from the `check` profile in the hero's `hero.json`: roles (hue range, chroma and lightness bounds), concept anchors, the prop colour, and floors and ceilings for the back and front views. `hero_sprites.py HERO colours` lists the concept's main colours with hue, lightness and chroma to start a new profile from.

| | warrior | mage | scout | farmer | engineer |
|---|---|---|---|---|---|
| Concept anchors (ΔE 15) | shield blue, gold cross, skin, red cape | staff crystal cyan, skin, robe blue, gold trim, staff brown | cloak green, skin, leather brown, brass, spyglass blue | denim blue, skin, straw, leather brown, shirt cream, iron grey | leather brown, cream shirt, skin, iron grey, plank wood |
| Prop side | shield (blue) | staff crystal (cyan, hue 180–200°) | spyglass (blue, hue 195–240°), not in W and E | pitchfork tines (neutral iron, lightness > 0.3), all 8 | hammer head (neutral iron, lightness > 0.3), not in NW and SE |
| Back view N | face ≤ 6 px, cape red ≥ 201 | hood: face in head columns ≤ 10, robe blue ≥ 1001 | face in head columns ≤ 6, green ≥ 630 | face in head columns ≤ 10, straw (hat and sack) ≥ 107 | face in head columns ≤ 6, planks ≥ 82 |
| Front view S | blue ≥ 60, cross ≥ 8, face ≥ 8 | robe blue ≥ 600, gold trim ≥ 150, crystal ≥ 40, face ≥ 30 | green ≥ 260, leather ≥ 570, spyglass ≥ 12, face in head columns ≥ 24 | denim ≥ 95, straw ≥ 58, iron ≥ 68, face in head columns ≥ 8 | shirt ≥ 94, planks ≥ 77, iron ≥ 47, face in head columns ≥ 8 |

The mage and scout faces count only the head columns 54–74, so the staff head or the quiver beside the head is not counted as a face. The scout's spyglass hangs at the left hip, so in W it faces the camera and in E it hides behind the body. Both put it on the body midline, so `prop_dirs` leaves those two out. The scout and farmer floors are about 60% of the start poses' counts. The farmer's pitchfork is grey iron and brown wood. Colour roles never claim a grey (chroma under 0.12), so the profile adds the role `iron` with `"neutral": true` and lightness above 0.3, which keeps the light tines and drops the dark shading. The tines sit 7 to 22 px off the body in every pose and every sheet row, so the farmer needs no `prop_dirs`. The farmer N face ceiling is 10, as for the mage: the N rows show up to 7 skin pixels at the neck and ears, and the S rows at least 15. Every engineer colour is a brown of hue 20–34, so his roles split by chroma and lightness: skin (chroma > 0.4, lightness > 0.55), shirt (lightness > 0.55), plank wood (chroma > 0.3, lightness > 0.35), leather. His prop is the hammer's iron head. NW hides it behind the body (0–2 px), and in SE it hangs in front of the legs and crosses the body midline from row to row (−7 to +7 px), so `prop_dirs` leaves those two out. The engineer floors are about 60% of the start poses' counts.

- Sheet size, alpha only 0 or 255, at most 32 colours.
- The palette keeps the profile's concept anchors within ΔE 15.
- Every silhouette edge is outline, height 88 ±2, one foot line ±1, no lone speckles.
- The prop side for each direction is the side the start pose shows. A pose with less than 2 px of offset or no visible prop colour has no side to hold.
- The back view and the front view hold the profile floors and ceilings above.
- The 8 directions differ from each other and from each other's mirror by at least 300 px.
- The walk lower half changes by at least 16 px per step, and contact frames 0 and 4 differ.
- The idle is subtle: its largest silhouette change is at most 0.6 of the walk's median.

With `--out` it writes `contact.png` (concept, 1x and 2x rows, all walk rows at 2x), `walk.gif`, and `idle.gif`. It exits 1 if any check fails. `assets/js/hd2d/strip.test.js` re-checks the committed PNG in node (size, alpha, palette, outline, height, foot line, prop side, back and front views, distinct directions, walk motion) for every hero in `SHEET_HEROES`, so a bad sheet cannot land when nobody runs the Python check. CI does not run ffmpeg or the Python scripts.

### 10. Approval

Dominic approves each hero from `/workspace/lk/approval/HERO/`: `contact.png`, `walk.gif`, `idle.gif` and `check.txt`. A hero goes into the client only after `build` passes, and its PR stays a draft until he approves it. If he rejects a clip, regenerate it, run `precheck` and `build` again, and refresh the approval files. Regenerate a clip that fails a check rather than relaxing the check.

### 11. Client

Add the hero to `SHEET_HEROES` in `assets/js/pictures.js`, give it a `HERO_MARKS` entry in `assets/js/hd2d/strip.test.js` (its prop and back and front colours), and extend the picture tests. Then run `cd assets && npm test` and `npm run check`.

### Local tests

```
python3 script/test_sprite_from_video.py   # palette step, hero profiles
python3 script/test_hero_sprites.py        # configs, crop, views, picker, pins, prompts, idempotency, precheck (about 2 min)
```

`test_hero_sprites.py` requires the mage `k-*.png` to come out of the view step byte for byte, the pinned frames to reproduce every committed diagonal byte for byte, `prep`, `views` and `dirs` to write nothing on a committed hero, the committed prompt files to match the configs, and `precheck` to name a walk cut short and an idle that walks.

## Lessons learned

- Make each profile its own image and say which hand holds each item. The one prompt that asked for four views in one image duplicated a profile, so two views showed the same side.
- The idle prompt must be strict: hold the pose, angle and facing of the first frame, list what stays still, and say arms, body, feet and head do not move. Looser idles swayed and failed the idle check (warrior S, SW, NW, SE).
- Say "torso does not twist" in the walk prompt. Before it, the first warrior NE walk drifted off its pose: the upper half moved up to 207 px from the pose and the sword lifted. The regenerated clip stays within 88 px.
- No flashing lights in the idle. The mage's first E idle pulsed the crystal, and the glow changed the silhouette by 1334 px per step. The idle prompt now names every glowing part and asks for the same brightness in every frame.
- A diagonal near the front can look frontal. Check the four diagonals by eye after `dirs` and pin a frame further round when one does.
- Never mirror a frame for a missing direction: it moves the held item to the other hand.
- Write each held item's side in `hero.json` `sides` to match the frames the clips use, then rerun `prep`, so `prompts.json` records the prompts actually sent. A side can be `image-left`, `image-right` or a phrase used as written, such as "in front of the body, on the image-left side". The farmer's W, E and SE walks needed that.
- A grey prop such as iron needs a role with `"neutral": true`: the colour roles never see greys. On the farmer the plain neutral class also took the dark shading and fell on the body midline.
- Fill the `check` profile before trusting `precheck`. Without it `precheck` passed all 16 engineer clips; with it, it caught walk W row 4, where the hammer vanished from his hand.
- Grok clips are not perfectly camera-locked, so the build scales and anchors each frame on its own.

## In the client

`SHEET_HEROES` in `assets/js/pictures.js` lists the heroes with a walk sheet: `warrior`, `mage`, `scout`, `farmer` and `engineer`, so every hero has one. `walkSheetUrl(hero)` gives each sheet's URL. `litHero` in `assets/js/hd2d/picture.js` draws each of them from its own sheet on a square card of 128 sheet texels. The nominal texel is 32/88 world units, so the hero stays `spriteHeight` (32) tall and his boots stand on y = 0. Every frame `present` calls `snapHeroCard`, which scales the card so one texel covers a whole number of screen pixels at its depth for the drawing camera. That covers the start screen too. Under half a pixel per texel the card keeps its nominal size. So a drawn sheet hero is 88 texels times the snapped texel, not 32 world units: at 1280×800 near the host ring that is one pixel per texel, about 36.7 units, 15% over the body. `window.__lastKeep.figures` measures the drawn 88-texel hero (`sheetHeroSize`), not the 128-texel cell, and reports `hd`. `heroSilhouettes` scales its 28 to 36 band, the body height and the card width by `sheetHeroHeight` / 32 (`e2e/screen.js`, the same rounding as `heroTexel`) for a hero drawn from its own sheet, with the same ±1 pixel rounding. Voxel and atlas heroes keep scale 1. The lit-hero cap (`LOOK.litHeroes`, 2) goes to sheet heroes first. A sheet hero whose sheet has not loaded stays a sprite and does not borrow another hero's sheet. A hero id outside `SHEET_HEROES` stays on the 4-frame voxel atlas. The picture tests cover that fallback with the made-up id `atlas-only`.

## Superseded: the Blender box mesh

Until 2026-11-01 the frames came from `script/warrior_sheet.py`: a box mesh built by hand, written to `assets/models/warrior.blend` and `warrior.glb` under Blender 4.2.9, and drawn by the script's own z-buffer into 64 px cells (a 40 px hero). It was consistent but did not match the concept. The script and the models were removed with the video sheet. The script would have overwritten the sheet. They are still in git history. `docs/VERIFICATION.md` records that history.

## Sources

1. https://business.4gamer.net/article/1810/18101801/
2. https://news.denfaminicogamer.jp/kikakuthetower/231218g
3. https://www.ndw.jp/trianglestrategy_pixelart-interview/
4. https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
5. https://pixeli.pebbly.space/knowledge/rules/37-views-and-directions
