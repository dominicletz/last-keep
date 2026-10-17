# Style

Last Keep is low-poly 3D drawn as chunky pixels, in the spirit of Kingdom Two Crowns. The reference sheets Dominic supplied are `docs/concept/lk_heroes.jpg` (the five heroes), `docs/concept/lk_theme.jpg` (the town at dusk), and `docs/concept/lk_monsters.jpg` (the monster line). The theming round's first pull request adds those files before anyone scores fidelity. Do not invent a substitute sheet.

## Palette

New model specs name a token. They do not paste a fresh hex. Lighting may darken a pixel in the gallery; the check reads the material color on the spec, before light.

| token | hex | use |
| --- | --- | --- |
| ink | `#f3e6cf` | text on panels |
| gold | `#e2b15a` | selection, coins, the build ring |
| blood | `#c84b3a` | damage, goblin cloth |
| moss | `#7ea35a` | health, grass highlight |
| soil | `#1a140f` | empty night |
| dusk | `#140e12` | page behind the yard |
| line | `#6a4a30` | panel edge |
| wood | `#6b4228` | logs, bows, hafts |
| dirt | `#8d6844` | the town disc |
| grass | `#4f7a3a` | the ground |
| stone | `#6e675c` | keep and walls |
| roof | `#8a3d2f` | keep roof |
| skin | `#f0d2b0` | faces |
| fog | `#8a4030` | the distance |

A spec color must match a token within zero distance before lighting. The verification skill rejects a material that is not in this table.

## UI principles

Four kinds of interface. Diegetic by default.

- Diegetic. The thing is in the world and the hero could see it. A sack of coins, a woodpile, cracks in the keep, the sky getting dark.
- Spatial. A marker drawn in the world because a number would be worse. The build-range ring, the placement ghost, an offscreen wave call, a hero's name on the figure.
- Meta. A rare overlay on the screen that is still about the body. A low-health vignette. Use it sparingly.
- Non-diegetic. Text and controls that cannot live in the world. The invite link, mute and volume, and the fallen-keep score. Nothing else gets a new slot.

`assets/js/ui.js` lists the non-diegetic slots that exist today. `ui.test.js` fails if that list grows. `twoPlayerNight` fails if the live HUD shows a slot that is not on the list. When a slot moves into the world, delete it from the list in the same change. Do not add one to make room.

## Asset loop

The theming round starts with the pipeline. It does not start by sculpting the town. The order is fixed.

1. Generate. Every model is code or data under `assets/models/`: a procedural builder or a voxel spec. Colors are palette tokens. `npm run models` builds the registry. The registry maps each kind from `Rules.heroes/0`, each monster kind, each building kind, and each prop to one model. The command is deterministic. A second run on the same spec produces the same bytes.
2. Render. The same command writes a gallery. Each asset gets a contact sheet at game zoom through the low-res pixel path, under day, dusk, and night light, in `artifacts/gallery/`. CI uploads that folder. `docs/gallery.html` browses the same frames. Hero portrait cards are crops of these renders, not a separate drawing.
3. Verify. `.agents/skills/verify-assets/SKILL.md` is the check. An asset must render, use only palette tokens, keep a readable silhouette at game zoom, stay distinct from the other kinds, and fit its gameplay collider. Every Rules kind needs a model, a line in this file, and a concept mapping. Golden gallery frames live in the repo. A pixel diff past the threshold fails. An intentional change updates the golden in that pull request and puts the before and after in the pull request body.
4. Review. For each asset, a sheet places the concept crop beside the in-game render. Graphics and Character design score fidelity from 1 to 5. Findings go to `playtests/BACKLOG.md` tagged with the asset id. Scores are appended to the Fidelity table there. A later score may be lower only when the row has a reason. `fidelity.test.js` enforces that.
5. Regenerate. The next pass edits the spec, runs `npm run models`, and re-scores. It does not paint over the gallery by hand.

Do not merge a model that skipped a step.
