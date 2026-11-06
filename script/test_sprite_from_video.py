#!/usr/bin/env python3
"""Local tests for script/sprite_from_video.py: python3 script/test_sprite_from_video.py"""

import json
import os
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_sprite_sheet as cs  # noqa: E402
import sprite_from_video as sv  # noqa: E402

BLUE = (32, 56, 82)
CAPE = (67, 21, 17)


def figure(shift):
    """A 200x300 white still: grey body, red cape, small blue shield."""
    img = np.full((300, 200, 3), 255, np.uint8)
    img[40:280, 70 + shift:130 + shift] = (110, 105, 100)
    img[60:260, 60 + shift:70 + shift] = CAPE
    img[120:160, 125 + shift:140 + shift] = BLUE
    return img


class PaletteTest(unittest.TestCase):
    def poses(self, root):
        dirs = os.path.join(root, "dirs")
        os.makedirs(dirs)
        for i, d in enumerate(sv.COLUMNS):
            Image.fromarray(figure(i - 4)).save(os.path.join(dirs, f"{d}.png"))
        return dirs

    def test_palette_reads_only_the_start_poses(self):
        with tempfile.TemporaryDirectory() as root:
            dirs = self.poses(root)
            first = sv.build_palette(sv.palette_samples(dirs))
            # A clip in the folder, or a changed one, cannot move the palette.
            with open(os.path.join(root, "idle-NE.mp4"), "wb") as fh:
                fh.write(b"not a clip")
            again = sv.build_palette(sv.palette_samples(dirs))
            self.assertEqual(first, again)

    def test_small_saturated_parts_keep_their_colour(self):
        with tempfile.TemporaryDirectory() as root:
            pal = sv.build_palette(sv.palette_samples(self.poses(root)))
            for want in (BLUE, CAPE):
                nearest = min(pal, key=lambda c: sum((a - b) ** 2 for a, b in zip(c, want)))
                self.assertLessEqual(max(abs(a - b) for a, b in zip(nearest, want)), 6, (want, nearest))


class HeroProfileTest(unittest.TestCase):
    def test_every_profile_names_its_checks(self):
        self.assertEqual(sorted(cs.HEROES), ["engineer", "farmer", "mage", "scout", "warrior"])
        for name, hero in cs.HEROES.items():
            roles = {r for r, _ in hero["roles"]}
            self.assertIn(hero["prop"][1], roles, name)
            for _, bounds in (hero["back"], hero["front"]):
                for _, spec, lo, hi in bounds:
                    self.assertIn(spec[1], roles, (name, spec))
                    self.assertTrue(lo is not None or hi is not None)

    def test_mage_roles_split_crystal_robe_and_trim(self):
        table = cs.HEROES["mage"]["roles"]
        self.assertEqual(cs.role((9, 148, 192), table), "crystal")
        self.assertEqual(cs.role((44, 70, 98), table), "blue")
        self.assertEqual(cs.role((181, 130, 77), table), "warm")
        self.assertEqual(cs.role((80, 88, 94), table), "neutral")

    def test_warrior_roles_are_unchanged(self):
        table = cs.HEROES["warrior"]["roles"]
        self.assertEqual(cs.role((32, 56, 82), table), "blue")
        self.assertEqual(cs.role((67, 21, 17), table), "red")
        self.assertEqual(cs.role((170, 122, 65), table), "warm")

    def test_prop_has_a_side_everywhere_unless_the_profile_names_midline_views(self):
        self.assertEqual(cs.HEROES["warrior"]["prop_dirs"], tuple(cs.COLUMNS))
        self.assertEqual(cs.HEROES["mage"]["prop_dirs"], tuple(cs.COLUMNS))
        self.assertEqual(set(cs.COLUMNS) - set(cs.HEROES["scout"]["prop_dirs"]), {"W", "E"})

    def test_a_neutral_role_claims_greys_and_only_greys(self):
        table = cs.HEROES["farmer"]["roles"]
        self.assertEqual(cs.role((101, 93, 87), table), "iron")
        self.assertEqual(cs.role((40, 25, 11), table), "neutral")
        self.assertEqual(cs.role((43, 62, 86), table), "blue")
        self.assertEqual(cs.role((101, 93, 87), cs.HEROES["warrior"]["roles"]), "neutral")

    def test_head_measure_can_skip_a_prop_beside_the_head(self):
        table = cs.HEROES["mage"]["roles"]
        cell = np.zeros((sv.CELL, sv.CELL, 4), np.uint8)
        cell[20:110, 58:70] = (44, 70, 98, 255)      # body
        cell[24:30, 60:66] = (181, 130, 77, 255)     # face, 36 px
        cell[20:30, 40:46] = (181, 130, 77, 255)     # staff head, 60 px
        self.assertEqual(cs.measure(cell, table, ("head", "warm")), 96)
        self.assertEqual(cs.measure(cell, table, ("head", "warm", (54, 74))), 36)

    def test_checker_refuses_a_hero_without_a_profile(self):
        with open(os.devnull, "w") as quiet:
            err, sys.stderr = sys.stderr, quiet
            try:
                with self.assertRaises(SystemExit):
                    cs.main(["rogue"])
            finally:
                sys.stderr = err


