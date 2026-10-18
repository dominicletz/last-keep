# Style

Last Keep is low-poly 3D drawn as chunky pixels. The reference sheets are `docs/concept/heroes.jpg`, `docs/concept/monsters.jpg`, and `docs/concept/theme.jpg`.

Each hex below is the jpeg-js per-channel lower median of an 8×8 patch on that sheet. Sort the channel and take index `(length - 1) >> 1`. A token that does not cite its sheet and region fails. A cited hex that does not match that median fails. Do not copy a color from a builder and call it the palette. The builders name these tokens.

## Palette

A model spec names a token. It does not paste a fresh hex. Lighting may darken a pixel in the gallery. The check reads the material color on the spec, before light, and the tolerance is zero.

| token | hex | sheet | region | use |
| --- | --- | --- | --- | --- |
| steel | #d8cfc3 | heroes.jpg | 238,264,8,8 | blades, helms, and goggles |
| armor | #b5afaa | heroes.jpg | 184,186,8,8 | warrior plate |
| deep | #142a48 | heroes.jpg | 465,187,8,8 | mage robe |
| forest | #374a26 | heroes.jpg | 626,346,8,8 | scout cloak |
| skin | #d99b64 | heroes.jpg | 184,238,8,8 | faces |
| shield | #38516f | heroes.jpg | 232,346,8,8 | warrior shield |
| robe | #3e6dab | heroes.jpg | 468,278,8,8 | mage robe and spell light |
| gold | #d99e66 | heroes.jpg | 410,250,8,8 | warm metal |
| gem | #23d9f3 | heroes.jpg | 322,168,8,8 | mage gem |
| hood | #88a05b | heroes.jpg | 594,196,8,8 | scout cloak |
| straw | #e5b268 | heroes.jpg | 848,162,8,8 | farmer hat |
| denim | #3a4a60 | heroes.jpg | 836,332,8,8 | farmer tunic |
| cloth | #e6ccad | heroes.jpg | 904,274,8,8 | engineer shirt |
| apron | #4c3d27 | heroes.jpg | 1120,458,8,8 | aprons |
| jerkin | #472a17 | heroes.jpg | 1106,332,8,8 | engineer leather |
| wood | #8e755b | heroes.jpg | 1180,344,8,8 | hafts, bows, pine trunks, and felled logs |
| leather | #261e0e | heroes.jpg | 640,400,8,8 | boots |
| goblin | #676f3c | monsters.jpg | 194,444,8,8 | goblin hide |
| bone | #908b8a | monsters.jpg | 400,388,8,8 | skeleton |
| rib | #b2ada6 | monsters.jpg | 388,460,4,4 | skeleton ribs |
| ogre | #70724d | monsters.jpg | 672,344,8,8 | ogre |
| wolf | #6e6767 | monsters.jpg | 894,500,8,8 | wolf |
| hide | #4d433b | monsters.jpg | 524,148,8,8 | bat hide |
| rider | #4a464c | monsters.jpg | 1072,396,8,8 | dark rider and plate |
| veil | #3a264d | monsters.jpg | 1226,508,8,8 | rider horns |
| torch | #f5751e | monsters.jpg | 34,404,8,8 | torch and lit house |
| dusk | #5d505b | theme.jpg | 316,16,8,8 | dusk sky and mage hat |
| sunset | #e58e54 | theme.jpg | 936,36,8,8 | sunset |
| soil | #080c0e | theme.jpg | 170,86,8,8 | concept slot ground |
| pine | #353e27 | theme.jpg | 54,600,8,8 | pine crown and scout legs |
| stone | #4b3c33 | theme.jpg | 648,120,8,8 | keep and tower stone |
| course | #654e41 | theme.jpg | 672,143,8,8 | keep masonry course |
| joint | #2c2a2a | theme.jpg | 682,101,8,8 | keep mortar joint |

