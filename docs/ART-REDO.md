# Art redo: every graphic on the hero sprite pipeline

The five heroes now come from the video pipeline in
[`concepts/SPRITE-PIPELINE.md`](concepts/SPRITE-PIPELINE.md): concept, four
generated views, a turntable, 2 s clips, then a pixelized 8-direction sheet
with 1 screen px per texel. Everything else in the yard still uses the older
art. The monsters and props are concept-sheet crops, the keep is box meshes,
and the effects are spheres. This file lists every graphic, gives each one a
pipeline variant, and tracks the work.

## Open questions for Dominic's final review

Approved 2026-11-06 (Dominic, canvas ab9622ae, message t115u). The questions below stay as the record of what was asked. The answers are the decisions. None of these is still blocked on a review.

### Approved answers

1. **Ground texel.** Rebake the ground at the hero texel, 32/88, as seamless tiles. `SHEET_TEXEL` in `hd2d/picture.js` is the shared constant (the static sheets use it; `hero_sprites.TEXEL` is the same ratio). The live yard stays on `pixelStep(168, 400)` = 0.84 until those tiles exist, so the contrast floors are unchanged. The seam check is wrap ≤ the max interior column step (`seamHolds` in `ground.js`, `seam_holds` in `hero_sprites.py`). This unblocks terrain, the horizon, the river and the ford for generation. The four tiles in the image batch (yard grass, meadow, pine floor, ruins) were generated after this answer. Seam and wiring are in section 6.
2. **Monster height test.** Keep the narrowed test, and pin each kind.
3. **Death foot.** A prop on the ground counts toward the death foot. No retake.
4. **WALK_SWING and DEATH_FOOT.** Keep the absolute pixel limits.
5. **Boss bounds.** Accept the boss bounds and the committed-sheet test.
6. **Stone wall.** Size it by footprint width, about 27 units tall. `world_width` is that setting. The field uses it. The stone wall does not, and its committed 110 px sheet stays until a later retake.
7. **Pine variant.** `pineVariant(x, z)` is `phash2` of the rounded cell. Yard trees and both forest-wall rings use it. Far pines already picked a variant by hash.
8. **Boss walk-N.** Closed. Take 4 passed.
9. **Building views.** Accept the three-quarter views. Keep the log wall.
10. **Sprung trap.** Keep the squashed trap.
11. **House windows.** Night glow comes from the painted windows. No glow-sprite layer.
12. **Bush colour.** Accept the colour match. Flora that lands on a building is hidden. The scatter does not test buildings yet; that hide is the decision and is not in this change.
13. **Deer flee.** A new `run` clip kind, held to the walk checks. The proposed flee radius is 60 world units. No sim change: there is no setting or test for that radius. `CLIP_KINDS` is still walk, idle, attack and death, and the deer attack slot is graze, so this batch has no deer run clips.
14 and 22. **Yard pieces and the mage tower.** One theme-style concept sheet, then the normal static pipeline. The sheet holds a chest closed and open, a portal and a hell door, keep ranks 0–4, and a mage tower in the mage palette. Felled wood reuses `stump_log` variant b. A keep may have exactly one variant per rank; the 4-variant cap stays for every other piece (`variant_cap` is opt-in). HP stays on the bar. `keep.scale.y` is 1. The crops are in `assets/reference/yard-concept/crops` (4 px pad). Settings, with no concept box, are `assets/reference/yard-concept/settings.json`. Chest (closed, 96×56 sheet, heights 33 and 41) and the mage tower (96×112, height 99) are wired. The hell door sheet is 144×168, height 154, and is drawn on the existing portal rows. The opening is lava where the crop is a wooden door. Keep and the portal stay unbuilt. Keep rank 0's view is 788×447 against a 60×46 crop, and rank 1's view is 571×883 against a 128×103 crop. The portal view is a floating ring (enclosed hole 96472 px) and the crop is a grounded arch (hole 1867 px). No asset.json for either, so a build cannot write those sheets. Felled wood stays stump_log b.
15. **Far pines.** Accept them. The horizon window rebakes after the ground tiles from answer 1.
16. **Barrier and cliff.** The barrier's overlap pitch is the outer ring measured at a full pine, 40 world units and 110 px (`barrierPitch` in `scenery.js`). Rebuilding the strip is new art, so the live wall stays individual pines and no barrier image is in the batch. The cliff retake is variant c: a seamless tiling rock texture for the 44 px biomeLift step, not the 51 px block or the 35 px pillar. The retake passes the column seam (wrap 129 ≤ interior 169). The sheet is 384×56: a stays the 51×44 block, b the 35×44 pillar, and c is the 44×44 downscale. Cliff biome cells sample the 1024 tile.
17. **Broadleaf.** Retake b so the silhouette is not a smaller round crown. `shape_iou` 0.85 fails a sheet whose variant masks overlap by 0.85 or more. The retake measures a/b IoU 0.310, under 0.85, and `broadleaf-sheet.png` is the new sheet. The gate was not loosened.
18. **Field.** A flat top-down decal, 126×72 px, the card's 46×26 at the hero texel. Ripe and sown. The views passed every static check and `field-sheet.png` is 272×80. The client draws it as a flat plane (`stand: false`), variant by `spotVariant`. `awaiting_art` is gone.
19. **Deer style.** Accept it.
20. **Flora counts.** Accept 64 sprites, 18 bushes and 16 flowers.
21. **Grazing.** Grazing gets its own row kind, and the walk view checks tighten on the start poses. Not built this turn: the deer sheet is not rebuilt, and there is no `run` or graze row in the sheet layout yet.
23. **Still idle.** The start limit for an idle with no walk beside it is max(0.2 × its own step, the encode noise floor). The floor is that dirs pose against the same pose after encode, `cut_out` and `place`. Walks, attacks, deaths, and idles that have a walk stay at 0.2 × the walk median. Re-run after the change, no new clips. Merchant: idle-S start 2, step 51, floor 12; idle-W start 6, step 20, floor 8; idle-N start 1, step 8, floor 34; idle-E start 3, step 1, floor 7. Merchant precheck passes. Hermit: idle-S start 1, step 13, floor 1; idle-W start 3, step 2, floor 1, limit 1, still fails; idle-N start 3, step 14, floor 3, now passes; idle-E start 0, step 1, floor 2. The merchant sheet passes and the snapshot sends him when his chunk is discovered. The hermit stays off. Idle-W is one retake, the same prompt, duration 2.
24. **Attack scale.** Attack frames are placed at frame 0's scale, each on its own foot and its own head centre, the monster and death rule. Frames 0 and last stay 88±2. Every attack frame keeps the foot ±1 and stays clear of the border. A lunge is not a head-line failure, and there is no head-line gate. The five heroes rebuild through `hero_attack_cells`. All five sheets are 1024×3072. Frames 0 and last of each attack stay 88±2. A mid-swing row may leave 88. The foot stays ±1 and the border stays clear.

Scout death-N was delivered at 73 frames (960×960, 24 fps). The hold already passed: the last 12 frames differ from the last by 25 silhouette px, limit 86 (0.2 × walk median 432). `normalize_death_frames` maps a death longer than 49 frames onto `CLIP_FRAMES` by nearest source frame. The still tail is the longest suffix whose placed silhouette stays inside the largest difference already present in the source's last 12 frames. The frames before that sample the fall from frame 0 through the first still frame. Endpoints are exact source frames. Nothing is blended, frozen from a moving frame, or cut off either end. A clip that is already 49 frames is unchanged, and a short clip is not stretched. On this clip the tail is source frames 61–72, copied into the output hold, and the fall from 0 through 61 is sampled into the first 37 outputs. The written file is lossless rgb24, 49 frames, 24 fps. Precheck on that file: hold 25, start 12, height 88..43. The format gate and the 0.2×walk-median limit are unchanged. The scout sheet is 1024×3072 with 0 failing checks. Rabbits are dropped. Status: dropped, walk-NW height gate. Clip precheck passes (loop 3, start 2, walk median 86). Outlined walk heights are 28, 38, 41, 41, 41, 37, 30, 28, max 41, outside 24–32. The other seven walks stay inside that limit. The NW column was not copied from another direction, no check profile was added, and the rabbits stay unwired. Reeds stay unwired; a thin-stalk retake waits until the river tiles from answer 1 exist. Birds are deferred: reuse the bat flier at about 8 world units later. Fish are dropped. A shader ripple stands in for them. No fish or bird calls.

1. **Ground texel (blocks all terrain, section 6).** The ground is 0.84
   units per texel, 2.3× coarser than the heroes. Keep it as a coarser
   backdrop, or rebake it at the hero texel? See "Open decision" below.
2. **Narrowed JS test: monsters drawn shorter than heroes.** In
   `assets/js/hd2d/monster_sheet.test.js` the assert that a monster draws
   shorter than a hero now applies only to monsters with `monsterHeights`
   under `spriteHeight`. The troll and the boss are 34 units by design
   (taller than a 32-unit hero), so for them the test only checks that they
   are one of those two. The keep-door limit (under 1.75 keep doors) still
   applies to every monster. Keep it this way, or change it?
3. **Props lying on the ground and the death foot line.** The troll's
   take-5 death-S failed "death feet on the line" only because of the
   dropped club's head (rows 150..157 against 156), not his body. Should a
   prop lying on the ground count toward the foot line? Not changed; the
   troll passed with take 8, where he never lets go of the club.