GOBLIN_SHEET = os.path.join(sv.ROOT if hasattr(sv, "ROOT") else os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "priv/static/images/hd2d/goblin-sheet.png")
GOBLIN = cs.ASSETS.get("goblin")


def frames_from(grays):
    return [{"gray": np.asarray(g, np.float32), "sharp": 1.0} for g in grays]


class SpecTest(unittest.TestCase):
    def test_hero_layout_is_the_constants(self):
        spec = sv.HERO_SPEC
        self.assertEqual((spec.cell, spec.height, spec.fill, spec.foot), (sv.CELL, sv.HERO, sv.FILL, sv.FOOT))
        self.assertEqual(spec.rows, (("walk", 8), ("idle", 4)))
        self.assertIs(sv.sheet_spec({"noun": "x"}), sv.HERO_SPEC)

    def test_monster_layout_comes_from_the_sheet_block(self):
        cfg = sv.asset_config("goblin")
        spec = sv.sheet_spec(cfg)
        self.assertEqual((spec.cell, spec.height, spec.fill, spec.foot), (80, 50, 48, 72))
        self.assertEqual(spec.rows, (("walk", 8), ("attack", 6), ("death", 6)))
        self.assertEqual(spec.frames, 20)
        self.assertEqual([spec.row_kind(r) for r in (0, 7, 8, 13, 14, 19)],
                         ["walk", "walk", "attack", "attack", "death", "death"])
        self.assertEqual((spec.first_row("attack"), spec.first_row("death")), (8, 14))
        no_death = sv.sheet_spec(dict(cfg, clips={"walk": sv.COLUMNS, "attack": sv.COLUMNS}))
        self.assertEqual(no_death.rows, (("walk", 8), ("attack", 6)))
        self.assertIsNone(sv.asset_config("mage"))
        vagrant = sv.sheet_spec(sv.asset_config("vagrant"))
        self.assertEqual(vagrant.rows, (("walk", 8), ("idle", 4)))
        self.assertEqual(vagrant.first_row("idle"), 8)
        merchant = sv.sheet_spec(sv.asset_config("merchant"))
        self.assertEqual(merchant.rows, (("idle", 4),))
        self.assertEqual(merchant.frames, 4)

    def test_a_diagonal_death_reuses_the_cardinal_that_keeps_its_read(self):
        have = {"walk": sv.COLUMNS, "death": ["S", "W", "N", "E"]}
        self.assertEqual([sv.clip_for(have, "death", d) for d in sv.COLUMNS],
                         ["S", "S", "W", "N", "N", "N", "E", "S"])
        self.assertEqual(sv.clip_for(have, "walk", "NE"), "NE")
        with self.assertRaises(SystemExit):
            sv.clip_for({"walk": ["S"]}, "walk", "SW")
        with self.assertRaises(SystemExit):
            sv.clip_for({"death": ["W", "E"]}, "death", "SW")


