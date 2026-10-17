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

Each asset writes a contact sheet at game zoom through the pixel path, in day, dusk, and night light, under `artifacts/gallery/<id>/`. `docs/gallery.html` links the committed frames in `test/gallery/`. Hero portraits are the dusk crop of the hero sheets. CI uploads `artifacts/gallery/` as an artifact.

A side-by-side frame places the concept crop from `docs/concept/` next to the in-game render. The concept files are `lk_heroes.jpg`, `lk_theme.jpg`, and `lk_monsters.jpg`. If a sheet is not in the repo, the slot stays empty and the page says so. Do not invent a substitute. A mapping that names any other file fails.

## Checks

All of these fail the command:

- The render throws or the sheet is empty.
- A material color is not a `STYLE.md` palette token. Tolerance is zero on the spec, before lighting.
- At game zoom the silhouette is empty or its pixel area is below the minimum recorded for that kind. The recorded minimum also has to stay at least half the measured area.
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