4. **Fixed-pixel limits on large figures.** WALK_SWING and DEATH_FOOT are
   absolute pixels, so a 94 px figure (the troll, the boss) gets about half
   the relative room of a 50 px one. Not changed.
5. **Boss view bounds have thin margins.** The boss `check` profile's
   front/back bounds sit 5-7 px from the measured extremes (steel S min 120
   vs N max 109; leather S min 66 vs N max 53), much thinner than the
   troll's (48/96). The troll's 0.2 × start-pose rule would fail the boss's
   own back frames. Accept these values, or ask for another cue?
6. **Stone wall height.** `stone_wall` has no card; its settings use the
   wall card's 40 units (110 px), so a stone wall stands as tall as the
   palisade. The concept's stone wall is lower. Keep 40, or lower it?
7. **Trees alternate two pines.** Every tree (yard, both forest-wall rings)
   now draws the pine sheet, alternating variant a and b by index. The far
   cone pines (section 8) are unchanged. OK, or seed the pick by position?
8. **Boss back-view start check.** Every N clip take starts 82-88 px off
   dirs/N though the first frames match by eye; the limit is 0.2 × the
   walk-N median, so a level trot from behind (median 200) cannot pass.
   Take 4 asks for big leg steps; not changed.
9. **Three-quarter building views (my call: accept).** tower, house, forge,
   trap and wall came out three-quarter (a corner toward the camera) though
   the prompt said front. Accepted: every yard card is cut from
   `theme.jpg`, which is itself painted three-quarter from above, and the
   buildings are camera-facing billboards under the HD-2D tilt, so a
   three-quarter drawing matches what the cards show today. Those pieces now
   say `"view": "three_quarter"` so retakes ask for that angle; stone_wall
   (front-on, tiles in a row) stays `front`. The angle itself is not measured
   by a check (no robust pixel cue); the build records it and a test pins
   each piece's view. The wall is round logs and smoother than the others:
   a retake for style, or keep?
10. **Sprung trap.** The generated sprung image still had upright spikes.
   b is now `"squash_of": "a"`: the armed trap squashed to 0.6 by the build,
   so the spikes read lowered, not folded flat. The game has no sprung
   state yet, so the client draws only a. Keep, or retake for flat spikes?
11. **House window glow.** The six glow sprites were placed for the old
   56×64 card. The new house sheet paints its lit windows, so the sheet
   house draws no glow sprites. Bring a night glow layer back later?
12. **Bush palette and the flora scatter.** The generated bushes were a
   brighter yellow-green than the pine. The build now scales their
   saturation and value by one factor each so their means equal the pine
   sheet's (`"match": "pine"`, deterministic, tested); the hue stays
   olive. Accept, or retake the views darker? The scatter (`flora.js`) puts
   60 sprites (22 bushes, 14 rocks, 24 flowers) between the plaza and the
   forest wall and among the wall rings, off the plaza and the four roads,
   from the run's seed and attempt. They are one pool sharing the static
   materials and only move on a new seed, so there is no per-frame cost.
   Buildings are not avoided (they are placed by the server): a bush can
   stand in front of a building in the yard band. Counts and bands are open.
13. **Deer.** The concepts have no animal, so the deer is drawn from text
   with the forest palette. Its idle uses the attack slot (grazing); a
   flee clip and the client-side animal behaviour need a design first.
14. **Yard pieces with no concept crop.** The concepts have no chest,
   portal or felled-wood pile, and the only keep is the tower crop the
   `tower` sheet uses (five keep ranks also exceed the 4-variant limit).
   Draw them from text with the theme palette, as the deer and the
   stump are, or paint a concept for them first?
15. **Far pines.** The billboards are wired: `horizon.js` `placeTrees` draws
   pine-sheet quads (variants a/b, two instanced meshes, cap 180). That does
   not depend on the ground texel. The horizon window still does, since it is
   re-baked from the ground tiles.
16. **Tileable strips.** The forest barrier and the cliff face should tile
   end to end, but the static build does not check their ends. Add a seam
   check before wiring them? The cliff face came out as a wide-ish block (a) and a tall
   pillar (b), not a strip much wider than tall: built, but a retake may be
   needed before wiring. Neither strip is placed in the client yet.
17. **Broadleaf shapes.** a and b are both round crowns (b only smaller).
   Fine for now; retake b as a distinctly different shape later?
18. **Field size.** The static build scales by height, so a flat 3/4 plot
   is 33 px tall and about 50 px wide, not the field card's 126 px. Build
   flat pieces by width (a new setting), or keep the field card?
19. **Deer style.** The deer views came out in a smoother pixel-art look
   than the voxel style; N, W and E took only v-S as their reference.
   Accept, or retake with the engineer view as a style reference too?
20. **Flora counts.** Grass tufts, stumps and two broadleaf trees joined
   the seeded scatter; to stay at 64 sprites, bushes went 22 -> 18 and
   flowers 24 -> 16.
21. **Deer view checks are weak.** The grazing idle (attack rows) breaks every colour split between front and back: head down, S hides its pale throat and N lifts its cream rump into view. The profile's bounds (N head-band pale at most 17, S pale at least 4) pass every frame but would catch little. Options: a separate graze row kind exempt from view checks, or a shape-based front/back test. Deer take 1 also failed two build checks (walk-N height 54, death-S/N off the foot line); retakes are in /workspace/lk/deer-retake-batch.json. Take 2 fixed walk-N and death-N; death-S still lifts to row 117, so take 3 is in /workspace/lk/deer-retake2-batch.json; take 3 sank to rows 120..125 (rolling onto its side toward the camera), take 4 (folds onto its belly and stays) is in /workspace/lk/deer-retake3-batch.json (asset.json clip_overrides carry every retake prompt).
22. **mage_tower has no concept crop.** `propCrops.mage_tower` (470,330 160×140 on theme.jpg) frames the blue mage figure with his staff, not a tower; there is no mage tower anywhere in the concepts. It joins question 14: design text only, or a crop from elsewhere?
23. **Idle start-pose limit on a nearly still idle.** When a direction has no walk, the start-pose limit is 0.2 × that idle's own frame-to-frame silhouette step. The fallback of 1.0 applies only when that median is exactly 0.0. A very static idle has a tiny median, the printed limit rounds to 0 px, and a 3 px start fails. The last takes, with the rule left as it is: merchant idle-W is 6 px against a limit of 4 (median 20); merchant idle-E is 3 px against 0.2 × median 1, printed 0; hermit idle-W is 3 px against 0.2 × median 2, printed 0; hermit idle-N is 3 px against 0.2 × median 14, which is 2.8 and prints as 3. Merchant idle-S (start 2, median 51) and idle-N (start 1, median 8) pass. Hermit idle-S (start 1, median 13) and idle-E (start 0, median 1) pass. Is 0.2 × the idle's own step the right limit for an idle, or should a still idle use a fixed pixel allowance?
24. **Warrior attack height after the first-frame sentence.** Retake 2 told the weapon to stay inside the first frame's height and width and never rise above the head. Attack-E and attack-S now hold 88. Attack-N still draws 91 (source frame 10 is 566 px against frame 0's 517, 967 px of the blade above that head line; natural scale 0.1519 clamped up to 0.1577; retake 1 was cell 99 from source 614). Attack-NE still draws 95 (source frame 14 is 595 against 521, 2238 px above the head; natural scale 0.1445 clamped to 0.1571; retake 1 was cell 100 from source 624). The placer is still the walk placer, ±5% of the clip median, and the check is still 88±2 over the whole silhouette. Is the remaining spike a clip the model will not follow, or should a blade above the helm be placed differently? Not changed.

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
| bat | 16 Take 5: attack-N passes (head bowed). attack-S rose 24 px (fifth take on the hover check) and attack-NW 34 px with its wide strokes. Root cause: the start pose, not the wording. The start poses stand on the view's foot line near the frame's bottom edge, and the model pulls a biting bat toward the frame's centre: attack-S's body core went from y 562 to 395, NW's from 481 to 327, both ending within 35 px of the 360 centre. `centred_attacks` ["S", "NW"] starts and ends those two on `video/mid/<d>.png`, the start pose moved up so its box is centred in the frame (S -160 px, NW -159 px; take 5 kept in /workspace/lk/bat-take5). The flier build anchors walk and attack on frame 0, so a clip moved as a whole builds the same sheet. Take 6 (centred starts): attack-NW passes, and attack-S holds the hover but barely moves (largest change 420 px against the S walk step median 1305). Take 7 gives attack-S the wide wing strokes that made attack-NW pass (take 6 kept in /workspace/lk/bat-take6). Take 7: attack-S holds the hover, and its strike grew to 1228 px, still under 1305. No frame of the clip reaches 1305, so frame picking can't fix it: the wings fold in on the downstroke. Take 8 keeps them fully spread. Take 8: attack-S passes with its wings fully spread. The sheet `priv/static/images/hd2d/bat-sheet.png` passes all checks. Client: `MONSTER_SHEETS.bat` uses cell 128, figure 44 and footRow 105 (the outline row under the flier foot line 104, 24 px above the cell bottom). render.js already lifts it 22 units, keeps its shadow on the ground and drops it through the death row (`flierLift`). Review images: /workspace/lk/review/bat. | **built, awaiting final review** |
| skeleton | 22 | 60 px |
| troll | 34 | 94 px |
| boss | 34 | 94 px |