class MonsterGeometryTest(unittest.TestCase):
    def test_torso_centre_ignores_an_upright_spear(self):
        mask = np.zeros((300, 200), bool)
        mask[100:290, 80:140] = True     # body, centre x 109.5
        mask[20:290, 40:44] = True       # spear shaft beside it, tip far above the head
        mask[20:40, 36:48] = True        # spearhead
        h = 270
        self.assertAlmostEqual(sv.torso_centre(mask, h), 109.5, delta=0.6)
        self.assertLess(sv.head_centre(mask), 50)  # the hero anchor would centre the spearhead

    def test_attack_picks_wind_up_strike_and_recovery(self):
        d = [0, 1, 2, 4, 6, 8, 10, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0]
        frames = frames_from([[[v]] for v in d])
        peak, back, picks = sv.attack_picks(frames)
        self.assertEqual(peak, 7)
        self.assertEqual(back, 12)  # first frame back within 20% of the peak change (2 <= 2.4)
        self.assertEqual(picks[0], 0)
        self.assertEqual(picks[3], 7)
        self.assertEqual(len(picks), 6)
        self.assertEqual(picks, sorted(picks))

    def test_a_flier_hangs_on_frame_0_and_lands_on_its_own_lowest_pixel(self):
        # A wingbeat drops the wings below the body: a figure on its feet
        # would re-anchor on that lowest pixel and the body would jump up.
        body = np.zeros((300, 300), bool)
        body[100:200, 120:180] = True
        down = body.copy()
        down[180:260, 40:120] = down[180:260, 180:260] = True   # wings swept below the feet
        start = (sv.torso_centre(body, 100), sv.feet_centre(body, 100), 199)
        for kind in ("walk", "attack"):
            self.assertEqual(sv.monster_anchor(kind, down, 100, start, flies=True), (start[0], 199), kind)
            self.assertEqual(sv.monster_anchor(kind, down, 100, start)[1], 259, kind)
        self.assertEqual(sv.monster_anchor("death", down, 100, start, flies=True), (start[0], 259))
        self.assertEqual(sv.monster_anchor("death", down, 100, start), (start[0], 199))
        self.assertEqual(sv.monster_anchor("walk", body, 100, start), (sv.torso_centre(body, 100), 199))
        self.assertEqual(sv.monster_anchor("idle", body, 100, start), sv.monster_anchor("walk", body, 100, start))
        mask = np.zeros((40, 20), bool)
        mask[8:32, 6:14] = True
        rgb = np.full((40, 20, 3), 200, np.uint8)
        frames = [{"gray": np.zeros((4, 4), np.float32), "sharp": float(i + 1), "mask": mask, "rgb": rgb}
                  for i in range(49)]
        spec = sv.sheet_spec(sv.asset_config("merchant"))
        picks, _scale, _placer, info = sv.monster_geometry("idle", frames, spec)
        self.assertEqual(len(picks), 4)
        self.assertEqual(picks[0], 0)
        self.assertEqual(info, {})

    def test_only_a_flies_config_gets_a_flier_spec(self):
        self.assertFalse(sv.HERO_SPEC.flies)
        for a in ("goblin", "skeleton", "wolf"):
            self.assertFalse(sv.sheet_spec(sv.asset_config(a)).flies, a)
        bat = sv.sheet_spec(sv.asset_config("bat"))
        self.assertTrue(bat.flies)
        self.assertEqual((bat.cell, bat.height, bat.foot), (128, 44, 104))
        # Every figure on its feet keeps the 8 px margin; only a flier hangs higher.
        for a in ("goblin", "skeleton", "wolf"):
            s = sv.sheet_spec(sv.asset_config(a))
            self.assertEqual(s.foot, s.cell - sv.FOOT_MARGIN, a)
        self.assertEqual(sv.FOOT_MARGIN, 8)

    def test_death_picks_end_when_the_fall_comes_to_rest(self):
        d = [0, 1, 3, 6, 10, 15, 20, 25, 28, 30, 30, 30, 30, 30, 30, 30]
        frames = frames_from([[[v]] for v in d])
        rest, picks = sv.death_picks(frames)
        self.assertEqual(rest, 8)  # within 10% of the largest change from the last frame
        self.assertEqual(picks[0], 0)
        self.assertEqual(picks[-1], 8)
        self.assertEqual(len(picks), 6)


    def test_death_picks_by_motion_spread_over_the_fall_not_the_hold(self):
        # 20 frames holding the start pose, a fall over frames 21-29, then
        # lying still: evenly timed picks stand in the hold, motion picks fall.
        d = [0] * 21 + [3, 7, 12, 17, 22, 26, 28, 29, 30] + [30] * 19
        frames = frames_from([[[v]] for v in d])
        rest, timed = sv.death_picks(frames)
        rest_m, moved = sv.death_picks(frames, by_motion=True)
        self.assertEqual(rest, rest_m)
        self.assertEqual((timed[0], timed[-1]), (moved[0], moved[-1]))
        self.assertEqual(moved[0], 0)
        self.assertGreaterEqual(sum(1 for p in timed[1:-1] if p <= 20), 3)
        self.assertTrue(all(21 <= p < rest for p in moved[1:-1]), moved)
        self.assertEqual(moved, sorted(set(moved)))
        # A clip without motion, or too short a fall, falls back to time.
        still = frames_from([[[0]]] * 49)
        self.assertEqual(sv.death_picks(still, by_motion=True), sv.death_picks(still))
        # Only the wolf asks for it; nothing else changes its sheet.
        for a in ("goblin", "skeleton", "bat", "troll", "boss"):
            self.assertFalse(sv.sheet_spec(sv.asset_config(a)).death_by_motion, a)
        self.assertTrue(sv.sheet_spec(sv.asset_config("wolf")).death_by_motion)
        self.assertFalse(sv.HERO_SPEC.death_by_motion)