The old stone patch at 636,124 was a brown shaft course, `#554034`. The stone token is now the lit belfry block. Course and joint are the greyer block and the mortar beside it, both inside the keep crop. The keep roof stays thatch. The check fails when the keep body's dominant color is more than 18 from this stone, or when the body is fewer than three tones.
| thatch | #43382e | theme.jpg | 660,230,8,8 | keep roof |
| wheat | #976122 | theme.jpg | 872,364,8,8 | crop field |
| grass | #5c642f | theme.jpg | 366,314,4,4 | ground |
| moss | #374115 | theme.jpg | 648,408,8,8 | pine shadow |
| path | #5e4529 | theme.jpg | 610,400,8,8 | dirt path |
| palisade | #795237 | theme.jpg | 390,458,8,8 | palisade and keep door |
| flame | #eea821 | theme.jpg | 658,172,8,8 | brazier and window |

## Scene

The yard ground is the grass token, sampled from the lit clearing. The shadow moss at 648,408 (`#374115`) is dark olive: its luminance is under 90, and a day field lit from it fails. Day light stays on the neutral rig so grey plate is not clipped, and there is no green ground lamp. A flat lime field fails even when one patch sits near a moss hue. The near ground also fails when its block spread is under 8, which is how a flat plaza passed the whole frame. Dusk ambient is neutral and dim, so stone, wood, and plate keep their own colors. The clear color stays the violet sky at 24,0. Warmth is the horizon band, the braziers, and the windows, not a violet wash. The horizon stays the orange band on the sheet. It is not the dusk sky and it is not the near field. Gallery backgrounds stay shades of the violet sky, not the thatch roof. The check fails when the grass token is closer to the roof than to this clearing, when a whole frame is a flat tint, or when a gallery background's mix is not this sky.

| role | sheet | region |
| --- | --- | --- |
| ground | theme.jpg | 366,314,4,4 |
| sky | theme.jpg | 24,0,8,8 |
| horizon | theme.jpg | 1008,36,16,8 |

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
| bat | monster | monsters.jpg | bat | 408,68,260,96 |
| boss | monster | monsters.jpg | dark rider | 1000,70,275,520 |
| wall | building | theme.jpg | palisade | 160,280,250,220 |
| tower | building | theme.jpg | stone tower | 590,36,120,130 |
| trap | building | theme.jpg | ground torch | 520,490,100,90 |
| field | building | theme.jpg | wheat | 740,300,250,140 |
| forge | building | theme.jpg | lit house | 500,190,200,150 |
| mage_tower | building | theme.jpg | spell light | 470,330,160,140 |
| keep | prop | theme.jpg | keep | 548,28,188,230 |
| tree | prop | theme.jpg | pine | 0,500,180,210 |
| scenery | prop | theme.jpg | felled wood | 1080,160,180,260 |
| house | town | theme.jpg | cottage | 500,150,180,160 |

## Asset loop

The theming round starts with this loop. It does not start by sculpting the town.

1. Generate. Every model is data under `assets/models/`. Colors are palette tokens. `npm run models` builds the registry. The registry maps each kind from `Rules.heroes/0`, each monster kind, each building kind, and each yard prop to one model. The command is deterministic. A second run on the same spec produces the same bytes.
2. Render. The same command writes a gallery. Each asset gets a contact sheet at game zoom through the low-res pixel path, under day, dusk, and night light, in `artifacts/gallery/`. CI uploads that folder. `docs/gallery.html` browses the same frames, stored as goldens in `test/gallery/`. Heroes and monsters also get a close-up. Portrait cards are that close-up, not a crop of the game-zoom frame.
3. Verify. `.agents/skills/verify-assets/SKILL.md` is the check. An asset must render, use only palette tokens, keep a readable silhouette at game zoom, stay distinct from the other kinds in its family, and fit its gameplay collider. The fit slack is 2. Two kinds in one family fail when their silhouette intersection-over-union is at or above 0.85. Every Rules kind needs a model, a row in the table above, and a concept mapping. The pixel threshold is 0. A pixel diff past that threshold fails. An intentional change updates the golden in that pull request and puts the before and after in the pull request body. A monster is a voxel grid meshed into boxes. A hero is a camera-facing card cut from its crop. The voxel detail floor is 12. A model of three boxes fails that floor. A hero card counts its opaque pixels toward that floor. The house and the field meet that floor. Other buildings stay exempt.
4. Review. The last panel is the concept crop for that figure, letterboxed on the soil ground. Heroes and monsters put a close-up panel before it. `docs/gallery.html` links that crop. When the sheet file is missing, the slot stays empty and says so. Reviewers score fidelity from 1 to 5 in `playtests/BACKLOG.md` under Fidelity. A later score may be lower only when the row has a reason. `fidelity.test.js` enforces that. Do not delete an old row to hide a drop.
5. Regenerate. The next pass edits the spec, runs `npm run models`, and re-scores. It does not paint over the gallery by hand.

