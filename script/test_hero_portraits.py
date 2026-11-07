#!/usr/bin/env python3
"""The five HUD portraits rebuild from the front views."""
import os
import sys
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_portraits as hp  # noqa: E402


class PortraitTest(unittest.TestCase):
    def test_each_portrait_is_76_by_96_and_matches_a_rebuild(self):
        for hero in hp.HEROES:
            path = os.path.join(hp.ROOT, "priv/static/images/portraits", f"{hero}.png")
            image = Image.open(path)
            self.assertEqual(image.size, (hp.WIDTH, hp.HEIGHT), hero)
            self.assertEqual(image.mode, "RGB", hero)
            got = np.asarray(image)
            self.assertTrue(np.array_equal(got, hp.portrait(hero)), hero)
            # A second call is the same array: the crop and the quantize do not drift.
            self.assertTrue(np.array_equal(hp.portrait(hero), hp.portrait(hero)), hero)

    def test_the_figure_uses_only_the_walk_sheet_palette(self):
        for hero in hp.HEROES:
            image = np.asarray(Image.open(os.path.join(hp.ROOT, "priv/static/images/portraits", f"{hero}.png")))
            used = {tuple(int(v) for v in c) for c in image.reshape(-1, 3)} - {(0, 0, 0)}
            palette = set(hp.sheet_palette(hero))
            self.assertTrue(used <= palette, hero)
            self.assertGreater(len(used), 4, hero)

    def test_the_warrior_front_is_the_dirs_pose_and_the_others_are_v_s(self):
        self.assertTrue(hp.source_path("warrior").endswith("video/dirs/S.png"))
        self.assertTrue(hp.source_path("mage").endswith("video/views/v-S.jpg"))
        self.assertTrue(hp.source_path("scout").endswith("video/views/v-S.jpg"))
        self.assertTrue(hp.source_path("farmer").endswith("video/views/v-S.png"))
        self.assertTrue(hp.source_path("engineer").endswith("video/views/v-S.png"))


if __name__ == "__main__":
    unittest.main()
