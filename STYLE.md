# Style

Last Keep is low-poly 3D drawn as chunky pixels. The reference sheets are `docs/concept/lk_heroes.jpg`, `docs/concept/lk_theme.jpg`, and `docs/concept/lk_monsters.jpg`. Those files are not in the repo. Do not invent a substitute sheet.

The hex values below are the colors the current builders already use. They were not sampled from the concept sheets. The style pass replaces this table from the sheets when the files are here. Do not treat this table as the concept palette.

## Palette

A model spec names a token. It does not paste a fresh hex. Lighting may darken a pixel in the gallery. The check reads the material color on the spec, before light, and the tolerance is zero.

| token | hex | use |
| --- | --- | --- |
| boot | #3a342c | warrior boots |
| cloth | #4a4038 | legs |
| mail | #8e99a6 | warrior torso |
| pauldron | #6e7580 | shoulders |
| skin | #f0d2b0 | faces |
| helm | #b0b6be | warrior helm |
| roof | #8a3d2f | shield and keep roof |
| steel | #d8d2c4 | blades and goggles |
| hem | #1d3558 | mage hem |
| robe | #2c4f86 | mage robe |
| hat | #1a2744 | mage hat |
| wood | #6b4228 | hafts, bows, and walls |
| gem | #7ec8ff | mage gem |
| mosscloth | #243628 | scout legs |
| cloak | #1c3a24 | scout cloak |
| hood | #14281c | scout hood |
| bootdark | #3a3028 | engineer boots |
| leather | #8a5a32 | engineer torso |
| apron | #c4a574 | engineer apron |
| satchel | #5a4030 | engineer satchel |
| fieldcloth | #5a6a32 | farmer legs |
| tunic | #c4a15a | farmer tunic |
| straw | #d6b25a | farmer brim |
| strawband | #c6a04a | farmer crown |
| goblin | #ff3a22 | goblin hide |
| bone | #e8e0d0 | skeleton |
| wolf | #2c3344 | wolf |
| troll | #2f6a32 | troll |
| boss | #6a3a8a | boss |
| stone | #6e675c | tower and keep base |
| trap | #8a8174 | trap |
| wheat | #c6b04a | field |
| forge | #a84828 | forge |
| spire | #3a4f86 | mage tower |
| flame | #ffb15a | torch and window |
| keepstone | #7d756a | keep tower |
| door | #3a2418 | keep door |
| bark | #5a3a22 | harvestable trunk |
| pine | #2f6a3c | harvestable crown |
| dead | #8a8078 | scenery trunk |

## Kinds

Every Rules hero, every monster the simulation spawns, every building, and the yard props have one row. The figure names the concept crop. The sheet has to be one of the three files above.

| id | family | sheet | figure |
| --- | --- | --- | --- |
| warrior | hero | lk_heroes.jpg | warrior |
| mage | hero | lk_heroes.jpg | mage |
| scout | hero | lk_heroes.jpg | scout |
| farmer | hero | lk_heroes.jpg | farmer |
| engineer | hero | lk_heroes.jpg | engineer |
| goblin | monster | lk_monsters.jpg | goblin |
| skeleton | monster | lk_monsters.jpg | skeleton |
| wolf | monster | lk_monsters.jpg | wolf |
| troll | monster | lk_monsters.jpg | troll |
| boss | monster | lk_monsters.jpg | boss |
| wall | building | lk_theme.jpg | wall |
| tower | building | lk_theme.jpg | tower |
| trap | building | lk_theme.jpg | trap |
| field | building | lk_theme.jpg | field |
| forge | building | lk_theme.jpg | forge |
| mage_tower | building | lk_theme.jpg | mage tower |
| keep | prop | lk_theme.jpg | keep |
| tree | prop | lk_theme.jpg | harvestable tree |
| scenery | prop | lk_theme.jpg | scenery trunk |

## Asset loop

The theming round starts with this loop. It does not start by sculpting the town.

1. Generate. Every model is data under `assets/models/`. Colors are palette tokens. `npm run models` builds the registry. The registry maps each kind from `Rules.heroes/0`, each monster kind, each building kind, and each yard prop to one model. The command is deterministic. A second run on the same spec produces the same bytes.
2. Render. The same command writes a gallery. Each asset gets a contact sheet at game zoom through the low-res pixel path, under day, dusk, and night light, in `artifacts/gallery/`. CI uploads that folder. `docs/gallery.html` browses the same frames, stored as goldens in `test/gallery/`. Hero portrait cards are the dusk crop of these renders.
3. Verify. `.agents/skills/verify-assets/SKILL.md` is the check. An asset must render, use only palette tokens, keep a readable silhouette at game zoom, stay distinct from the other kinds in its family, and fit its gameplay collider. The fit slack is 2. Two kinds in one family fail when their silhouette intersection-over-union is at or above 0.85. Every Rules kind needs a model, a row in the table above, and a concept mapping. The pixel threshold is 0. A pixel diff past that threshold fails. An intentional change updates the golden in that pull request and puts the before and after in the pull request body.
4. Review. For each asset, the sheet places the concept crop beside the in-game render. When the sheet file is missing, the slot stays empty and says so. Reviewers score fidelity from 1 to 5 in `playtests/BACKLOG.md` under Fidelity. A later score may be lower only when the row has a reason. `fidelity.test.js` enforces that. Do not delete an old row to hide a drop.
5. Regenerate. The next pass edits the spec, runs `npm run models`, and re-scores. It does not paint over the gallery by hand.

Game zoom is a 1280 by 800 window at town rank 0, the same frustum `frameFor` uses in the client. The gallery raster is the low-res buffer, three pixels of CSS per texel. Day, dusk, and night are lighting passes on top of the spec color. Night is darker than dusk, and dusk is darker than day. The night pass adds a warm point where the keep torch sits.

Do not merge a model that skipped a step.