Game zoom is a 1280 by 800 window at town rank 0, the same frustum `frameFor` uses in the client. The gallery raster is the low-res buffer, two pixels of CSS per texel, so that window is 640 by 400. Day, dusk, and night are lighting passes on top of the spec color. Night is darker than dusk, and dusk is darker than day. The night pass adds a warm point where the keep torch sits.

## Figure size

`pixelSize` is 2. It used to be 3, which made the same window 427 by 267. At that buffer the engineer was 32 internal pixels tall at rank 0 and about 22 at rank 4, and a prop two units thick was under a texel. Two CSS pixels per texel is still a nearest-neighbor chunk. The yard frustum is the same, so raising the keep still pulls the camera back.

The bat and the dark rider are crop cards. On the night yard the bone token still clears the grass by 18 luma and the hide token sits under it. The rider cloth token stays under that grass. A night-frame pixel at or above the live night grass is the read: the bat record is 16 and the rider record is 48, and each record stays at least half the measured count. The voxel meshes were the oversized night read of 80 and 1000. The cards sit under the hero, and the troll and the rider stay under 1.75 keep doors.

A hero is a camera-facing card cut from its crop on `heroes.jpg`. World height is 32, staff and fork included. The keep door is 20, the palisade post is 40, and the keep top at rank 0 is 165. A card taller than 1.75 doors, 1.05 posts, or 0.42 of the keep fails, and so does a height that leaves 32. The five cards stand on the join ring. Their ground disks do not meet, and on the player camera none of them covers the door or the tower. The mage and the engineer share a view ray, so a screen-box test of that pair would force the card under the door. The day-raster floor is the shortest rank-4 mask, the scout at 20 internal pixels. The floor is 20, and it stays at least half of the shortest measured height. Rank 0 masks are warrior 32, mage 33, scout 33, farmer 33, and engineer 32. The horizontal cap stays 28. Gameplay radius stays 14 and the fit slack stays 2. The camera still looks 32 units above the ground.

The close-up uses that camera angle and frames the card at 80 internal pixels. `heroLikenessProblems` compares that frame to the crop in day, dusk, and night. Intersection-over-union under 0.72 fails. Color error over 46 fails. The voxel meshes score 0.254 to 0.568 and 62.7 to 98. The 160px crop cards score 0.783 to 0.885 and 32.2 to 39.7. The live card uses that 160px source, because the full crop's atlas is about 46MB and stalls the page. Eight directions share one cell. Each direction has four walk frames, three attack frames, and four death frames. Direction 0, walk 0 is the crop. The other directions are a mirror and a center slice of that painting. The attack row lunges the upper body. The death row folds the figure onto its feet. Those poses are not separate paintings on the sheet. The gallery darkens the card at dusk and night so mask luma stays ordered. The yard card stays unlit, so the crop colors survive the night. `heroZoomProblems`, `heroHueProblems`, and `heroFeatureProblems` still judge a voxel mesh. A billboard skips them, because the likeness score is the whole figure. The farmer brim check still fails a voxel hat wider than 0.4 of the fight-zoom body.

Heroes and monsters get one day close-up. The camera uses the game angle and frames the mesh so the figure is 80 internal pixels tall, inside 64 to 96. Day light is neutral, so a grey plate stays grey instead of baking to brown. `compare.png` puts that close-up beside the concept crop at the same height. The portrait card is the close-up. A hero's dominant close-up colors have to sit near colors that occupy that hero's concept crop.

Do not merge a model that skipped a step.

## HUD

Wave, relics, resources, the roster, ability keys, and build keys are captions along the edge of the yard. They do not sit on opaque panels. The actions (start, raise, invite, sound) stay buttons, smaller than the old cards. `assertDiegeticHud` is the check.