@unittest.skipUnless(GOBLIN and os.path.exists(GOBLIN_SHEET), "goblin sheet not built")
class MonsterCheckTest(unittest.TestCase):
    def setUp(self):
        self.sheet = np.asarray(Image.open(GOBLIN_SHEET).convert("RGBA")).copy()
        self.poses = os.path.join(os.path.dirname(GOBLIN_SHEET), "../../../../assets/reference/goblin/video/dirs")

    def fails(self, sheet):
        rep = cs.run_monster_checks(GOBLIN, sheet, self.poses, quiet=True)
        return {name: clips for ok, name, _, clips in rep.results if not ok}

    def test_the_committed_goblin_sheet_passes(self):
        self.assertEqual(self.fails(self.sheet), {})

    def test_a_mirrored_diagonal_death_fails(self):
        sheet = self.sheet.copy()
        c = sv.COLUMNS.index("SW")
        for r in range(14, 20):
            sheet[r * 80:(r + 1) * 80, c * 80:(c + 1) * 80] = sheet[r * 80:(r + 1) * 80, c * 80:(c + 1) * 80][:, ::-1]
        self.assertEqual(self.fails(sheet).get("death SW reuses death-S unmirrored"), ("death-S.mp4",))

    def test_a_dropped_spear_blames_its_clip(self):
        sheet = self.sheet.copy()
        cell = sheet[3 * 80:4 * 80, 0:80]
        r = cs.roles(cell, GOBLIN["profile"]["roles"])
        cell[r == "iron"] = (60, 40, 25, 255)  # the spearhead painted over in walk-S frame 3
        self.assertEqual(self.fails(sheet).get("spear S in every walk and attack frame"), ("walk-S.mp4",))

    def test_a_figure_cut_at_the_cell_edge_fails(self):
        sheet = self.sheet.copy()
        c = sv.COLUMNS.index("E")
        cell = sheet[9 * 80:10 * 80, c * 80:(c + 1) * 80]
        cell[:] = np.roll(cell, 30, axis=1)
        self.assertIn("attack-E.mp4", self.fails(sheet).get("clear of the cell border (nothing cut off)", ()))

    def test_a_figure_with_no_prop_skips_only_the_prop_checks(self):
        # The wolf holds nothing: check "prop": null drops the spear checks
        # and nothing else, and the poses directory is never read for them.
        names = lambda rep: [name for _, name, _, _ in rep.results]
        full = cs.run_monster_checks(GOBLIN, self.sheet, self.poses, quiet=True)
        bare = dict(GOBLIN, profile=dict(GOBLIN["profile"], prop=None))
        rep = cs.run_monster_checks(bare, self.sheet, "/nonexistent", quiet=True)
        self.assertEqual({n: ok for ok, n, _, _ in rep.results if not ok}, {})
        self.assertEqual([n for n in names(full) if not n.startswith("spear ")],
                         [n for n in names(rep) if n != "no held prop"])
        self.assertIn("no held prop", names(rep))
        self.assertTrue(any(n.startswith("spear ") for n in names(full)))
        # A broken death still fails without a prop.
        sheet = self.sheet.copy()
        c = sv.COLUMNS.index("W")
        sheet[19 * 80:20 * 80, c * 80:(c + 1) * 80] = sheet[14 * 80:15 * 80, c * 80:(c + 1) * 80]
        rep = cs.run_monster_checks(bare, sheet, "/nonexistent", quiet=True)
        self.assertIn("death W ends on the ground", [n for ok, n, _, _ in rep.results if not ok])

    def flier(self, sheet):
        rep = cs.run_monster_checks(dict(GOBLIN, spec=GOBLIN["spec"]._replace(flies=True)), sheet, self.poses, quiet=True)
        return rep

    def test_a_flier_swaps_the_foot_checks_for_hover_checks(self):
        # The flier checks replace exactly the walk height, the walk foot
        # line, the attack feet and the legs; every other check is the same.
        names = lambda rep: [n for _, n, _, _ in rep.results]
        ground = names(cs.run_monster_checks(GOBLIN, self.sheet, self.poses, quiet=True))
        fly = names(self.flier(self.sheet))
        swapped = lambda n: (n.startswith("walk height") or n == "walk shares one foot line"
                             or n.startswith("attack feet") or n.endswith(" legs move"))
        flier_only = lambda n: n.startswith("flier ") or " hovers at " in n or n.endswith(" wings beat")
        self.assertEqual([n for n in ground if not swapped(n)], [n for n in fly if not flier_only(n)])
        self.assertEqual(sum(swapped(n) for n in ground), 11)
        self.assertEqual(sum(flier_only(n) for n in fly), 11)
        self.assertIn("death feet on the line +-3 px", fly)
        self.assertEqual(cs.HOVER_BOB, 0.3)

    def test_a_flier_that_sinks_or_stops_beating_fails(self):
        fails = lambda sheet: {n: c for ok, n, _, c in self.flier(sheet).results if not ok}
        base = fails(self.sheet)
        self.assertNotIn("walk-S.mp4", base.get("walk hovers at the start height +-15 px", ()))
        self.assertNotIn("walk N wings beat", base)
        sheet = self.sheet.copy()
        cell = sheet[3 * 80:4 * 80, 0:80]
        cell[:] = np.roll(cell, -18, axis=0)  # walk-S frame 3 rises 18 px (0.3 x 50 = 15 allowed)
        self.assertIn("walk-S.mp4", fails(sheet).get("walk hovers at the start height +-15 px", ()))
        sheet = self.sheet.copy()
        c = sv.COLUMNS.index("N")
        for r in range(1, 8):                 # walk-N frozen on its start pose
            sheet[r * 80:(r + 1) * 80, c * 80:(c + 1) * 80] = sheet[0:80, c * 80:(c + 1) * 80]
        self.assertEqual(fails(sheet).get("walk N wings beat"), ("walk-N.mp4",))

    def test_body_core_drops_thin_wings(self):
        cell = np.zeros((128, 128, 4), np.uint8)
        cell[60:100, 46:66, 3] = 255          # body 20 px wide
        cell[20:60, 10:14, 3] = 255           # a thin raised wing
        cell[60:66, 66:110, 3] = 255          # a wing 6 px thick, joined to the body
        cell[100:120, 90:96, 3] = 255         # a loose part 6 px wide, beyond the body
        core = cs.body_core(cell, 44)
        self.assertFalse(core[20:60, 10:14].any())
        self.assertFalse(core[60:66, 70:110].any())
        self.assertEqual(cs.core_y(cell, 44), 79.5)
        # A side view thinner than 0.3 x the height: the widest square that
        # leaves anything, not the whole silhouette.
        thin = np.zeros((128, 128, 4), np.uint8)
        thin[60:100, 50:60, 3] = 255          # body 10 px wide
        thin[30:60, 54:56, 3] = 255           # an ear or wing edge-on
        self.assertEqual(int(cs.body_core(thin, 44).sum()), 400)
        self.assertEqual(cs.core_y(thin, 44), 79.5)

    def test_a_null_prop_is_refused_with_prop_settings_and_on_a_hero(self):
        check = json.loads(json.dumps(sv.asset_config("goblin")["check"]))
        check["prop"] = None
        check.pop("prop_dirs")
        self.assertIsNone(cs.profile(check)["prop"])
        for extra in ({"prop_dirs": ["S"]}, {"prop_side_below": 0.3}):
            with self.assertRaises(ValueError, msg=extra):
                cs.profile(dict(check, **extra))
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "h"))
            with open(os.path.join(tmp, "h", "hero.json"), "w") as fh:
                json.dump({"check": check}, fh)
            with self.assertRaises(ValueError):
                cs.load_heroes(tmp)

    def test_a_death_that_stays_standing_fails(self):
        sheet = self.sheet.copy()
        c = sv.COLUMNS.index("W")
        sheet[19 * 80:20 * 80, c * 80:(c + 1) * 80] = sheet[14 * 80:15 * 80, c * 80:(c + 1) * 80]
        self.assertEqual(self.fails(sheet).get("death W ends on the ground"), ("death-W.mp4",))


