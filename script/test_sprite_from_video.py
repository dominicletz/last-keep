#!/usr/bin/env python3
"""Local tests for script/sprite_from_video.py: python3 script/test_sprite_from_video.py"""

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
        self.assertEqual(sorted(cs.HEROES), ["mage", "warrior"])
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

    def test_head_measure_can_skip_a_prop_beside_the_head(self):
        table = cs.HEROES["mage"]["roles"]
        cell = np.zeros((sv.CELL, sv.CELL, 4), np.uint8)
        cell[20:110, 58:70] = (44, 70, 98, 255)      # body
        cell[24:30, 60:66] = (181, 130, 77, 255)     # face, 36 px
        cell[20:30, 40:46] = (181, 130, 77, 255)     # staff head, 60 px
        self.assertEqual(cs.measure(cell, table, ("head", "warm")), 96)
        self.assertEqual(cs.measure(cell, table, ("head", "warm", cs.HEAD)), 36)

    def test_checker_refuses_a_hero_without_a_profile(self):
        with open(os.devnull, "w") as quiet:
            err, sys.stderr = sys.stderr, quiet
            try:
                with self.assertRaises(SystemExit):
                    cs.main(["rogue"])
            finally:
                sys.stderr = err


if __name__ == "__main__":
    unittest.main()