The keep reads at 197 px. The troll and the rider must stay under 1.75 keep
doors (`monsters.js`). Silhouettes must stay inside the registry `minArea`
floors and under `iouLimit` 0.85 to their neighbours. The e2e night checks
must keep passing: "bat wings and the rider read above the night yard",
`nightYardPixels`, and `paradeShowsEveryKind`.

**Ground texel, approved 2026-11-06.** The tiles rebake at `SHEET_TEXEL`
(32/88). `ENVIRONMENT-ART.md` still sizes the live yard at
`pixelStep(168,400)` = 0.84 units per texel, which is 2.3× coarser
than the heroes. The props follow the hero texel, so that a wall next
to a hero has the same pixel size. The ground tiles do too, once the parent
generates them. Until then the live yard stays on 0.84.

## To-do

The table is in priority order. Status values: `todo`, `prompts` (the
prompts.json is committed and the media is not generated yet), `media`,
`sheet`, `built, awaiting final review` (the sheet is built and in the client;
Dominic reviews every sheet together once the whole redo is done, with no
per-sheet approval), `live`, `keep` (variant d, no work), `blocked`, and `planned` (a
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
| goblin | `assets/reference/goblin/` | card, crop 16,328,236,246 | a | walk ×8, attack ×8 (spear jab), death S/W/N/E | Most common enemy and the smallest figure, so it tests the scale rule first. Sheet 50 px in an 80 px cell. The spear is held upright, so the 50 px includes it. MARKS: ears, spear | **built, awaiting final review** (sheet in the client; walk-N regenerated; Dominic approved the sheet) |
| skeleton | `assets/reference/skeleton/` | card, crop 260,328,260,246 | a | walk ×8, attack ×8 (sword slash), death S/W/N/E (collapses into bones) | 60 px in an 88 px cell (room for the slash and the heap). MARKS: ribs, blade. One sword in the right hand, no shield; one iron shoulder plate on the sword arm. The sword is `visible: true`, so every prompt asks for it in full view. Must read pale against the night yard. Every clip generated; retakes carry their own wording in `asset.json` `clip_overrides` (prompts.json says what was sent): 9 clips in take 2, then walk-E, attack-E, attack-W and death-W in take 3. All 20 pass precheck; `skeleton-sheet.png` builds byte for byte and passes every check. In the client through MONSTER_SHEETS (88 px cell, 60 px figure, foot row 81). Check profile tuned on the start poses (see `asset.json` check `_note`). Approval: sheet, strips, GIFs and a night shot in /workspace/lk/approval/skeleton | **built, awaiting final review** (sheet in the client; Dominic approved the sheet) |
| wolf | `assets/reference/wolf/` | card, crop 760,340,270,245 | a | walk ×8 (trot on the spot), attack ×8 (lunge bite from planted hind paws), death S/W/N/E (collapses onto its side) | The first quadruped. 50 px tall (ear tips to paws) in a 128 px cell: side-on it is about 95 px long and the lunge reaches about 15 px further. No held item (`items` is empty, check `prop` null). `view_height` 300 normalizes the views shorter so the side view fits the 720 canvas; `view_pose` replaces the person's "arms relaxed" sentence and pins the spine along the view direction (take 1 and 2 of view-S came out three-quarter while it said "from its nose to the tip of its tail"). MARKS: muzzle, tail. Dark charcoal fur: watch it against the night yard. Check profile tuned on the start poses (S keeps its pale ash muzzle, throat and legs; N has none in the head and at most half as much in all). Take 1 (all 20 clips): 15 pass precheck and the sheet checks. walk-SW misses its loop (120 px, limit 111); death-N starts 20 px off the pose (limit 18) and leaps away (paws 12 px above the line); deaths S, W and E end 31-32 px tall (limit 30) with the head or tail up. Take 2 retakes those five through `clip_overrides`; take 1 is kept in /workspace/lk/wolf-take1. Take 2: walk-SW and death-W pass; death-E springs forward off its paws before it drops (feet up to 18 px above the line, limit 3), death-S rises 5 px onto its hind legs, and death-N again starts 20 px off its pose (limit 18). Take 3 asks those three to hold the first-frame pose still for a moment and keep all four paws on the ground (the body only moves down); take 2 is kept in /workspace/lk/wolf-take2. Take 3: death-S passes. death-N's 20 px start miss on every take was the precheck, not the clip: the death clips come back 960 px and the 720 px pose was placed on another sub-pixel grid; `pose_at` now scales the pose to the clip's frame size first (20 -> 1 px; a clip turned to NE still differs by 2x the limit). Take 3 death-N then hops up mid-fall (feet 11 px over the line, limit 3) and death-E ends with its head lifted (31 px tall, limit 30): take 4 folds death-N's legs hind-first with its back only getting lower and keeps death-E's head flat to the end (take 3 kept in /workspace/lk/wolf-take3). Take 4: death-N passes. death-E kept its head down but ended resting on its belly, legs tucked, haunch and mane up (32 px, limit 30; the clip settles at 31 px, so the rest pick is not the fail): 'all four paws stay on the ground' rules out lying on its side, so take 5 drops that line for death-E and rolls it onto its side (take 4 kept in /workspace/lk/wolf-take4). Take 5 ended 31 px again, on its belly with the shoulder mane up, the third take running on that check whatever the wording; death-W, the same fall from the other side, settles at 27 px. So death-E now ends on death-W's last frame, flipped and scaled to the pose (`death_ends` {"E": "W"}, `video/ends/E.png` as its last_frame_path; take 5 kept in /workspace/lk/wolf-take5)  Take 6 (death_ends): death-E passes (ends 27 px tall). All 20 clips pass precheck; `wolf-sheet.png` (128 px cells, 50 px figure) builds byte for byte and passes every sheet check. In the client through MONSTER_SHEETS (128 px cell, 50 px figure, foot row 121). Review: /workspace/lk/review/wolf The death rows space their picks by motion (`death_picks` "motion"): evenly timed picks showed death-E standing for four frames and flat in the fifth; the same clips now give a gradual fall (death-E picks 0, 21, 23, 26, 28, 29), and the sheet passes every check. | **built, awaiting final review** |
| bat | `assets/reference/bat/` | card, crop 408,68,260,96 | a | walk ×8 (a wingbeat in place, `flies`), attack ×8 (snapping bite from the hover), death S/W/N/E (drops to the ground) | The first flier. 44 px (ear and wing tips to feet, wings spread) in a 128 px cell: the wingspan is about 88 px, a wingbeat sweeps above and below the start pose, and take 1 dead on its back with the wings spread flat touched the edge of a 112 px cell. The concept box is 418,66,682,206, not the card crop, which cuts the bat off below its eyes. `view_height` 240 for the spread wings. view-W came out three-quarter twice, so `mirror_views` {"W": "E"} builds it as the flip of v-E (24 calls). Views, turntable and dirs done (SW=32 NW=70 NE=124 SE=164). Flier build and checks (`flies`, see "Fliers" below): walk and attack keep frame 0's anchor and foot line, death lands on each frame's own lowest pixel, and the walk height, walk foot line, attack feet and legs checks are swapped for a start-pose foot line, a body-core hover check and a wingbeat check. Check profile: no prop; the back never shows the red face (N 0 red in every take-1 frame, ceiling 2) and the front keeps its lit chest and membrane (light ≥ 45 = 0.64 × the S start cell's 71). Take 1 (kept in /workspace/lk/bat-take1): walk-S/SW/NW bobbed 28 to 30 px, walk-SE 13 px and touched the cell edge, attack-S/NW/N/NE/E/SE rose 15 to 36 px into the bite, attack-SW touched the edge and struck 1218 px against 1242; the other 9 clips pass. `clip_overrides` retake those 11 with the body held at one height. Client: drawn at `lift` 22 with a contact disc held on the ground under it; `flierLift` brings the lift to 0 across the death row. MARKS: ears, wings. The e2e test needs the wings to read above the night yard Take 2 (kept in /workspace/lk/bat-take2): the walks pass, and the cell edge is cleared by `FLIER_FOOT_MARGIN` 24 (a flier's foot line hangs 16 px higher: the downstroke sweeps the wings below frame 0's lowest pixel). The bites still rose (N 32 px, SE 25, NE 20, S 16) or dropped (E 14) and attack-NW, wings held in, struck 662 px against 897: take 3 keeps the hover's steady wingbeat through the bite. Take 3: attack-E passes; S, NW, N, NE and SE left the hover for the third take running (15-36 px, limit 13). Root cause: the measure is right (the body core and the centre of the largest inscribed disc agree within 3 px and the frames show the body moving); every take asked for a lunge toward the facing direction, which carries a flier's body with it, up the frame in the back views, and attack-N turned to face the camera. Take 4 bites on the spot with a jaw snap and a short head jerk, no lunge, never turning (take 3 kept in /workspace/lk/bat-take3). Take 4: NE and SE pass and N stays level, so the lunge was the back views' cause. attack-S rose 16 px a fourth time with no lunge: the one view facing the camera reads the bite as coming up toward the elevated camera, so take 5 names the target at its own height below the camera. Takes 5 to 8 are in the monsters height table above. Take 8 passes with the wings fully spread, and `priv/static/images/hd2d/bat-sheet.png` passes every check. The client draws it (`MONSTER_SHEETS.bat`, cell 128, figure 44, footRow 105; render.js lifts it 22 and drops it through the death row). | **built, awaiting final review** |
| troll (ogre) | `assets/reference/troll/` | card, crop 524,292,226,286 | a | walk ×8 (heavy stomp on the spot), attack ×8 (overhead club slam in front of him, ties to the `slam` event), death S/W/N/E (sinks to his knees, topples onto his side) | 94 px (34 world units at the hero texel), under 1.75 keep doors, in a 160 px cell: the slam lifts the club about 50 px over his head. The concept box is 526,292,768,580, the registry crop widened so the club head is in it. The club is in his left hand, as the concept holds it, and `visible` so no view hides it. The death holds the start pose for a moment and only moves down (the wolf lesson). MARKS: tusks, club v-S, v-N and v-W are done. view-E faced screen-left twice: the club's far-hand placement (`sides.E`) and the facing (`view_notes.E`) are now spelled out; take 3 of view-E is right. All four views and keyframes are committed Turntable done; `dirs` picked SW 33, NW 79, NE 118, SE 161 (picker, checked on a contact strip: every diagonal faces its way, the club stays in his left hand) Take 1: all 20 clips pass the clip checks. Check profile, tuned on the take-1 trial sheet: no prop (the club is the leather's brown and its grey spikes drop under 6 px in NW, NE and E); `pale` (hue 20-40, light over 0.28: the bone buckle, tusks, eyes and lit hide) is the front, back ceiling 48 (0.2 × the S start pose's 237; N frames 16-47) and front floor 96 (S frames 113-283). Four sheet checks fail: walk-NW 89 px in one frame (94 ±4), death-S ends 70 px tall (limit 56), sinks 4-6 px under the foot line and its club reaches the cell edge, death-W and death-E rise 4 px off the line while kneeling and death-W ends 5 px under it. `clip_overrides` retake those four (take 1 kept in /workspace/lk/troll-take1). Take 2: death-S falls in time and its club stays in the cell. But every lying end sits under the foot line (S and W 4 px, E 5 px; limit 3) and death-E kneels 5 px over it. Cause: a 94 px ogre lying on the ground is deep, and his near side shows lower than the line his feet stood on (the wolf, half his size, stayed within 3). walk-NW hunched to 89 px again. Take 3 topples S, W and E away from the camera with his feet kept in place, and gives walk-NW an upright back (take 2 kept in /workspace/lk/troll-take2). Take 3: death-W passes. death-E's feet lift 4 px mid-fall, so it now ends on death-W's flipped last frame (`death_ends`). death-S ends propped up, 62 px tall (limit 56), with the club at the cell's bottom edge, so take 4 asks for flat on his back with the club behind him. walk-NW dips to 89 px mid-stride, so take 4 asks for no bob. No limit was changed. Take 4: death-E passes (ending on death-W's end). death-S fell backward and ended sitting up, 74 px tall, with its legs at the cell's bottom edge, so take 5 falls sideways across the frame and rolls flat. walk-NW dipped to 89 px a fourth time, so take 5 asks for short steps on almost straight legs. Open for review: WALK_SWING and DEATH_FOOT are absolute pixels, so a 94 px figure gets half the relative room a 50 px one does. They are not changed. Take 5: walk-NW passes. death-S falls sideways and lies flat in time (53 px), and fails one check: death feet on the line, rows 150..157 against a limit of 156. The row-157 pixels are the dropped club's head (x 125-127 in the last two death cells), not his body, so take 6 lands the club flat beside his foot, never rolling toward the camera (take 5 kept in /workspace/lk/troll-take5 with troll5.png). Also open for review: should a prop lying on the ground count toward the death foot line? Not changed. Take 6 laid the club beside his foot but across the frame: 12 cells touch the right edge, the foot line reads 150..159, and 33 edge pixels are off the outline (take 6 kept in /workspace/lk/troll-take6). Take 5 is the closest take and is back as death-S.mp4, but it still fails an existing check, so the troll is not built. Take 7 drops the club behind his heels, away from the camera. Take 7 dropped it in front of him again, across the frame: 3 cells touch the edge and the foot line reads 150..159 (kept in /workspace/lk/troll-take7). Take 5 stays. Take 8 never lets go of the club: it falls with him and ends on the far side of his body. Take 8 passes the precheck and every sheet check (0 failing; no limit changed). `troll-sheet.png` is 1280×3200 (8 columns × 20 rows of 160 px: walk 8, attack 6, death 6 frames per direction; figure 94, foot 152). It is in `MONSTER_SHEETS` (footRow 153), with JS decode tests and Python tests for a byte-for-byte rebuild and the committed sheet's checks. Review images: /workspace/lk/review/troll/. Open for review: the JS test that a monster draws shorter than a hero now applies only to small monsters; the troll and the boss are 34 units by design. | **built, awaiting final review** |
| boss (dark rider) | `assets/reference/boss/` | card, crop 1000,70,275,520 | a | ride ×8 (a horse trot on the spot, the `walk` clips), attack ×8 (halberd chop from the saddle, hooves planted), death S/W/N/E (rider slumps, horse sinks onto its belly) | 94 px (34 world units, helm spikes to hooves) in a 192 px cell: side-on the horse is wider than the figure is tall, the chop lifts the halberd over the helm, and dead the horse lies about 1.5 times the figure height long. Rider and horse are one figure; the horse sets the silhouette. The concept box is 915,70,1280,600, the registry crop widened left so the halberd head is in it (a wolf at its lower left is excluded by `source_note`). `view_height` 360 and a quadruped `view_pose` (the wolf's, spine along the view direction) for the horse. The halberd is in his right hand, as the concept holds it, `visible`, with `sides.W` placing it in the far hand in the left profile (the troll's view-E lesson). The visor and the horse's eye are a `glows` item, so every clip keeps their brightness steady. The concept's purple smoke and cape wisps are left out (deaths forbid particles; loose wisps break the silhouette checks). The horse never rears or steps in the attack, and the death holds the start pose, then only moves down, the rider staying slumped on the horse (the wolf's death-E would not lie on its side). MARKS: helm, horse view-S came out three-quarter on two takes, the horse's head turned to image-left like the reference image (kept in /workspace/lk/boss-viewS-takes). `view_notes.S` now spells out the square front view: the horse's head straight at the camera with both eyes equally visible, the rider centred behind it, the halberd upright beside the horse's head on the image-left side. view-N, W and E wait for a passing v-S. view-S take 3 is square-on and committed. `view_notes.N` spells out the same symmetry from behind. view-N and view-W are right and committed. view-E take 1 faced left, so view_notes.E names the right edge and puts the tail on image-left. E is not mirrored from W, because the halberd is handed. view-E take 2 faces right with the halberd in his near right hand. It is its own drawing, not a flip of W (26.8% of its figure differs from flipped W). `boss views` wrote k-E. Turntable take 1 turned cleanly, and `dirs` picked SW 34, NW 75, NE 119 and SE 165. Every direction faces its way, nothing is mirrored, and S, SW, W, N, NE and E show the halberd. But it vanished twice: hidden behind his back around NW (frames 72-78), and fading out while it jumped from image-right to image-left around SE (frames 156-165). So dirs/NW and dirs/SE have no halberd. The turntable design now keeps it in his right hand, blade high above the helm, in every frame (take 1 kept in /workspace/lk/boss-turntable-take1). Turntable take 2 (kept in /workspace/lk/boss-turntable-take2): `dirs` picked SW 35, NW 77, NE 117 and SE 167. Facing is right and nothing is mirrored, but NW and SE again show no halberd. The cause is the keyframes: W holds it forward and N at his right shoulder, so between them it passes behind his back; between E and S it crosses his dark chest and is lost. Nearby frames that show it are 9-17 degrees off the diagonal, so they are not pinned. Take 3 keys the turntable on two new views, NW at 3 s and SE at 7 s, each with the blade clear above the helm (`diagonal_pose`, `sides`, `view_notes`). dirs/NW and dirs/SE come from those views. GenerateVideo refused the 5-keyframe turntable (at most 4), so NW and SE are `diagonal_views` instead: dirs/NW and dirs/SE are the new views, and the turntable keeps W, N and E. Turntable take 2 stays for SW (frame 35) and NE (frame 117). v-NW: horse's head to the left, back and cape toward the camera, halberd high on the image-right. v-SE: visor and horse's head toward the right, halberd high on the image-left. Each sits between its cardinals (balance 0.89 and 0.86) and is closer to its mirror diagonal flipped than unflipped. All 8 directions are right; nothing is mirrored. Clips take 1: 18 of 20 pass the precheck. walk-N fails the start check by 84 px and attack-N by 87 px; the limit is 55, 0.2 × the walk-N median of 274. Their first frames match dirs/N by eye; from behind the trot barely moves, so the median and the limit are small. Take 2 of walk-N asked for a big trot: all 20 clips then pass the precheck (walk-N median 857, limit 171; walk-N starts 82 px off and attack-N 87 px). The `check` profile is tuned on the trial sheet (/workspace/lk/boss-clips-take1/trial-sheet.png): prop null (the halberd is the armour's iron); front/back on the lit `steel` greys and the brown `leather` (the purple glow overlaps between S and N and cannot bound a view; see open question 5). Anchors, outline, palette, view bounds and the other walk/attack/death checks pass; five clips fail: walk-N take 2 bounces (85-107 px, 94 ±4), walk-NE rises to 103 px, attack-N and attack-SW chop too little (781 and 958 px against walk medians 857 and 1107), and death-N ends 58 px tall (limit 56) with its lowest row 4 px up (±3). Retakes in `clip_overrides`: a level trot for walk-N (take 3) and walk-NE, a wide chop for attack-N and attack-SW, and death-N lying flat on its belly with its head down. All takes kept in /workspace/lk/boss-clips-take1. No limit was changed.  Take 3 precheck (take 2 kept in /workspace/lk/boss-clips-take2): attack-SW and walk-NE pass; 4 failures in the N clips. walk-N take 3 is level but its legs barely move, so its walk median fell to 200 and the start limit to 40; walk-N starts 88 px off and attack-N 87 px. Their first frames match dirs/N by eye, and every N take so far starts 82-88 px off, so the N clips need a walk-N median of at least about 440 (big leg steps with the body level). attack-N also turned his lit front to the camera (steel 117 px in a back view), and death-N reaches row 188 (target 185 ±3). Retakes: walk-N take 4 (hind hooves lift high and step wide, only legs, tail and cape move), attack-N take 3 (back kept to the camera), death-N take 3 (hooves stay on the first frame's ground line). No limit changed.  Take 4/3 precheck (takes in /workspace/lk/boss-clips-take3): walk-N take 4 passes (median 445, starts 84 px off, limit 89). attack-N take 3 holds the halberd level over his helm at the wind-up, so its lit blade and brown shaft show: steel 116 / leather 80 against the back ceilings 114 / 59. death-N take 3 rises to row 182 as he slumps, then the hind legs reach toward the camera to row 189 (185 ±3). Retakes: attack-N take 4 (halberd upright, chop down and out to his right, never level), death-N take 4 (hind legs fold forward under the belly). Take 4 (take 3 kept in /workspace/lk/boss-clips-take4): all 20 clips pass the precheck and every sheet check (0 failing; no limit changed). `boss-sheet.png` is 1536×3840 (8 columns × 20 rows of 192 px, 25 colours, figure 94, foot row 185 in every column). It is in `MONSTER_SHEETS` (cell 192, footRow 185), with JS decode tests and Python tests for a byte-for-byte rebuild and the committed sheet's checks. Review images: /workspace/lk/review/boss/. | **built, awaiting final review** |
| elite marks | `priv/static/images/hd2d/elite-marks.png` | pixel icons above the HP bar | c | plated, lean, spiked | `script/ui_icons.py` fits each view in 20 px on its larger side. Plated and lean snap to the warm steel around 0xd8cfc3; spiked snaps to 0xf5751e over dark iron. One sheet, three 24×24 cells. `eliteLook` still maps armored, fast, and enraged. A plain monster and a boss get no mark. | **built, awaiting final review** |
| HP bars | `render.js` box meshes | mesh | d | — | Keep, but snap to the texel grid | keep |

### 2. Hero extras

| Asset | Files | Current | Var | Clips / views | Notes | Status |
|---|---|---|---|---|---|---|
| hero portraits ×5 | `priv/static/images/portraits/<hero>.png` (76×96) | old voxel close-ups (6c36e1e) | c | 1 bust each | Used in the HUD (`play.js:740`) and the touch thumb (`play.js:888`). `script/hero_portraits.py` crops the top 0.42 of the figure, a 76:96 window on the head, and pixelizes it with that hero's `*-walk.png` palette onto black. Sources are `views/v-S.png` or `v-S.jpg`. The warrior has no `v-S` in the repo, so its portrait uses `video/dirs/S.png`, the front the clips start from. | **built** (`script/test_hero_portraits.py`: each file is 76×96 and matches a rebuild) |
| hero attack and death clips | `hero.json` clips | all five sheets are 1024×3072 | a | attack ×8, death ×4 per hero | Retake 2, the 10 calls in `hero-attack-death-retake2-batch.json`, is in. Thresholds unchanged. No retake 3. The engineer sheet stays 1024×3072 and is the only one the client plays. Retake 2 fixed warrior attack-S (border gone, height 88), attack-E (was 96, now 88), death-W (hold 44, border gone) and death-N (hold 1, border gone); mage attack-NW (was 83 and 91, now 88); scout attack-NW (was 90 and 92, now 88). Still failing, same checks. Warrior attack-N `[88, 88, 91, 88, 88, 88]`: source frame 10 is 566 px vs frame 0's 517, 967 px above that head, natural scale 0.1519 clamped up to 0.1577, cell 91 (retake 1 was 99). Attack-NE `[88, 88, 95, 88, 88, 88]`: source frame 14 is 595 vs 521, 2238 px above the head, natural 0.1445 clamped to 0.1571, cell 95 (retake 1 was 100). That pair is the old ±5% placer. Approved: attack frames use frame 0's scale, so a blade above the helm is not shrunk. Height 88±2 is frames 0 and last. No sheet was rebuilt this turn. Scout death-N is one call in `approved-video-batch.json`. Mage attack-N `[88, 88, 88, 88, 83, 88]`: source frame 17 is 471 vs 518 (−47), natural 0.1826 clamped down to 0.1732, cell 83 (retake 1 was 85). Farmer attack-S `[88, 88, 90, 88, 84, 88]`: the tall frame draws at 90, inside ±2; the short frame is source 470 vs 518 (−48), natural 0.1830 clamped to 0.1742, cell 84 (retake 1 was two frames at 84). Already parked, clips not in retake 2: scout death-N hold was 441 px, limit 86 (0.2 × walk median 432; take 1 was 450). The still-hold retake passes that hold: last 12 frames differ by 25 px, same limit 86, same median 432. The clip is 73 frames at 24 fps, not 49, so the format gate fails and the 12-row sheet was not rebuilt. Farmer attack-SW `[90, 90, 85, 79, 86, 89]`, start 215 px, limit 217 (0.2 × median 1084). All five sheets are 1024×3072 under the frame-0 scale, each with 0 failing checks. Scout death-N is the normalized 49-frame clip. | **wired** |

The approved answers at the top of this file close the review. Yard grass, meadow and ruins passed the column seam and are wired (section 6). The pine floor passes the column seam (wrap 94 ≤ interior 104) and pine biome cells sample it. A `SHEET_TEXEL` yard buffer dropped the plaza spread to 4.72, under the floor of 8, so the live yard stays on `pixelStep(168, 400)` = 0.84. Putting yard-grass under the plaza disc at that step measures spread 3.75, so the plaza keeps `grassAt` and the wider yard plane takes the tile. River and ford are still not in this batch. The yard concept crops are cut. Chest and the mage tower are wired. The hell door sheet is drawn on the portal rows. The portal crop stays unbuilt (section 3). Keep stays unbuilt. Felled wood reuses stump_log b. The field is wired as a flat 126×72 decal. Cliff variant c passes the seam (wrap 129 ≤ interior 169) and cliff biome cells sample the 1024 tile. The sheet is 384×56. Broadleaf b measures IoU 0.310 and the sheet is replaced. The forest barrier stays individual pines. Reeds stay unwired until river tiles exist. Birds are deferred. Fish are dropped. Rabbits are dropped (status: dropped, walk-NW height gate, max 41, limit 24–32; no wrong-facing copy; no check-profile change) and stay unwired. Scout death-N's hold now passes (25 px, limit 86, median 432) and the format gate fails (73 frames, want 49), so the 12-row sheet stays. Merchant precheck passes and stays unwired. Hermit idle-W still fails. Attack sheets were not rebuilt. There is no retake 3 of the old attack prompts.

### 3. Yard buildings and props (variant b unless noted)

Every building in `rules.ex` (`building/1`: wall, stone_wall, tower, trap,
field, forge, mage_tower, house) has a row below, plus the keep.

These are concept-crop cards today. `assets/js/yard_cards.js` sets their
world sizes, and `propCrops` in `assets/models/tiles.js` sets the crops,
baked into `tile-data.js` (2.2 MB) per phase: day, dusk and night.

| Asset | Files | Current | Var | Views | Notes | Status |
|---|---|---|---|---|---|---|
| wall | `yard_cards.js` 30×40 | card | b | S, plus an E/W side for runs | Most-built piece; must tile side by side | **built, awaiting final review** (`wall-sheet.png`, 110 px, 3/4 view; drawn by `buildingMesh` through `staticSheets`/`buildingSheet` in `yard_cards.js`; review /workspace/lk/review/wall) |
| tower | 28×48 | card | b | S (the bow and roof read from the front) | Shots leave from its top | **built, awaiting final review** (`tower-sheet.png`, 132 px, 3/4; drawn by `buildingMesh` through `staticSheets`/`buildingSheet` in `yard_cards.js`; review /workspace/lk/review/tower) |
| house | 56×64 plus 6 window glow sprites | card | b | S | Window glow stays a separate sprite (variant d) | **built, awaiting final review** (`house-sheet.png`, 176 px, 3/4; painted windows, no glow sprites; drawn by `buildingMesh` through `staticSheets`/`buildingSheet` in `yard_cards.js`; review /workspace/lk/review/house) |
| keep (ranks 0–4) | `registry.js keepParts(rank)`, masonry `640,100,48,64` | box and cone meshes plus torch light | b | S per rank (5 images) | 197 px, contrast 25. HP stays on the bar. `keep.scale.y` is 1. Brazier and torch stay lights. Crops are cut. Views 0 and 1 do not match them (788×447 vs 60×46, and 571×883 vs 128×103), so the piece stays unbuilt. No asset.json. The live keep stays `keepParts`. The 4-variant cap stays for every other piece; a keep would opt into `variant_cap` 5, and a digit variant id now loads. | **unbuilt** (crop silhouette) |
| forge | 48×36 | card | b | S | Glow on the fire | **built, awaiting final review** (`forge-sheet.png`, 99 px, 3/4; drawn by `buildingMesh` through `staticSheets`/`buildingSheet` in `yard_cards.js`; review /workspace/lk/review/forge) |
| mage_tower | 26×36 | card | b | S, mage palette | Crop and view match (purple crystal tower, floating shards). Sheet 96×112, figure 99 px. The building draws variant a. | **wired** |
| trap | 22×20 | card | b | S, armed and sprung | | **built, awaiting final review** (`trap-sheet.png`, a 55 px armed, b 33 px sprung = a squashed (`squash_of`), 3/4; drawn by `buildingMesh` through `staticSheets`/`buildingSheet` in `yard_cards.js`; review /workspace/lk/review/trap) |
| field | 46×26, flat | card | c | top-down decal, 126×72, ripe and sown | Ties to the sow and harvest actions | **built, awaiting final review** (`field-sheet.png` is 272×80. Both cells are 126×72 and stand on row 75. `render.js` draws a flat `PlaneGeometry` of the 46×26 card, variant by `spotVariant`. Not a standing sprite.) |
| stone_wall | none (r 16 in `rules.ex`) | **no art**; draws the wall card | b | S | Was a latent render crash: `buildingMesh` fell to `modelParts("stone_wall")`, which throws "no model". Fixed: `cardFallback` in `yard_cards.js` draws the wall card until its own art exists, and `yard_cards.test.js` checks that every `building/1` kind in `rules.ex` has a card or a model | **built, awaiting final review** (own `stone_wall-sheet.png`, 110 px front-on, cell widened to 144; no longer the wall card; review /workspace/lk/review/stone_wall) |
| tree | 48×40, cut | card | b | S, plus a felled stump | Today this one card is also the forest wall, the yard trees and the outer ring (`scenery.js`), so it fills most of the screen; section 9 splits it into variants | **done**: the pine sheet (a, b at 0.85) is the tree card everywhere (`treeSheet`); the felled stump is the stump and log row (section 9) |
| felled wood (scenery) | 18×30 | card | b | S | Reuses `stump_log` variant b. No new image. | decided, no new art |
| chest | gold box 16×12×16 | mesh | b | S, closed and open | Sheet 96×56. Closed is 33 px (scale 0.8, world height 12) and open is 41 px. The live chest draws `closed`. The sim removes a chest when it is opened, so `open` stays on the sheet. | **wired, closed** |
| portal / hell door | `render.js` draws `hell_door` at `snap.portals`, at most 8 | the hell-door sheet, camera-facing | b | S | The portal view is a floating ring (hole 96472 px) and the crop is a grounded arch (hole 1867 px), so the portal stays unbuilt. The hell door sheet is 144×168, figure 154 px, 0 failing checks. Its outer arch matches the crop (aspects 0.821 and 0.857). The opening is a lava oval where the crop is a wooden door. The approved line is monsters emerging from glowing hell doors, and the existing portal rows are those doors, so the sheet is drawn there. The wooden door remains the crop mismatch. The box gate is gone. | **hell door wired on portals; portal crop unbuilt** |

### Yard concept crops (plan, not generated)

`assets/reference/yard-concept/sheet.png` is 1024×1024. These boxes are the non-white pixels (channel above 245), as `[x0, y0, x1, y1)` with x1 and y1 exclusive. Keep rank 4 and the mage tower touch through a one-pixel gap, so rank 4 stops at the y=623 gap and the mage starts there. Pad about 4 px before a crop. Nothing here is a concept box in `settings.json`, and no piece image has been generated. Wait for the parent before `GenerateImage`.

| Piece | Box |
|---|---|
| chest closed | [38, 114, 238, 294] |
| chest open | [270, 75, 480, 305] |
| portal | [512, 43, 752, 308] |
| hell door | [764, 26, 1019, 317] |
| keep rank 0 | [24, 541, 87, 590] |
| keep rank 1 | [115, 492, 248, 599] |
| keep rank 2 | [264, 404, 425, 602] |
| keep rank 3 | [440, 349, 694, 616] |
| keep rank 4 | [704, 319, 1017, 623] |
| mage tower | [657, 623, 976, 1005] |

Two crystal fragments sit inside the mage box and were separate components: [723, 755, 746, 808] and [857, 743, 876, 789]. The mage box already covers them. Felled wood stays stump_log variant b and is not on this sheet.
| map table | `priv/static/images/hd2d/map_table-sheet.png` | sprite at (0, 160), cloth plane at y 13.2 | b | 3/4, one variant | 44 px. The box is gone. The cloth stays where it was, and the chunk map is still painted on it. | **built, awaiting final review** |

### 4. Points of interest and NPCs

The sim places the quarries, camps and shrines. The snapshot sends the ones whose chunk is already discovered, the same filter as a chest, and `render.js` draws the built sheet on that spot. A camp or a shrine leaves the list when the sim removes it. The merchant and the hermit are not sent. A vagrant is an entity in the snapshot, and `render.js` draws `vagrant-sheet.png` for each one. The merchant and the hermit stay off that list. Merchant precheck passes under the still-idle noise floor and is still unwired. Hermit idle-W still fails (start 3, limit 1). That was the last retake of the clips.

| Asset | Var | Notes | Status |
|---|---|---|---|
| quarry | b | Stone source. `quarry-sheet.png`, 88 px. Variant a or b by `spotVariant` on the poi id. Feet on the ground. | **built, awaiting final review** |
| camp | b | `camp-sheet.png`, 77 px, one lean-to and a fire. One variant. | **built, awaiting final review** |
| shrine | b | Relics are HUD text only; a relic icon could come with it (variant c), and that icon is not a variant here. `shrine-sheet.png`, 66 px, empty niche. | **built, awaiting final review** |
| vagrant (NPC) | a | idle ×4, walk ×8. No vagrant on the concept sheets, so the crop is the theme.jpg timber house for cloak colours (`source_note`). v-S is a slight three-quarter, recorded for the final review. The third walk-W holds 88 ±4 (walk frames 84 to 89, start poses 88, feet on row 121). `vagrant-sheet.png` is 1024×1536. The client draws it for each snapshot vagrant. Facing comes from travel, the same way a monster faces, because the snapshot sends no facing. | **built, awaiting final review** |
| merchant (planned) | a | idle ×4, no walk. No merchant on the concept sheets, so the crop is the theme.jpg wheat and stone for the sack colours (`source_note`). v-S is a slight three-quarter, recorded for the final review. After the still-idle floor: idle-S start 2 step 51 floor 12; idle-W start 6 step 20 floor 8; idle-N start 1 step 8 floor 34; idle-E start 3 step 1 floor 7. Precheck passes. `merchant-sheet.png` is 1024×512, 0 failing checks. Face in the top 30% is 66 on S (floor 40) and 3 on N (ceiling 4). The snapshot sends him when his chunk is discovered, and the client draws the idle sheet. | **wired** |
| hermit (planned) | a | idle ×4. No hermit on the concept sheets, so the crop is the theme.jpg night pines (`source_note`). The sim stores one hermit and does not send it. `mirror_views` is `{"E": "W"}`. Turntable, dirs (SW 37, NW 75, NE 121, SE 160) and four idles are in. After the still-idle floor: idle-S start 1 step 13 floor 1; idle-W start 3 step 2 floor 1, limit 1, still fails; idle-N start 3 step 14 floor 3, passes; idle-E start 0 step 1 floor 2. No sheet, not wired. The idle-W retake is `hermit-idle-w-retake-batch.json`, the same prompt as `prompts.json`, duration 2. | **precheck failed, unwired** |

### 5. Projectiles and effects

| Asset | Current | Var | Notes | Status |
|---|---|---|---|---|
| arrow, bolt, volley | `priv/static/images/hd2d/arrow-sheet.png` | c | 18 px arrow, 8 frames turned in pixel space (0°, 45°, …). `arrowFrame` picks the nearest screen direction. The sprite is not rotated. Bolt and volley use the same sheet; a volley is several `arrow` shots. | **built, awaiting final review** |
| fireball, meteor | `priv/static/images/hd2d/fire-sheet.png` | c | 14 px fireball, 4 frames (palette shift and a 1 px row shear). A meteor draws the same sheet at 18 px. The core stays above the bloom gate. | **built, awaiting final review** |
| frost | `priv/static/images/hd2d/frost.png` | c | 12 px shard, one frame. The sim's frost is still an instant slow, so nothing flies until a shot of kind `frost` exists; that shot draws this sprite. | **built, awaiting final review** |
| bursts: boom, death, slam | `priv/static/images/hd2d/burst-sheet.png` | c | Six 32 px frames per event, played across the same 520 ms. Boom uses the fireball oranges, death a grey-violet puff, slam a brown ring. Billboard, position snapped to the texel. | **built, awaiting final review** |
| nova, guard, mark, dash, barricade | rings or tints | d | Keep as shapes, snapped to the texel | keep |
| ghost placement, range ring | green box, gold ring | d | | keep |
| hero and monster rims | BackSide shell, rim card | d | | keep |
| contact shadows | canvas disc | d | | keep |

### 6. Terrain

Approved 2026-11-06: rebake at the hero texel, 32/88, as seamless tiles. The live buffer stays on 0.84. A 32/88 buffer measured plaza spread 4.72 (floor 8). Yard-grass on the plaza disc at 0.84 measured 3.75. The wider yard plane samples `ground-yard-grass.png`. Meadow, ruins, pine and cliff sample their tiles in `biomeColor`. The river stays the flat shade. The ford still samples the meadow tile.

| Asset | Files | Current | Var | Status |
|---|---|---|---|---|
| yard grass | `ground.js groundPixels`, `priv/static/images/hd2d/ground-yard-grass.png` | the passing tile, on the day yard plane | c (seamless tile) | **wired on the day yard plane** (column wrap 102 ≤ interior 147. The plaza disc stays `grassAt`: the tile there measures spread 3.75, floor 8. Dusk and night stay `grassAt`: the day tile under the scout at (160, 0) at night measures contrast 28.72, floor 29. The live mesh is the day paint.) |
| plaza disc and ring | `propCrops.path`, RingGeometry 154–164 | crop | c | todo |
| paths NS/EW | `propCrops.path` | crop | c | todo |
| yard edge | `dissolveYardEdge` | shader | d | keep |
| horizon biome window | `horizon.js paintWindow` (256 texel over 6144) | meadow, ruins, pine and cliff sample their tiles | c | **rebaked** (`biomeColor`. The river stays `SHADE`. The ford samples the meadow tile.) |
| meadow ground | `world.ex` cell biome `:meadow`, `horizon.js pictureCell` | `ground-meadow.png` on meadow and ford cells | c (seamless tile) | **wired on the horizon** (column wrap 65 ≤ interior 123. The keep disc in the live yard is the yard-grass plane, not this tile.) |
| pine ground (forest floor) | biome `:pine` | `ground-pine.png` on pine cells | c (seamless tile, needles and moss) | **wired on the horizon** (column wrap 94 ≤ interior 104.) |
| ruins ground | biome `:ruins` | `ground-ruins.png` on ruins cells | c (seamless tile, broken flagstones) plus ruin props in section 9 | **wired on the horizon** (column wrap 148 ≤ interior 156. Row wrap 151 > interior 150; rows are not the gate.) |
| river water | biome `:river` | `SHADE` flat colour | c (seamless tile, 2–4 frame ripple) | unblocked by the ground texel; not in this batch |
| ford | biome `:ford` (a walkable river cell) | as river | c (shallow water over stones tile) | unblocked by the ground texel; not in this batch |
| cliff | biome `:cliff`, skirt `:cliff`, `biomeLift` 16 | `ground-cliff.png` on cliff cells, plus lift | c (the face tile) | **wired on the horizon** (column wrap 129 ≤ interior 169. No separate top tile.) |
| hill | skirt `:hill`, `biomeLift` 56 | `sunsetColor` plus lift | c (seamless tile) | todo |
| mountain | skirt `:mountain`, `biomeLift` 120 | `horizonColor` plus lift | c (seamless tile, rock and snow) | todo |
| dirt | `ground.js` `STONE` flecks (`n2 < 0.07`), worn plaza and paths | noise flecks | c (seamless tile, trodden dirt and pebbles) | todo |
| void (outside the world) | `world.ex` `:void` | none (fog) | d | keep |

### 7. UI

| Asset | Files | Current | Var | Notes | Status |
|---|---|---|---|---|---|
| resource icons: wood, food, gold | `priv/static/images/ui/{wood,food,gold}.png` | pixel sacks | c | 24 px squares, figure about 20 px tall. `sackLine` still returns the count and `SACK_SPOT`. | **built, awaiting final review** |
| build buttons ×6 | `hud.js` `BUILD_FACE` | icon plus the label | c | Wall, tower, trap, field, and forge are 28 px crops of variant a on each kind's own sheet. The mage tower has no sheet yet (the concept sheet is in the image batch), so its face stays text. | **built, awaiting final review** |
| start-screen title and landscape | `priv/static/images/hd2d/title.png`, `start_screen.ex` | pixel wordmark over the live yard | c | 382×83, black dropped out. The dusk yard stays the backdrop. | **built, awaiting final review** |
| logo, favicon | `priv/static/images/logo.png`, `favicon.ico` | the keep between the words | c | 32 px mark. The favicon holds that square and a 16 px reduction. | **built, awaiting final review** |
| rotate-device icon | inline SVG in `room.html.heex` | SVG | — | Keep | keep |
| floaters, beacons, hint arrows | DOM and CSS | CSS | d | Pixel font later | keep |

### 8. Sky, fog and post (variant d)

`scene.background` from `skyColor`, `THREE.Fog` from 900 to 2400, far pines
(pine-sheet billboards, at most 180), the mist shader (0.28, 0x4e4651 by day,
0x322c3c at night), the hemisphere light, bloom, depth of field and the
height and distance fog in `hd2d/picture.js`. All of these stay procedural.
Everything above stays procedural (status **keep**) except the far pines:

| Asset | Files | Current | Var | Notes | Status |
|---|---|---|---|---|---|
| far pines | `horizon.js` `placeTrees` on `pine` cells, role `far-pine` | pine-sheet billboards, cap 180 | b | Wired: variants a/b, two instanced meshes, alpha-tested (see Far pines (done)). The horizon window is still re-baked from the ground tiles (open question 15). | **built, awaiting final review** |

### 9. Flora and natural barriers

Today all trees are one card (`tree`, section 3) or the far-pine billboards. The
forest wall is two rings of 54 and 62 trees (`scenery.js forestWall`, pine
0x353e27) with gaps at the four cardinals, the outer scenery is three rings
of 24, 24 and 22 (`sceneryForest`, parts stump and log), and the horizon
draws pines on `pine` cells. Rocks, bushes, grass tufts and flowers do not
exist yet; the ground only has noise flecks.

| Asset | Used by | Current | Var | Notes | Status |
|---|---|---|---|---|---|
| pine | forest wall, `pine` biome, far pines (section 8) | `tree` card / cones | b (`"type": "static"`) | `assets/reference/pine/asset.json`: concept box 278,536,392,720 of theme.jpg, world height 40 (the `tree` card's), 110 px at the hero texel; cell 128×120. Variant a the full pine, b a slender pine at 0.85 (94 px). The image model drew a pair of pines twice for b's old note ("a younger, narrower pine", a contrast with a mature tree): the note now describes one tree alone, and `"pick": "right"` keeps the right-hand tree of the committed raw pair `views/b.png` (`hero_sprites.static_pick`), so the build derives b from the raw image. `pine-sheet.png` (256×120) passes every check. Client: `treeSheet`/`treeCard`/`treeVariant` in `yard_cards.js`; render.js draws the yard trees and both forest-wall rings from the sheet by `pineVariant(x, z)` (`phash2` of the cell), foot on the ground. The old `tree` card stays for its propBytes tile only. Review: /workspace/lk/review/pine | **built, awaiting final review** |
| broadleaf tree | yard trees, `meadow` edges | `tree` card | b | S view plus a second shape | **built, awaiting final review** (`broadleaf-sheet.png` replaced. a 110 px, b 94 px. a/b IoU 0.310, under `shape_iou` 0.85. The gate was not loosened. 2 per seed in the forest edge by `flora.js`.) |
| dead or burnt tree | `ruins` biome, night or after a fire | none | b | S view | **built, awaiting final review** (`dead_tree-sheet.png`, 99 px. `flora.js` `deadTreeSlots` takes the next 6 ruins-biome cells after the ruin stones, outside the yard, and `render.js` draws them with their feet on the ruins lift. review /workspace/lk/review/dead_tree/) |
| dense forest barrier | `forestWall` rings | 116 single tree cards | b | A wide strip of interlocking pines (2–3 tileable segments), so the wall reads as one barrier and draws as few quads | **built, not wired** (`forest_barrier-sheet.png`, 272 px cell: a 103×88, b 264×88. The approved pitch is `barrierPitch`, the outer ring at a full pine of 40 world units and 110 px. The strip is new art and is not in this batch. The live wall stays individual pines. Review /workspace/lk/review/forest_barrier/) |
| stump and log | `sceneryForest` parts, felled trees | parts on the tree card | b | Shares the tree palette; ties to the felled-wood card in section 3 | **built, awaiting final review** (`stump_log-sheet.png`: a stump 27×28, b felled log 45×28 (take 3, its own `framing` sentence; takes 1-2 drew stumps); 4 per seed in the forest edge by `flora.js`; review /workspace/lk/review/stump_log/) |
| bushes | yard edge, `meadow` | none | b | 2–3 variants | **built, awaiting final review** (`bush-sheet.png`, 3 variants 38/30/25 px; `"match": "pine"` scales saturation and value to the pine sheet; scattered by `flora.js`; review /workspace/lk/review/bush/) |
| rocks and boulders | `ruins`, `hill`, `cliff` edges; a source look for the quarry | none | b | 3 sizes; the large boulder can block like a cliff cell | **built, awaiting final review** (`rock-sheet.png`, 44/31/22 px: c is small from its scale though its view filled the frame; scattered by `flora.js`; review /workspace/lk/review/rock/) |
| cliff face | `cliff` cells and the cliff skirt (`biomeLift` 16) | the 1024 tile on cliff cells, plus lift | b | Front face strip, tileable; the natural barrier the walk blocking already uses | **wired** (`cliff_face-sheet.png` is 384×56. a stays the 51×44 block, b the 35×44 pillar, c is 44×44. Every static check passed. The horizon samples `cliff_face/views/c.png`, column wrap 129 ≤ interior 169. Not a scatter sprite.) |
| ruin stones | `ruins` biome | `ruin_stones-sheet.png`, lift 8 | b | Stub 55 px, column 30 px, rubble 28 px. `flora.js` `ruinSlots` picks up to 24 ruins-biome cells in the camera window, outside the yard, and `render.js` draws them from the sheet with their feet on the lift. | **built, awaiting final review** |
| grass tufts | yard and `meadow` ground | ground noise | c | 3–4 small decals scattered by seed | **built, awaiting final review** (`grass_tufts-sheet.png`, 14/11/9 px, matched to the pine; 10 per seed by `flora.js`; review /workspace/lk/review/grass_tufts/) |
| flowers | `meadow` ground | none | c | 2–3 small decals | **built, awaiting final review** (`flowers-sheet.png`, 2 variants 16 px; scattered by `flora.js`; review /workspace/lk/review/flowers/) |
| reeds | `river` and `ford` banks | none | c | 2 small decals | **deferred** (`reeds-sheet.png`, 25 and 20 px, stays unwired. A thin-stalk retake waits until the river tiles exist. Review /workspace/lk/review/reeds/) |

### 10. Fauna

Wildlife is client-side decoration with no gameplay, and nothing in `lib`
simulates it (the wolf and the bat are enemies, section 1). `wildlife.js`
scatters the deer. The other animals here are still proposed.

| Asset | Where | Var | Clips / views | Notes | Status |
|---|---|---|---|---|---|
| birds (crows) | over the forest wall and fields by day | a (small) | fly ×8 or ×4, take-off and land | Deferred. Reuse the bat flier later, at about 8 world units. No generation. | deferred |
| deer | `meadow` and `pine` edges outside the yard | a | walk ×8, idle ×4, flee ×8 | Flees from heroes and monsters. The concepts have no animal: `assets/reference/deer/` (monster pipeline, 22 world units = 60 px, 128 cell) takes only the forest palette from a theme.jpg crop and the look from its design text. Idle is the attack slot (grazing). Flee is a new `run` kind held to the walk checks; `CLIP_KINDS` has no `run` yet, so no flee clips were generated. The proposed radius is 60 world units, with no sim change. Grazing gets its own row kind later. The style is accepted. | **wired, awaiting final review** (`deer-sheet.png` 1024×2560, 60 px, foot row 121. `wildlife.js` places 4 deer on `floraBands.edge`, 205–290, off the roads. They walk an arc on that ring and graze; the graze loops the attack rows. Sim time is the server tick, so every client draws the same deer. No `run` clips in this batch.) |
| rabbits | yard edge and fields | a (small) | hop ×8, idle ×4 | Ties to the field (sow and harvest). assets/reference/rabbit: 10 world, 28 px, cell 64; views done (W/E profiles turn slightly three-quarter, accepted); turntable committed | **dropped, walk-NW height gate** (status: dropped. No wrong-facing copy. No check-profile change. Take 5 clip precheck passes: loop 3, start 2, walk median 86. Outlined heights 28, 38, 41, 41, 41, 37, 30, 28, max 41, limit 24–32. The other seven walks stay inside the limit. Unwired. No sheet.) |
| fish or ripples | `river` and `ford` | d | shader ripple | Dropped. A shader ripple stands in for a fish sprite. No generation. | dropped |

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
- For a figure that is not a person standing upright (the wolf):
  - `view_pose`: replaces the views' last sentence ("Whole figure from the
    top of the head to the boots, ... arms relaxed, ..."). Name the height
    only: the wolf's "from its nose to the tip of its tail" turned view-S
    three-quarter twice, so its `view_pose` says the spine points exactly
    along the view direction instead.
  - `view_height` (200 to 520, default 520): the figure height
    `normalize_view` scales every view to. A side-on quadruped is about
    twice as long as it is tall, so at 520 it would overflow the 720 canvas;
    `normalize_view` now refuses any view wider than 640 px (40 px clear on
    each side) instead of cropping it.
  - `items` may be empty: the views then have no items sentence and the
    clips no props line.
  - `flies: true` (a monster only; the bat): the "walk" clips are a
    wingbeat in place ("hovers in place in the air, flapping its wings",
    "Two full wingbeats"), the attack "hangs in the air at the same height"
    instead of "feet stay planted", and the turntable holds the figure in
    the air with its wings frozen ("no flapping" for "no walking").
    `hero_sprites.GROUNDED` and `FLIER` hold the swapped phrases; every
    other figure's prompts are unchanged.
  - `mirror_views` (a monster only, `{"W": "E"}` or `{"E": "W"}`): the
    bat is left-right symmetric and its view-W came out three-quarter
    twice, so `views` builds `v-W.png` as the exact horizontal flip of
    `v-E` and `prompts.json` drops the view-W call (the bat has 24 calls).
    The hermit's view-E faced screen-left on two takes, so it sets
    `{"E": "W"}` and `views` overwrites `v-E.png` with the flip of
    `v-W.png` before it normalizes. The belt pouch changes side. No other
    asset sets it. The flip is deterministic: the views step rebuilds the
    same pixels.
  - In the check profile, `"prop": null` says the figure holds nothing. The
    monster checks then skip only the prop checks; `prop_dirs` and
    `prop_side_below` are refused with it, and a hero cannot have it.

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

## Wolf: how to run it

Same steps as the goblin below, with `wolf` for `goblin`. Calls:
`assets/reference/wolf/prompts.json` (25 calls: 4 views, 1 turntable, 8
walk, 8 attack and 4 death clips). The views normalize to 300 px
(`view_height`), so `views` refuses a view wider than about 2.1 times its
height: regenerate it with the tail held closer. The `check` profile is
written after `dirs`, tuned on the eight start poses like the skeleton's,
with `"prop": null` (see its `_note`). Retakes go in `clip_overrides`, as
for the skeleton; `prompts.json` says what was sent.

## Bat: how to run it

Same steps as the goblin below, with `bat` for `goblin`. Calls:
`assets/reference/bat/prompts.json` (24 calls: 3 views, 1 turntable, 8
walk, 8 attack and 4 death clips; `views` mirrors v-E into v-W). The views normalize to 240 px
(`view_height`), so `views` refuses a view more than about 2.7 times as wide
as it is tall. The build and checks treat it as a flier (see "Fliers");
the check profile in `asset.json` is a draft tuned on the start poses.

## Troll: how to run it

Same steps as the goblin below, with `troll` for `goblin`. Calls:
`assets/reference/troll/prompts.json` (25 calls: 4 views, 1 turntable, 8
walk, 8 attack and 4 death clips). The views normalize to the default
height; the club stays in full view in every view. The `check` profile
(green skin, brown leather, the club as the prop) is written after `dirs`,
tuned on the eight start poses like the skeleton's.

## Fliers

A monster with `"flies": true` (the bat) hangs in the air, so the walk
checks that hold a figure on its feet cannot hold it: a wingbeat sweeps
the wings far past the walk height ±4 px, and on the downstroke the wings
are the lowest pixel, so the "one foot line" would follow the wings. A
flier gets its own anchor and checks in their place; no existing limit is
loosened, and every figure on its feet runs exactly the checks it did.

- Cell: the foot line is `FLIER_FOOT_MARGIN` (24) rows over the cell
  bottom, not 8: walk and attack hold frame 0's foot line and the
  downstroke sweeps the wings below it.
- Build (`sprite_from_video.monster_anchor`, `Spec.flies`): walk and attack
  keep frame 0's torso x and foot line for every frame, like a locked
  camera, so the body stays where the clip has it (the precheck loop and
  start checks catch a drift). Death keeps frame 0's x and puts each
  frame's own lowest pixel on the foot line, so the fall stays inside the
  cell; the drop itself is the client's lift.
- Checks (`check_sprite_sheet.run_monster_checks`), replacing the walk
  height, the walk foot line, the attack feet and the walk legs:
  - `flier start pose on the foot line`: walk frame 0 of every column on
    the foot line ±1.
  - `walk/attack hovers at the start height ±N px` (`HOVER_BOB` 0.3 × the
    figure height, 13 px for the bat): the body core keeps its mean row
    within N px of the start pose's. The core is the largest piece left
    after opening the silhouette with a square 0.3 × the figure height
    (smaller squares down to 3 px if that leaves nothing, so a thin side
    view keeps its body), which drops the wings, ears and feet. On side
    views the core still carries the wing roots: the bat's take-1 W and E
    walks, whose body visibly holds still, measure up to 12 px, so the
    limit is 0.3 × H; the walks that really bob (S, SW, NW: 28 to 30 px)
    and the bites that swoop up (15 to 36 px) still fail.
  - `walk <D> wings beat`: the whole silhouette changes by at least the
    legs floor every step, and frame 0 against the walk frame most unlike
    it by at least `WINGBEAT` (150 px at the hero's 88 px, by area; 38 at
    44 px). The 8 frames may hold one wingbeat or two (walk-NE take 1 is
    48 frames, two beats), so it is a sweep, not half a cycle.
  - Unchanged: start frames, death feet ±3, death ends on the ground, the
    palette, outline, cell border, front and back views, 8 distinct
    directions, attack strikes.
- Client: `flierLift(lift, pose, now, deathFrames)` in `pictures.js`
  holds the lift while it lives; in death frame 0 still hovers, then it
  falls ever faster (t²) and lands as the last death frame starts.
  `render.js` gives only the bat `lift` 22 and a contact disc that
  `placeMesh` holds on the ground under it.

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


**Far pines (done):** horizon.js `placeTrees` draws the picture's pine cells as pine-sheet quads (variants a/b by hash, two instanced meshes, cap 180, alpha-tested, facing the camera when placed). 360 triangles at the cap instead of 720 for the cones; one more draw call (2 instead of 1); the matrices are rebuilt only when the camera changes chunk.