class AssetProfileTest(unittest.TestCase):
    def test_goblin_roles(self):
        self.assertEqual(sorted(cs.ASSETS), ["bat", "boss", "deer", "goblin", "skeleton", "troll", "vagrant", "wolf"])
        table = cs.ASSETS["goblin"]["profile"]["roles"]
        self.assertEqual(cs.role((142, 136, 134), table), "iron")
        self.assertEqual(cs.role((56, 39, 27), table), "leather")
        self.assertEqual(cs.role((108, 113, 62), table), "skin")
        self.assertEqual(cs.role((113, 70, 25), table), "ochre")
        self.assertEqual(cs.role((84, 61, 43), table), "leather")
        self.assertEqual(cs.ASSETS["goblin"]["profile"]["prop_dirs"], tuple(cs.COLUMNS))


    def test_skeleton_roles_keep_bone_and_iron_apart(self):
        # The concept is warm grey throughout: warm greys are bone (pale) or
        # shadow (dark), and only near-colourless or cool greys are the
        # sword's iron. The clips draw the bone warmer than the concept, so
        # the mid tans of the built palette are bone too, not leather.
        prof = cs.ASSETS["skeleton"]["profile"]
        table = prof["roles"]
        self.assertEqual(cs.role((143, 135, 126), table), "bone")
        self.assertEqual(cs.role((168, 161, 152), table), "bone")
        self.assertEqual(cs.role((82, 75, 67), table), "shadow")
        self.assertEqual(cs.role((48, 44, 42), table), "shadow")
        self.assertEqual(cs.role((140, 142, 146), table), "iron")
        self.assertEqual(cs.role((110, 110, 112), table), "iron")
        self.assertEqual(cs.role((90, 60, 40), table), "leather")
        self.assertEqual(cs.role((110, 60, 90), table), "cloth")
        # Palette colours of the built sheet.
        for bone in ((112, 98, 78), (135, 120, 98), (164, 147, 123), (97, 86, 71)):
            self.assertEqual(cs.role(bone, table), "bone", bone)
        for iron in ((85, 80, 76), (108, 103, 99), (134, 127, 123)):
            self.assertEqual(cs.role(iron, table), "iron", iron)
        self.assertEqual(cs.role((53, 43, 42), table), "cloth")  # the loincloth
        self.assertEqual(cs.role((69, 49, 34), table), "leather")  # the belt
        self.assertEqual(cs.role((73, 62, 47), table), "shadow")
        self.assertEqual(prof["prop"], ("sword", "iron"))
        self.assertEqual(prof["prop_dirs"], tuple(cs.COLUMNS))
        self.assertEqual(prof["prop_side_below"], 0.3)
        spec = cs.ASSETS["skeleton"]["spec"]
        self.assertEqual((spec.cell, spec.height), (88, 60))

    def test_skeleton_start_poses_meet_their_own_view_bounds(self):
        # The bounds are tuned on the start poses: each one must hold them.
        asset = cs.ASSETS["skeleton"]
        prof, spec = asset["profile"], asset["spec"]
        dirs = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "assets/reference/skeleton/video/dirs")
        if not os.path.exists(os.path.join(dirs, "S.png")):
            self.skipTest("skeleton start poses not generated")
        for col, key in (("N", "back"), ("S", "front")):
            pose = np.asarray(Image.open(os.path.join(dirs, f"{col}.png")).convert("RGB"))
            rgb, al = sv.pose_place(pose, spec)
            cell = np.zeros((spec.cell, spec.cell, 4), np.uint8)
            cell[al, :3] = np.clip(rgb[al], 0, 255).astype(np.uint8)
            cell[al, 3] = 255
            for label_, m, lo, hi in prof[key][1]:
                v = cs.measure(cell, prof["roles"], m)
                self.assertTrue((lo is None or v >= lo) and (hi is None or v <= hi), (col, label_, v, lo, hi))

    def test_every_other_profile_measures_the_prop_side_on_every_prop_pixel(self):
        for name, hero in cs.HEROES.items():
            self.assertEqual(hero["prop_side_below"], 0.0, name)
        self.assertEqual(cs.ASSETS["goblin"]["profile"]["prop_side_below"], 0.0)


