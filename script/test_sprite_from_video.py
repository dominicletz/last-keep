#!/usr/bin/env python3
"""Local tests for script/sprite_from_video.py: python3 script/test_sprite_from_video.py"""

import os
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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


if __name__ == "__main__":
    unittest.main()
