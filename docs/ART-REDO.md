# Art redo: every graphic on the hero sprite pipeline

The five heroes now come from the video pipeline in
[`concepts/SPRITE-PIPELINE.md`](concepts/SPRITE-PIPELINE.md): concept, four
generated views, a turntable, 2 s clips, then a pixelized 8-direction sheet
with 1 screen px per texel. Everything else in the yard still uses the older
art. The monsters and props are concept-sheet crops, the keep is box meshes,
and the effects are spheres. This file lists every graphic, gives each one a
pipeline variant, and tracks the work.

## Variants

| | Variant | For | Generated media |
|---|---|---|---|
| **a** | Turntable plus clips | Figures that move in 8 directions | 4 views, 1 turntable, and a clip for each (kind, direction) |
| **b** | Static multi-view | Billboards that never walk: buildings, props | 1–4 views, or a turntable keyframed only where the camera can see it; no clips |
| **c** | Single image plus pixelize | Flat things seen from one side: icons, portraits, ground tiles, decals | 1 GenerateImage, then palette and pixelize offline |
| **d** | Keep procedural or shader | Things that scale, animate per frame, or tile endlessly: sky, fog, mist, bursts, rings | none |

**Scale rule.** Every sprite uses the hero texel: 32/88 ≈ 0.364 world units
per texel, which is 1 screen px at 1280×800. A figure H world units tall is
`round(H × 88 / 32)` px tall (`hero_sprites.sheet_height`). For the current
monster heights this gives:

| Monster | World height | Sheet height |
|---|---|---|
| goblin | 18 | 50 px |
| wolf | 18 | 50 px |
| bat | 16 | 44 px |
| skeleton | 22 | 60 px |
| troll | 34 | 94 px |
| boss | 34 | 94 px |

The keep reads at 197 px. The troll and the rider must stay under 1.75 keep
doors (`monsters.js`). Silhouettes must stay inside the registry `minArea`
floors and under `iouLimit` 0.85 to their neighbours. The e2e night checks
must keep passing: "bat wings and the rider read above the night yard",
`nightYardPixels`, and `paradeShowsEveryKind`.

**Open decision for Dominic: ground texel.** `ENVIRONMENT-ART.md` sizes the
ground at `pixelStep(168,400)` = 0.84 units per texel, which is 2.3× coarser
than the heroes. The props should follow the hero texel, so that a wall
next to a hero has the same pixel size. The ground can stay coarser as a
deliberate backdrop, or it can be rebaked at the hero texel. The terrain row
below waits on this choice.

## To-do

The table is in priority order. Status values: `todo`, `prompts` (the
prompts.json is committed and the media is not generated yet), `media`,
`sheet`, `live`, `keep` (variant d, no work), `blocked`, and `planned` (a
proposed asset the game does not draw yet).

Terrain, buildings, flora and fauna are all remade on the new pipeline
(sections 3, 6, 9 and 10).

### 1. Monsters (variant a)

All six are concept-crop cards today. `buildCard` in `assets/js/monsters.js`
builds them from the 160 px fronts in `monster-data.js` (1 MB of base64),
which are cut from `docs/concept/monsters.jpg` with `MONSTER_CROPS`. Their 8
directions, walk 4, attack 3 and death 4 frames are synthesized
(`pictures.js`). `render.js monsterMesh` draws them with `heroCard` and
`rimCard`, and bats get `lift` 22. The elite marks are small boxes over the
HP bar.

