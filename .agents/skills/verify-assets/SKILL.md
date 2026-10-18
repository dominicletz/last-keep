---
name: verify-assets
description: "Check Last Keep models against STYLE.md: palette tokens, silhouette at game zoom, collider fit, concept mapping, and golden gallery frames. Use when a model spec or the gallery changes. npm run models is the check."
disable-model-invocation: true
---

# Verify assets

`STYLE.md` is the loop. This skill is the check. Do not treat a hand-exported PNG as a pass.

## Generate

From the repo root:

```sh
npm run models
```

That command reads `assets/models/` and the registry. It must be deterministic. It renders twice and diffs the bytes. A difference is a failure. `npm test --prefix assets` runs the same check.

The registry covers every hero from `Rules.heroes/0`, every monster kind the simulation spawns, every building kind, and the props the yard draws (keep, harvestable tree, scenery trunk). A kind with no model fails. A model with no kind fails.

## Render

Each asset writes a contact sheet at game zoom through the pixel path, in day, dusk, and night light, under `artifacts/gallery/<id>/`. Heroes and monsters also write a close-up about 80px tall and a `compare.png` beside the concept crop. Portrait cards are that close-up. `docs/gallery.html` links the committed frames in `test/gallery/`. CI uploads `artifacts/gallery/` as an artifact.

A side-by-side frame places the concept crop from `docs/concept/` next to the in-game render. The concept files are `heroes.jpg`, `monsters.jpg`, and `theme.jpg`. The last panel is that crop, nearest-neighbor and letterboxed. Heroes and monsters insert a close-up before it, and `compare.png` shows the close-up beside the crop at the same height. `docs/gallery.html` links `concept.png`. If a sheet is not in the repo, the slot stays empty and the page says so. Do not invent a substitute. A mapping that names any other file fails.

Every palette token cites one of those sheets and an `x,y,w,h` region. The hex has to equal the jpeg-js lower median of that patch. A token with no citation, a region outside the sheet, or a hex that is not that median fails. A hand-exported PNG is still not a pass.

## Checks

All of these fail the command:

- The render throws or the sheet is empty.
- A material color is not a `STYLE.md` palette token. Tolerance is zero on the spec, before lighting.
- The keep body's dominant color is more than 18 from the stone token sampled in the belfry crop, the body uses fewer than three tones, or the roof is not thatch. The live keep reports those masonry colors.
- A palette token does not cite `heroes.jpg`, `monsters.jpg`, or `theme.jpg` and a region, or the jpeg-js median of that region is not the cited hex.
- The grass token is farther than 18 from the concept moss, or closer to the thatch roof than to that moss. The day gallery background is not the concept sky median. A dusk or night background whose mix is more than 0.04 from that sky, or closer to the roof than to the sky, fails. The plaza fill has to be the grass token. A plaza painted with the path token fails.
- A building with a flame or torch is unreadable at night. The keep's brightest pixel is below luma 80, it has fewer than 8 warm pixels, or its silhouette does not sit at least 4 luma above the night sky. Other lit buildings have a lower floor.
- At game zoom the silhouette is empty or its pixel area is below the minimum recorded for that kind. The recorded minimum also has to stay at least half the measured area.
- A hero's day-raster height at 1280×800 is under 56 internal pixels at town rank 0 or at town rank 4. The floor also has to stay at least half the shortest measured height.
- A hero's signature tokens are missing at fight zoom. `heroZoomProblems` counts them on the day, dusk, and night rasters at rank 0 and rank 4: warrior steel, blue shield, and gold; mage deep blue, gold, and the staff gem; scout forest and the bow's wood; farmer straw, denim, and the fork's wood; engineer leather and the hammer's steel. A recorded count under half the smallest measured count fails. A farmer straw hat wider than 0.4 of the fight-zoom body fails. `heroFeatureProblems` fails a warrior with no visor slit, a rectangular shield, no gold cross, or a plank sword, a mage hat that does not come to a point, and a scout whose hood misses the head. `heroHueProblems` fails when steel saturates past 0.3 or the shield, robe, hood, and denim leave their hues at dusk or night.
- A hero or monster close-up is missing, its figure is outside 64–96 internal pixels, or its portrait is not that close-up.
- A hero or monster is below the voxel detail floor of 12. The count is the voxel grid when the model has one, otherwise the part count. Three boxes fail. The house and the field meet that floor. Other buildings stay exempt.
- A hero's dominant close-up colors are outside the colors that occupy that hero's concept crop. A brown warrior plate fails this. The day light stays neutral so grey plate is not clipped to orange.
- A Rules monster has no gallery model. The six are goblin, skeleton, wolf, troll (the ogre), bat, and boss (the dark rider).
- The bat or the dark rider night frame has fewer pixels at or above the live night grass than the recorded read (bat 80, rider 1000), or that record is under half the measured count. Hide wings fail it. Plate and bone clear it.
- Two kinds in the same family have a silhouette intersection-over-union at or above 0.85. They must read as different bodies.
- The mesh bounds do not fit the gameplay collider for that kind. The fit slack is 2.
- A Rules kind has no model, no `STYLE.md` entry, or no concept mapping.
- A gallery frame differs from its golden in `test/gallery/` by more than the recorded pixel threshold. The pixel threshold is 0.

An intentional look change updates the golden in the same pull request:

```sh
npm run models -- --write-golden
```

The pull request body shows the before and after. A golden update without that pair is a failure. The first gallery has no before.

## Fidelity

Reviewers score 1 to 5 in `playtests/BACKLOG.md` under Fidelity. `npm test --prefix assets` runs `fidelity.test.js`. A score that drops without a reason fails. Do not delete an old row to hide a drop. The round-5 rows are the baseline.