class PropSideTest(unittest.TestCase):
    """prop_side_below: a same-colour part worn on the torso (the skeleton's
    shoulder plate) must not pull the held prop's side to the midline."""

    def cell(self):
        table = cs.ASSETS["skeleton"]["profile"]["roles"]
        c = np.zeros((88, 88, 4), np.uint8)
        c[21:81, 38:50] = (164, 147, 123, 255)   # bone body, rows 21..80
        c[24:34, 40:52] = (108, 103, 99, 255)    # iron shoulder plate on the torso top
        c[60:63, 20:38] = (108, 103, 99, 255)    # sword held low, out to screen-left
        return c, table

    def test_the_plate_pulls_the_whole_prop_centroid_toward_the_midline(self):
        c, table = self.cell()
        whole, n = cs.prop_offset(c, table, "iron")
        low, m = cs.prop_offset(c, table, "iron", 0.3)
        self.assertEqual((n, m), (174, 54))
        self.assertGreater(abs(low), abs(whole) + 5)
        self.assertLess(low, -10)  # the blade alone is clearly screen-left

    def test_a_prop_only_above_the_cut_has_no_side_but_still_counts(self):
        c, table = self.cell()
        c[60:63, 20:38] = 0                      # the sword gone: only the plate is iron
        self.assertEqual(cs.prop_offset(c, table, "iron", 0.3), (None, 0))
        self.assertIsNotNone(cs.prop_offset(c, table, "iron")[0])