| Asset | Files | Current | Var | Clips / views | Notes | Status |
|---|---|---|---|---|---|---|
| goblin | `assets/reference/goblin/` | card, crop 16,328,236,246 | a | walk ×8, attack ×8 (spear jab), death S/W/N/E | Most common enemy and the smallest figure, so it tests the scale rule first. Sheet 50 px in an 80 px cell. The spear is held upright, so the 50 px includes it. MARKS: ears, spear | **sheet built, in the client; walk-N to regenerate** |
| skeleton | `assets/reference/skeleton/` | card, crop 260,328,260,246 | a | walk ×8, attack ×8 (sword slash), death S/W/N/E (collapses into bones) | 60 px in an 88 px cell (room for the slash and the heap). MARKS: ribs, blade. One sword in the right hand, no shield; one iron shoulder plate on the sword arm. The sword is `visible: true`, so every prompt asks for it in full view. Must read pale against the night yard. Every clip generated; precheck fails 9 clips (walk-E, walk-SW, walk-NW, attack-S, attack-W, attack-NW, attack-E, death-S, death-W), so no sheet yet. Check profile tuned on the start poses (see `asset.json` check `_note`) | **clips in, 9 to regenerate** |
| wolf | same | card | a | run ×8 (quadruped gait), attack ×8 (lunge bite), death ×4 | 50 px tall but wide, so the cell may need to be wider than tall. The turntable is side-on. MARKS: muzzle, tail | todo |
| bat | same | card | a | fly ×8 (flap loop replaces walk), attack ×8 (dive), death ×4 (falls) | 44 px, drawn at `lift` 22, needs a shadow disc. The e2e test needs the wings to read above the night yard | todo |
| troll (ogre) | same | card | a | walk ×8, attack ×8 (club slam, ties to the `slam` event), death ×4 | 94 px, under 1.75 keep doors. MARKS: tusks, club | todo |
| boss (dark rider) | same | card | a | ride ×8 (horse gallop), attack ×8 (lance or sword), death ×4 | 94 px. Rider and horse together; the horse sets the silhouette. MARKS: helm, horse | todo |
| elite marks | `render.js` (plated, lean, spiked boxes) | box meshes | c | 3 small icons | Could become overlays on the sheet instead of boxes | todo |
| HP bars | `render.js` box meshes | mesh | d | — | Keep, but snap to the texel grid | keep |

### 2. Hero extras

| Asset | Files | Current | Var | Clips / views | Notes | Status |
|---|---|---|---|---|---|---|
| hero portraits ×5 | `priv/static/images/portraits/<hero>.png` (76×96) | old voxel close-ups (6c36e1e) | c | 1 bust each | Used in the HUD (`play.js:740`) and the touch thumb (`play.js:888`). They clash with the new sheets. Cheap: crop each new `v-S.png` to a bust, then pixelize to 76×96 with the sheet palette. No generation needed | todo |
| hero attack and death clips | `hero.json` clips | sheets have walk and idle only | a | attack ×8, death ×4 per hero | The same script path as the goblin, once the builder takes attack and death rows | todo |

### 3. Yard buildings and props (variant b unless noted)

Every building in `rules.ex` (`building/1`: wall, stone_wall, tower, trap,
field, forge, mage_tower, house) has a row below, plus the keep.

These are concept-crop cards today. `assets/js/yard_cards.js` sets their
world sizes, and `propCrops` in `assets/models/tiles.js` sets the crops,
baked into `tile-data.js` (2.2 MB) per phase: day, dusk and night.

| Asset | Files | Current | Var | Views | Notes | Status |
|---|---|---|---|---|---|---|
| wall | `yard_cards.js` 30×40 | card | b | S, plus an E/W side for runs | Most-built piece; must tile side by side | todo |
| tower | 28×48 | card | b | S (the bow and roof read from the front) | Shots leave from its top | todo |
| house | 56×64 plus 6 window glow sprites | card | b | S | Window glow stays a separate sprite (variant d) | todo |
| keep (ranks 0–4) | `registry.js keepParts(rank)`, masonry `640,100,48,64` | box and cone meshes plus torch light | b | S per rank (5 images) | 197 px, contrast 25. `keep.scale.y` shrinks with HP: draw damage states instead? Brazier and torch stay lights | todo |
| forge | 48×36 | card | b | S | Glow on the fire | todo |
| mage_tower | 26×36 | card | b | S | | todo |
| trap | 22×20 | card | b | S, armed and sprung | | todo |
| field | 46×26, flat | card | c | top-down, plus a sown and a ripe stage | Ties to the sow and harvest actions | todo |
| stone_wall | none (r 16 in `rules.ex`) | **no art** | b | S | `buildingMesh` falls to `modelParts("stone_wall")`, which throws "no model": **latent render crash**. Needs a card or a fallback now | blocked (bug) |
| tree | 48×40, cut | card | b | S, plus a felled stump | Today this one card is also the forest wall, the yard trees and the outer ring (`scenery.js`), so it fills most of the screen; section 9 splits it into variants | todo |
| felled wood (scenery) | 18×30 | card | b | S | | todo |
| chest | gold box 16×12×16 | mesh | b | S, closed and open | | todo |
| portal / hell door | `horizon.js gateGeometry`, at most 8 instanced | two posts and a glowing plane | b | S, plus a glow layer (variant d) | Planned in the docs as hell doors | todo |
| map table | box 36×8×22 plus a cloth plane at (0,160) | mesh | b | S | The chunk map stays painted on top | todo |

### 4. Points of interest and NPCs with no art yet

