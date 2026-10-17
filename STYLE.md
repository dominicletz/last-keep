# Style

Last Keep is low-poly 3D drawn as chunky pixels. The reference sheets are `docs/concept/heroes.jpg`, `docs/concept/monsters.jpg`, and `docs/concept/theme.jpg`.

Each hex below is the jpeg-js per-channel lower median of an 8×8 patch on that sheet. Sort the channel and take index `(length - 1) >> 1`. A token that does not cite its sheet and region fails. A cited hex that does not match that median fails. Do not copy a color from a builder and call it the palette. The builders name these tokens.

## Palette

A model spec names a token. It does not paste a fresh hex. Lighting may darken a pixel in the gallery. The check reads the material color on the spec, before light, and the tolerance is zero.

| token | hex | sheet | region | use |
| --- | --- | --- | --- | --- |
| steel | #d8cfc3 | heroes.jpg | 238,264,8,8 | blades, helms, and goggles |
| skin | #d99b64 | heroes.jpg | 184,238,8,8 | faces |
| shield | #38516f | heroes.jpg | 232,346,8,8 | warrior shield |
| robe | #3e6dab | heroes.jpg | 468,278,8,8 | mage robe and spell light |
| gold | #d99e66 | heroes.jpg | 410,250,8,8 | warm metal |
| gem | #23d9f3 | heroes.jpg | 322,168,8,8 | mage gem |
| hood | #88a05b | heroes.jpg | 594,196,8,8 | scout cloak |
| straw | #e5b268 | heroes.jpg | 848,162,8,8 | farmer hat |
| denim | #3a4a60 | heroes.jpg | 836,332,8,8 | farmer tunic |
| cloth | #e6ccad | heroes.jpg | 904,274,8,8 | engineer shirt |
| apron | #4c3d27 | heroes.jpg | 1120,458,8,8 | aprons and warrior legs |
| wood | #8e755b | heroes.jpg | 1180,344,8,8 | hafts, bows, and pine trunks |
| leather | #261e0e | heroes.jpg | 640,400,8,8 | boots |
| goblin | #676f3c | monsters.jpg | 194,444,8,8 | goblin hide |
| bone | #908b8a | monsters.jpg | 400,388,8,8 | skeleton |
| ogre | #70724d | monsters.jpg | 672,344,8,8 | ogre |
| wolf | #6e6767 | monsters.jpg | 894,500,8,8 | wolf |
| hide | #4d433b | monsters.jpg | 524,148,8,8 | bat hide and scenery trunk |
| rider | #4a464c | monsters.jpg | 1072,396,8,8 | dark rider and plate |
| veil | #3a264d | monsters.jpg | 1226,508,8,8 | rider horns |
| torch | #f5751e | monsters.jpg | 34,404,8,8 | torch and lit house |
| dusk | #5d505b | theme.jpg | 316,16,8,8 | dusk sky and mage hat |
| sunset | #e58e54 | theme.jpg | 936,36,8,8 | sunset |
| soil | #080c0e | theme.jpg | 170,86,8,8 | concept slot ground |
| pine | #353e27 | theme.jpg | 54,600,8,8 | pine crown and scout legs |
| stone | #554034 | theme.jpg | 636,124,8,8 | keep and tower stone |
| thatch | #43382e | theme.jpg | 660,230,8,8 | keep roof |
| wheat | #976122 | theme.jpg | 872,364,8,8 | crop field |
| grass | #292b10 | theme.jpg | 460,374,8,8 | ground |
| path | #5e4529 | theme.jpg | 610,400,8,8 | dirt path |
| palisade | #795237 | theme.jpg | 390,458,8,8 | palisade and keep door |
| flame | #eea821 | theme.jpg | 658,172,8,8 | brazier and window |

## Kinds

Every Rules hero, every monster the simulation spawns, every building, and the yard props have one row. The figure names the concept crop. The sheet has to be one of the three files above. The crop is `x,y,w,h` on that 1280×720 sheet.

| id | family | sheet | figure | crop |
| --- | --- | --- | --- | --- |
| warrior | hero | heroes.jpg | warrior | 24,158,268,412 |
| mage | hero | heroes.jpg | mage | 312,124,196,448 |
| scout | hero | heroes.jpg | scout | 524,100,216,480 |
| farmer | hero | heroes.jpg | farmer | 752,98,250,480 |
| engineer | hero | heroes.jpg | engineer | 1016,158,224,432 |
| goblin | monster | monsters.jpg | goblin | 16,328,236,246 |
| skeleton | monster | monsters.jpg | skeleton | 260,328,260,246 |
| wolf | monster | monsters.jpg | wolf | 760,340,270,245 |
| troll | monster | monsters.jpg | ogre | 524,292,226,286 |
| boss | monster | monsters.jpg | dark rider | 1000,70,275,520 |
| wall | building | theme.jpg | palisade | 160,280,250,220 |
| tower | building | theme.jpg | stone tower | 590,36,120,130 |
| trap | building | theme.jpg | ground torch | 520,490,100,90 |
| field | building | theme.jpg | wheat | 740,300,250,140 |
| forge | building | theme.jpg | lit house | 500,190,200,150 |
| mage_tower | building | theme.jpg | spell light | 470,330,160,140 |
| keep | prop | theme.jpg | keep | 548,28,188,230 |
| tree | prop | theme.jpg | pine | 0,500,180,210 |
| scenery | prop | theme.jpg | pine trunk | 1080,160,180,260 |

## Asset loop

The theming round starts with this loop. It does not start by sculpting the town.

1. Generate. Every model is data under `assets/models/`. Colors are palette tokens. `npm run models` builds the registry. The registry maps each kind from `Rules.heroes/0`, each monster kind, each building kind, and each yard prop to one model. The command is deterministic. A second run on the same spec produces the same bytes.
2. Render. The same command writes a gallery. Each asset gets a contact sheet at game zoom through the low-res pixel path, under day, dusk, and night light, in `artifacts/gallery/`. CI uploads that folder. `docs/gallery.html` browses the same frames, stored as goldens in `test/gallery/`. Hero portrait cards are the dusk crop of these renders.
3. Verify. `.agents/skills/verify-assets/SKILL.md` is the check. An asset must render, use only palette tokens, keep a readable silhouette at game zoom, stay distinct from the other kinds in its family, and fit its gameplay collider. The fit slack is 2. Two kinds in one family fail when their silhouette intersection-over-union is at or above 0.85. Every Rules kind needs a model, a row in the table above, and a concept mapping. The pixel threshold is 0. A pixel diff past that threshold fails. An intentional change updates the golden in that pull request and puts the before and after in the pull request body.
4. Review. For each asset, the fourth panel is the concept crop for that figure, letterboxed on the soil ground. `docs/gallery.html` links that crop. When the sheet file is missing, the slot stays empty and says so. Reviewers score fidelity from 1 to 5 in `playtests/BACKLOG.md` under Fidelity. A later score may be lower only when the row has a reason. `fidelity.test.js` enforces that. Do not delete an old row to hide a drop.
5. Regenerate. The next pass edits the spec, runs `npm run models`, and re-scores. It does not paint over the gallery by hand.

Game zoom is a 1280 by 800 window at town rank 0, the same frustum `frameFor` uses in the client. The gallery raster is the low-res buffer, three pixels of CSS per texel. Day, dusk, and night are lighting passes on top of the spec color. Night is darker than dusk, and dusk is darker than day. The night pass adds a warm point where the keep torch sits.

Do not merge a model that skipped a step.
