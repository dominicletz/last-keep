#!/usr/bin/env python3
"""Arrow, fire, and frost sheets rebuild byte for byte."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import projectiles as pj  # noqa: E402


def luma(rgb):
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


class ProjectileTest(unittest.TestCase):
    def test_the_sheets_rebuild_byte_for_byte(self):
        made = pj.sheets()
        paths = {"arrow": pj.ARROW_SHEET, "fire": pj.FIRE_SHEET, "frost": pj.FROST_SHEET}
        for name, rgba in made.items():
            with open(paths[name], "rb") as handle:
                committed = handle.read()
            self.assertEqual(committed, pj.png_bytes(rgba), name)
            self.assertEqual(pj.png_bytes(rgba), pj.png_bytes(rgba), name)

    def test_the_arrow_is_eight_pre_rotated_frames_in_a_24_px_cell(self):
        sheet = pj.arrow_sheet()
        self.assertEqual(sheet.shape, (pj.ARROW_CELL, pj.ARROW_CELL * pj.ARROW_FRAMES, 4))
        spans = []
        for index in range(pj.ARROW_FRAMES):
            cell = sheet[:, index * pj.ARROW_CELL : (index + 1) * pj.ARROW_CELL]
            ink = cell[:, :, 3] > 0
            self.assertGreater(int(ink.sum()), 8, index)
            spans.append(max(int(ink.any(0).sum()), int(ink.any(1).sum())))
            self.assertLessEqual(spans[-1], 20, index)
        wide = sheet[:, : pj.ARROW_CELL]
        ink = wide[:, :, 3] > 0
        self.assertGreaterEqual(int(ink.any(0).sum()), 16)
        self.assertLessEqual(int(ink.any(0).sum()), 20)
        self.assertGreater(int(ink.any(0).sum()), int(ink.any(1).sum()))
        up = sheet[:, 2 * pj.ARROW_CELL : 3 * pj.ARROW_CELL]
        up_ink = up[:, :, 3] > 0
        self.assertGreater(int(up_ink.any(1).sum()), int(up_ink.any(0).sum()))
        self.assertFalse(np.array_equal(wide, up))

    def test_the_fireball_flickers_and_its_core_can_bloom(self):
        sheet = pj.fire_sheet()
        self.assertEqual(sheet.shape, (pj.FIRE_CELL, pj.FIRE_CELL * pj.FIRE_FRAMES, 4))
        frames = [
            sheet[:, index * pj.FIRE_CELL : (index + 1) * pj.FIRE_CELL] for index in range(pj.FIRE_FRAMES)
        ]
        for frame in frames[1:]:
            self.assertFalse(np.array_equal(frames[0], frame))
        hot = False
        for pixel in frames[0].reshape(-1, 4):
            if pixel[3] and luma(pixel[:3]) > 0.72 * 255:
                hot = True
        self.assertTrue(hot)
        used = {tuple(int(v) for v in pixel[:3]) for pixel in sheet.reshape(-1, 4) if pixel[3]}
        self.assertTrue(used <= set(pj.FIRE))

    def test_frost_is_one_12_px_frame(self):
        sheet = pj.frost_sheet()
        self.assertEqual(sheet.shape, (pj.FROST_CELL, pj.FROST_CELL, 4))
        ink = sheet[:, :, 3] > 0
        span = max(int(ink.any(0).sum()), int(ink.any(1).sum()))
        self.assertLessEqual(span, pj.FROST_LONG)
        self.assertGreaterEqual(span, 8)

    def test_the_art_redo_rows_and_the_bursts_stay_open(self):
        with open(os.path.join(pj.ROOT, "docs/ART-REDO.md"), encoding="utf-8") as handle:
            text = handle.read()
        for name in ("arrow-sheet.png", "fire-sheet.png", "frost.png"):
            row = text.split(name, 1)[1].split("\n", 1)[0]
            self.assertIn("built, awaiting final review", row, name)
        bursts = text.split("bursts: boom, death, slam", 1)[1].split("\n", 1)[0]
        self.assertIn("todo", bursts)
        self.assertNotIn("built, awaiting final review", bursts)


if __name__ == "__main__":
    unittest.main()