These are in the snapshot but `render.js` never draws them. `WORLD.md` says:
"Terrain and these points of interest will be drawn by the pixel-art lane".

| Asset | Var | Notes | Status |
|---|---|---|---|
| quarry | b | Stone source | todo |
| camp | b | | todo |
| shrine | b | Relics are HUD text only; a relic icon could come with it (variant c) | todo |
| vagrant (NPC) | a | idle ×4, walk ×8 | todo |
| merchant, hermit (planned) | a | idle ×4 | todo |

### 5. Projectiles and effects

| Asset | Current | Var | Notes | Status |
|---|---|---|---|---|
| arrow, bolt, volley | sphere r 6 (0xf2e2b0) | c | One sprite, rotated to the flight direction (8 or 16 pre-rotated frames, never rotated in-engine off the texel grid) | todo |
| fireball, meteor | sphere r 11 / 14 (0xff7a2a) | c | 4-frame flicker loop. Bloom stays | todo |
| frost | sphere r 6 | c | | todo |
| bursts: boom, death, slam | expanding spheres over 520 ms | c or d | A pixel burst flipbook (4–6 frames) per event; or keep the spheres, snapped | todo |
| nova, guard, mark, dash, barricade | rings or tints | d | Keep as shapes, snapped to the texel | keep |
| ghost placement, range ring | green box, gold ring | d | | keep |
| hero and monster rims | BackSide shell, rim card | d | | keep |
| contact shadows | canvas disc | d | | keep |

### 6. Terrain (waits on the ground-texel decision)

| Asset | Files | Current | Var | Status |
|---|---|---|---|---|
| yard grass | `ground.js groundPixels`, `grassCrop` 312,276,48 of theme.jpg | concept crop | c (seamless tile) | todo |
| plaza disc and ring | `propCrops.path`, RingGeometry 154–164 | crop | c | todo |
| paths NS/EW | `propCrops.path` | crop | c | todo |
| yard edge | `dissolveYardEdge` | shader | d | keep |
| horizon biome window | `horizon.js paintWindow` (256 texel over 6144) | painted from `biomeRgb` flat colours | c (re-bake from the new biome tiles below) | todo |
| meadow ground | `world.ex` cell biome `:meadow` (the keep disc and open land), `horizon.js pictureCell` | yard grass / `biomeRgb` | c (seamless tile) | todo |
| pine ground (forest floor) | biome `:pine` | `SHADE` flat colour | c (seamless tile, needles and moss) | todo |
| ruins ground | biome `:ruins` | `ringColor` flat colour | c (seamless tile, broken flagstones) plus ruin props in section 9 | todo |
| river water | biome `:river` (blocked) | `SHADE` flat colour | c (seamless tile, 2–4 frame ripple) | todo |
| ford | biome `:ford` (a walkable river cell) | as river | c (shallow water over stones tile) | todo |
| cliff | biome `:cliff` (blocked), skirt `:cliff`, `biomeLift` 16 | `ringColor` plus lift | c (top tile) plus b (cliff face, section 9) | todo |
| hill | skirt `:hill`, `biomeLift` 56 | `sunsetColor` plus lift | c (seamless tile) | todo |
| mountain | skirt `:mountain`, `biomeLift` 120 | `horizonColor` plus lift | c (seamless tile, rock and snow) | todo |
| dirt | `ground.js` `STONE` flecks (`n2 < 0.07`), worn plaza and paths | noise flecks | c (seamless tile, trodden dirt and pebbles) | todo |
| void (outside the world) | `world.ex` `:void` | none (fog) | d | keep |

### 7. UI

| Asset | Files | Current | Var | Notes | Status |
|---|---|---|---|---|---|
| resource icons: wood, food, gold | `game.css` sacks (radial gradients) | CSS | c | 3 icons, 16–24 px | todo |
| build buttons ×8 | `hud.js BUILD_FACE` (text) | text | c | Icon per build, taken from its own prop sprite | todo |
| start-screen title and landscape | `start_screen.ex`, `start.js`, `START-SCREEN.md` | 3D yard at dusk plus text | c | A pixel title or logo; the backdrop stays the live yard | todo |
| logo, favicon | `logo.svg`, `favicon.ico` | vector | c | From the pixel title | todo |
| rotate-device icon | inline SVG in `room.html.heex` | SVG | — | Keep | keep |
| floaters, beacons, hint arrows | DOM and CSS | CSS | d | Pixel font later | keep |

### 8. Sky, fog and post (variant d)

