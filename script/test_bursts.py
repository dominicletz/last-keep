#!/usr/bin/env python3
"""The burst sheet rebuilds byte for byte, and each row is its own palette."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bursts as br  # noqa: E402


def radius(icon):
    ink = icon[:, :, 3] > 0
    ys, xs = np.nonzero(ink)
    center = (icon.shape[0] - 1) / 2
    return float(np.hypot(xs - center, ys - center).max())


class BurstTest(unittest.TestCase):
    def test_the_sheet_rebuilds_byte_for_byte(self):
        sheet = br.burst_sheet()
        self.assertEqual(sheet.shape, (br.CELL * 3, br.CELL * br.FRAMES, 4))
        with open(br.SHEET, "rb") as handle:
            committed = handle.read()
        self.assertEqual(committed, br.png_bytes(sheet))
        self.assertEqual(br.png_bytes(sheet), br.png_bytes(br.burst_sheet()))

    def test_each_event_grows_inside_its_own_palette(self):
        sheet = br.burst_sheet()
        for row, kind in enumerate(br.ROWS):
            frames = []
            for frame in range(br.FRAMES):
                cell = sheet[
                    row * br.CELL : (row + 1) * br.CELL,
                    frame * br.CELL : (frame + 1) * br.CELL,
                ]
                used = {tuple(int(v) for v in pixel[:3]) for pixel in cell.reshape(-1, 4) if pixel[3]}
                self.assertTrue(used <= set(br.PALETTE[kind]), kind)
                self.assertGreater(len(used), 0, kind)
                frames.append(cell)
            self.assertGreater(radius(frames[-1]), radius(frames[0]), kind)
            self.assertFalse(np.array_equal(frames[0], frames[-1]), kind)

    def test_the_art_redo_row_is_built_and_names_the_sheet(self):
        with open(os.path.join(br.ROOT, "docs/ART-REDO.md"), encoding="utf-8") as handle:
            text = handle.read()
        row = text.split("bursts: boom, death, slam", 1)[1].split("\n", 1)[0]
        self.assertIn("burst-sheet.png", row)
        self.assertIn("built, awaiting final review", row)


if __name__ == "__main__":
    unittest.main()