class SheetBuildTest(unittest.TestCase):
    """The same inputs give the same bytes: a rebuild matches what is committed.
    About a minute each."""

    def rebuild(self, name, files):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, files[0])
            with open(os.devnull, "w") as quiet:
                err, sys.stderr = sys.stderr, quiet
                try:
                    sv.main([name, "--out", out])
                finally:
                    sys.stderr = err
            self.assertEqual(sorted(os.listdir(tmp)), sorted(files))
            for f in files:
                with open(os.path.join(tmp, f), "rb") as a, open(os.path.join(root, "priv/static/images/hd2d", f), "rb") as b:
                    self.assertEqual(a.read(), b.read(), f)

    def test_the_mage_sheet_rebuilds_byte_for_byte(self):
        self.rebuild("mage", ["mage-walk.png", "mage-walk-normal.png"])

    def test_the_goblin_sheet_rebuilds_byte_for_byte_without_a_normal_map(self):
        self.rebuild("goblin", ["goblin-sheet.png"])

    def test_the_skeleton_sheet_rebuilds_byte_for_byte_without_a_normal_map(self):
        self.rebuild("skeleton", ["skeleton-sheet.png"])

    def test_the_wolf_sheet_rebuilds_byte_for_byte_without_a_normal_map(self):
        self.rebuild("wolf", ["wolf-sheet.png"])

    def test_the_bat_sheet_rebuilds_byte_for_byte_without_a_normal_map(self):
        self.rebuild("bat", ["bat-sheet.png"])

    def test_the_boss_check_profile_sits_between_the_measured_columns(self):
        # Trial sheet (all 20 clips): steel S 120-208 vs N 58-109, leather
        # S 66-119 vs N 27-53; the glow overlaps (S 4-23, N 0-6) and is no bound.
        prof = cs.ASSETS["boss"]["profile"]
        self.assertIsNone(prof["prop"])
        back = {n: hi for n, _, lo, hi in prof["back"][1]}
        front = {n: lo for n, _, lo, hi in prof["front"][1]}
        self.assertEqual(back, {"steel": 114, "leather": 59})
        self.assertEqual(front, {"steel": 115, "leather": 60})
        for n in back:
            self.assertLess(back[n], front[n])
        table = prof["roles"]
        self.assertEqual(cs.role((88, 82, 89), table), "steel")
        self.assertEqual(cs.role((46, 34, 27), table), "leather")
        self.assertEqual(cs.role((45, 41, 46), table), "iron")
        self.assertEqual(cs.role((158, 84, 185), table), "glow")
        self.assertEqual(cs.ASSETS["boss"]["spec"].cell, 192)

    def test_the_troll_sheet_rebuilds_byte_for_byte_without_a_normal_map(self):
        self.rebuild("troll", ["troll-sheet.png"])

    def test_the_committed_troll_sheet_passes_its_checks(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sheet = np.asarray(Image.open(os.path.join(root, "priv/static/images/hd2d/troll-sheet.png")).convert("RGBA"))
        self.assertEqual(sheet.shape, (20 * 160, 8 * 160, 4))
        rep = cs.run_monster_checks(cs.ASSETS["troll"], sheet,
                                    os.path.join(root, "assets/reference/troll/video/dirs"), quiet=True)
        self.assertEqual([name for ok, name, _, _ in rep.results if not ok], [])
        self.assertGreater(len(rep.results), 50)

    def test_the_boss_sheet_rebuilds_byte_for_byte_without_a_normal_map(self):
        self.rebuild("boss", ["boss-sheet.png"])

    def test_the_committed_boss_sheet_passes_its_checks(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sheet = np.asarray(Image.open(os.path.join(root, "priv/static/images/hd2d/boss-sheet.png")).convert("RGBA"))
        self.assertEqual(sheet.shape, (20 * 192, 8 * 192, 4))
        rep = cs.run_monster_checks(cs.ASSETS["boss"], sheet,
                                    os.path.join(root, "assets/reference/boss/video/dirs"), quiet=True)
        self.assertEqual([name for ok, name, _, _ in rep.results if not ok], [])
        self.assertEqual(len(rep.results), 49)  # every boss check ran

    def test_the_committed_bat_sheet_passes_its_checks(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sheet = np.asarray(Image.open(os.path.join(root, "priv/static/images/hd2d/bat-sheet.png")).convert("RGBA"))
        rep = cs.run_monster_checks(cs.ASSETS["bat"], sheet,
                                    os.path.join(root, "assets/reference/bat/video/dirs"), quiet=True)
        self.assertEqual([name for ok, name, _, _ in rep.results if not ok], [])

    def test_the_committed_wolf_sheet_passes_its_checks(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sheet = np.asarray(Image.open(os.path.join(root, "priv/static/images/hd2d/wolf-sheet.png")).convert("RGBA"))
        rep = cs.run_monster_checks(cs.ASSETS["wolf"], sheet,
                                    os.path.join(root, "assets/reference/wolf/video/dirs"), quiet=True)
        self.assertEqual([name for ok, name, _, _ in rep.results if not ok], [])

    def test_the_committed_vagrant_sheet_passes_its_checks(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sheet = np.asarray(Image.open(os.path.join(root, "priv/static/images/hd2d/vagrant-sheet.png")).convert("RGBA"))
        self.assertEqual(sheet.shape, (12 * 128, 8 * 128, 4))
        rep = cs.run_monster_checks(cs.ASSETS["vagrant"], sheet,
                                    os.path.join(root, "assets/reference/vagrant/video/dirs"), quiet=True)
        self.assertEqual([name for ok, name, _, _ in rep.results if not ok], [])
        heights = []
        for column in range(8):
            for row in range(8):
                cell = sheet[row * 128:(row + 1) * 128, column * 128:(column + 1) * 128]
                ys = np.where(cell[:, :, 3] > 0)[0]
                heights.append(int(ys.max() - ys.min() + 1))
        self.assertGreaterEqual(min(heights), 84)
        self.assertLessEqual(max(heights), 92)

    def test_the_committed_skeleton_sheet_passes_its_checks(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sheet = np.asarray(Image.open(os.path.join(root, "priv/static/images/hd2d/skeleton-sheet.png")).convert("RGBA"))
        rep = cs.run_monster_checks(cs.ASSETS["skeleton"], sheet,
                                    os.path.join(root, "assets/reference/skeleton/video/dirs"), quiet=True)
        self.assertEqual([name for ok, name, _, _ in rep.results if not ok], [])


def _stamp(height, foot=117, touch=False):
    """An opaque block of the given height whose lowest row is foot."""
    cell = np.zeros((sv.CELL, sv.CELL, 4), np.uint8)
    top = foot - height + 1
    cell[top:foot + 1, 40:88, :3] = (20, 20, 20)
    cell[top:foot + 1, 40:88, 3] = 255
    if touch:
        cell[0, 40:88, 3] = 255
    return cell


class HeroActionRowsTest(unittest.TestCase):
    def test_missing_action_clips_leave_the_twelve_row_sheet(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        mage = os.path.join(root, "assets/reference/mage/video")
        warrior = os.path.join(root, "assets/reference/warrior/video")
        self.assertFalse(sv.actions_complete(mage))
        self.assertFalse(sv.actions_complete(warrior))
        bands = sv.hero_bands(sv.CELL * 12)
        self.assertEqual(list(bands["walk"]), list(range(8)))
        self.assertEqual(list(bands["attack"]), [])
        self.assertEqual(list(bands["death"]), [])
        self.assertEqual(list(bands["idle"]), [8, 9, 10, 11])
        self.assertEqual(cs.row_clip("S", 8), "idle-S.mp4")
        with tempfile.TemporaryDirectory() as tmp:
            self.assertFalse(sv.actions_complete(tmp))
            open(os.path.join(tmp, "attack-S.mp4"), "w").close()
            open(os.path.join(tmp, "death-S.mp4"), "w").close()
            self.assertFalse(sv.actions_complete(tmp), "a south-only pair is not a full block")
            for d in sv.COLUMNS:
                open(os.path.join(tmp, f"attack-{d}.mp4"), "w").close()
            for d in "SWNE":
                open(os.path.join(tmp, f"death-{d}.mp4"), "w").close()
            self.assertTrue(sv.actions_complete(tmp))

    def test_a_full_sheet_is_walk_attack_death_idle(self):
        bands = sv.hero_bands(sv.CELL * 24)
        self.assertEqual(list(bands["walk"]), list(range(0, 8)))
        self.assertEqual(list(bands["attack"]), list(range(8, 14)))
        self.assertEqual(list(bands["death"]), list(range(14, 20)))
        self.assertEqual(list(bands["idle"]), list(range(20, 24)))
        self.assertIsNone(sv.hero_bands(sv.CELL * 13))
        self.assertEqual((sv.ATTACK_ROWS, sv.DEATH_ROWS), (6, 6))

    def test_death_picks_end_on_the_last_frame(self):
        frames = frames_from([np.zeros((4, 4), np.float32) for _ in range(49)])
        picks = sv.hero_death_picks(frames)
        self.assertEqual(len(picks), sv.DEATH_ROWS)
        self.assertEqual(picks[0], 0)
        self.assertEqual(picks[-1], 48)
        self.assertEqual(picks, sorted(set(picks)))

    def test_pasting_actions_keeps_the_walk_and_idle_pixels(self):
        rng = np.random.default_rng(0)
        base = rng.integers(0, 255, (sv.CELL * 12, sv.CELL * 8, 4), dtype=np.uint8)
        attack = {d: [np.zeros((sv.CELL, sv.CELL, 4), np.uint8) for _ in range(sv.ATTACK_ROWS)]
                  for d in sv.COLUMNS}
        death = {d: [np.full((sv.CELL, sv.CELL, 4), 7, np.uint8) for _ in range(sv.DEATH_ROWS)]
                 for d in sv.COLUMNS}
        tall = sv.paste_hero_actions(base, attack, death)
        self.assertEqual(tall.shape, (sv.CELL * 24, sv.CELL * 8, 4))
        self.assertTrue(np.array_equal(tall[:sv.CELL * 8], base[:sv.CELL * 8]))
        self.assertTrue(np.array_equal(tall[sv.CELL * 20:sv.CELL * 24], base[sv.CELL * 8:sv.CELL * 12]))

    def test_a_lying_death_frame_is_not_held_to_the_standing_height(self):
        bands = sv.hero_bands(sv.CELL * 24)
        grid = [[_stamp(88) for _ in range(24)] for _ in range(8)]
        grid[0][8] = _stamp(97)
        rep = cs.action_faults(grid, bands)
        failed = {name: clips for ok, name, _, clips in rep.results if not ok}
        self.assertIn("attack height 88 +-2 px", failed)
        self.assertIn("attack-S.mp4", failed["attack height 88 +-2 px"])
        self.assertNotIn("death start height 88 +-2 px", failed)
        grid[0][8] = _stamp(88)
        grid[0][19] = _stamp(42)
        rep = cs.action_faults(grid, bands)
        failed = {name: clips for ok, name, _, clips in rep.results if not ok}
        self.assertEqual(failed, {})
        grid[2][15] = _stamp(40, foot=100)
        rep = cs.action_faults(grid, bands)
        failed = {name: clips for ok, name, _, clips in rep.results if not ok}
        self.assertIn("death feet on the line", failed)
        self.assertIn("death-W.mp4", failed["death feet on the line"])
        self.assertNotIn("death start height 88 +-2 px", failed)
        grid[2][15] = _stamp(88)
        grid[2][9] = _stamp(88, touch=True)
        rep = cs.action_faults(grid, bands)
        failed = {name: clips for ok, name, _, clips in rep.results if not ok}
        self.assertIn("attack and death clear of the cell border", failed)
        self.assertIn("attack-W.mp4", failed["attack and death clear of the cell border"])
        self.assertNotIn("idle-W.mp4", failed["attack and death clear of the cell border"])


if __name__ == "__main__":
    unittest.main()