`scene.background` from `skyColor`, `THREE.Fog` from 900 to 2400, far pines
(instanced cones, at most 180), the mist shader (0.28, 0x4e4651 by day,
0x322c3c at night), the hemisphere light, bloom, depth of field and the
height and distance fog in `hd2d/picture.js`. All of these stay procedural.
Everything above stays procedural (status **keep**) except the far pines:

| Asset | Files | Current | Var | Notes | Status |
|---|---|---|---|---|---|
| far pines | `horizon.js pineGeometry`, `placeTrees` on `pine` cells, role `far-pine` | instanced cones, at most 180 | b | The new pine sprite (section 9) as instanced billboards, at most 180, snapped to the texel | todo |

### 9. Flora and natural barriers

Today all trees are one card (`tree`, section 3) or cones (far pines). The
forest wall is two rings of 54 and 62 trees (`scenery.js forestWall`, pine
0x353e27) with gaps at the four cardinals, the outer scenery is three rings
of 24, 24 and 22 (`sceneryForest`, parts stump and log), and the horizon
draws pines on `pine` cells. Rocks, bushes, grass tufts and flowers do not
exist yet; the ground only has noise flecks.

| Asset | Used by | Current | Var | Notes | Status |
|---|---|---|---|---|---|
| pine | forest wall, `pine` biome, far pines (section 8) | `tree` card / cones | b | S view plus 1–2 size or shape variants; the far pines reuse it as instanced billboards | todo |
| broadleaf tree | yard trees, `meadow` edges | `tree` card | b | S view plus a second shape | todo |
| dead or burnt tree | `ruins` biome, night or after a fire | none | b | S view | todo |
| dense forest barrier | `forestWall` rings | 116 single tree cards | b | A wide strip of interlocking pines (2–3 tileable segments), so the wall reads as one barrier and draws as few quads | todo |
| stump and log | `sceneryForest` parts, felled trees | parts on the tree card | b | Shares the tree palette; ties to the felled-wood card in section 3 | todo |
| bushes | yard edge, `meadow` | none | b | 2–3 variants | todo |
| rocks and boulders | `ruins`, `hill`, `cliff` edges; a source look for the quarry | none | b | 3 sizes; the large boulder can block like a cliff cell | todo |
| cliff face | `cliff` cells and the cliff skirt (`biomeLift` 16) | flat colour plus lift | b | Front face strip, tileable; the natural barrier the walk blocking already uses | todo |
| ruin stones | `ruins` biome | flat colour plus lift 8 | b | Broken walls and columns, 2–3 variants | todo |
| grass tufts | yard and `meadow` ground | ground noise | c | 3–4 small decals scattered by seed | todo |
| flowers | `meadow` ground | none | c | 2–3 small decals | todo |
| reeds | `river` and `ford` banks | none | c | 2 small decals | todo |

### 10. Fauna

The game has no ambient animals today: nothing in `assets/js` or `lib`
draws or simulates wildlife (the wolf and the bat are enemies, section 1).
These are proposed, all purely client-side decoration with no gameplay.

| Asset | Where | Var | Clips / views | Notes | Status |
|---|---|---|---|---|---|
| birds (crows) | over the forest wall and fields by day | a (small) | fly ×8 or ×4, take-off and land | Scatter when a hero walks close; gone at night | planned |
| deer | `meadow` and `pine` edges outside the yard | a | walk ×8, idle ×4, flee ×8 | Flees from heroes and monsters | planned |
| rabbits | yard edge and fields | a (small) | hop ×8, idle ×4 | Ties to the field (sow and harvest) | planned |
| fish or ripples | `river` and `ford` | c | 2–4 frame jump | Optional | planned |

## Why the goblin is first

- It is the most common enemy, so it is on screen in every wave.
- At 50 px it is the smallest figure, so it tests the scale rule and the
  non-hero cell before the larger monsters do.
- It is a biped like the heroes, so it reuses the whole view, turntable and
  walk path and adds only the new attack and death clip kinds.

## Generalizing the pipeline

`script/hero_sprites.py` already drives the goblin through `prep`, `views`,
`dirs` and `prompts`. Hero output is byte-identical: the committed hero
`prompts.json` and `prompts.md` regenerate with no diff, and
`test_committed_prompt_files_are_current` pins this.

**Done in this change:**

- `assets/reference/<asset>/asset.json` with `"type": "monster"`. A hero
  keeps `hero.json` and has no type key. The loader refuses a mismatch
  between the file name and the type.
- Optional keys, each with a default that is the old hero text:
  - `style_refs`: extra references for view-S. The goblin uses the approved
    engineer front view, so it shares the hero render style.
  - `source_note`: for example, "draw only one goblin" when the concept
    shows a group.
  - `feet`: replaces "boots" in the view text.
  - `gait`: replaces the hero marching phrase in the walk text.
- `clips`: a map from kind (`walk`, `idle`, `attack`, `death`) to
  directions. The hero default is walk and idle in all 8. `attack` and
  `death` need their motion text in `attack` and `death`.
  - An attack clip starts and ends on `dirs/<d>.png`.
  - A death clip has no `last_frame_path` and ends lying still.
  - The last clip carries `then: hero_sprites.py precheck`.
- `sheet`: `{world_height, height, cell}`. The loader checks that `height`
  is `world_height` at the hero texel, and that `cell` is a multiple of 8
  with at least 16 px over the figure.
- `view_notes`: an extra sentence for one view, after the items sentence.
  The goblin's view-E was regenerated with one so the spear stays visible;
  `prompts.json` records what was sent.

**Monster sheets (done):**

1. `sprite_from_video.Spec` holds `cell`, `height`, `fill`, `foot` and the
   rows. Heroes use `HERO_SPEC` (the old constants, so their sheets are the
   same bytes; `SheetBuildTest` rebuilds the mage). A monster's spec comes
   from its `sheet` block: the goblin is an 80 px cell, a 50 px figure, the
   foot at row 72 and the outline at row 73.
2. Rows by clip kind, top to bottom: walk 8, attack 6, death 6. Monster
   sheets have no idle row and no normal map: they draw unlit, like the
   voxel card they replace.
   - Walk picks as for heroes. The anchor is the torso centre, not the head,
     because the head measure follows the upright spearhead.
   - Attack: start, two wind-up frames, the farthest frame, one between, and
     the first frame back near the start. The feet stay on the start feet.
   - Death: six frames from the start to the first frame at rest.
   - Every kind takes its scale from frame 0, the shared start pose, so the
     body is one size in every row.
   - A direction with no clip of a kind takes the cardinal that keeps its
     read: death SW and SE come from S, NW and NE from N. Never mirrored.
3. The goblin's `check` block in `asset.json` holds its anchors and roles:
   iron, leather, skin, ochre (eyes and inner ears), and the front and back
   reads. `check_sprite_sheet.py goblin` runs the monster checks: start
   frames 50 ± 1 px, walk 50 ± 4 px (the spear swings), feet, the spear in
   every walk and attack frame, a strike that reaches, a death that ends on
   the ground, and diagonal deaths equal to their cardinal.
4. Client: `MONSTER_SHEETS` in `pictures.js` names each sheet's layout.
   `picture.dressMonster` swaps a monster's voxel card for a plane cut from
   `<kind>-sheet.png` at the hero texel, snapped to whole pixels like the
   heroes. Without a sheet (Node, a failed load, any other kind) the voxel
   card stays.
5. Static props (variant b), still to do: a `views` list in `asset.json`
   (for example `["S"]` or `["S","E"]`) and no `turntable` or `clips`. A
   `props` step pixelizes each view to the `sheet` height with the same
   palette path.

**Known limits:**

- The goblin's orange eyes are about one pixel at 50 px. The check uses
  them only as a ceiling on the back view, not as a front requirement.
- `walk-N.mp4` fails precheck: the clip stalls for its last ten frames, so
  the loop hitches and the first frame is 19 px off the pose (limit 18).
  Regenerate it; the sheet built from it passes the sheet checks.

## Goblin: how to run it

The paths are relative to the repository root. `python3 script/hero_sprites.py goblin prompts --abs` prints them absolute.

- Config: `assets/reference/goblin/asset.json`
- Calls: `assets/reference/goblin/prompts.json` (25 calls: 4 views, 1 turntable, 8 walk, 8 attack and 4 death clips), with a readable copy in `prompts.md`.
- References: `assets/reference/goblin/concept.png` (the goblin group from
  `monsters.jpg`) and `assets/reference/engineer/video/views/v-S.png` (the
  style reference).

To produce the goblin:

1. Generate `view-S`, then the other three views.
2. Run `hero_sprites.py goblin views`, then the turntable.
3. Run `hero_sprites.py goblin dirs`, then the clips.
4. Run `hero_sprites.py goblin precheck`, then `build`. The build writes
   `priv/static/images/hd2d/goblin-sheet.png` and the approval images:
   `sheet.png`, `strip.png`, `contact.png`, and `walk`, `attack` and
   `death.gif`.
