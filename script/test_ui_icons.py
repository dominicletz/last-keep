#!/usr/bin/env python3
"""Elite marks, resource sacks, and build icons rebuild to the committed pixels."""
import os
import sys
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui_icons as ui  # noqa: E402


def load(path):
    return np.asarray(Image.open(path).convert("RGBA"))


class IconTest(unittest.TestCase):
    def test_the_elite_sheet_is_three_cells_and_matches_a_rebuild(self):
        image = load(ui.ELITE_SHEET)
        self.assertEqual(image.shape, (ui.ELITE_CELL, ui.ELITE_CELL * 3, 4))
        self.assertTrue(np.array_equal(image, ui.elite_sheet()))
        cells = {
            name: image[:, index * ui.ELITE_CELL : (index + 1) * ui.ELITE_CELL]
            for index, name in enumerate(ui.ELITE_MARKS)
        }
        for name, cell in cells.items():
            ink = cell[:, :, 3] > 0
            span = max(int(ink.any(0).sum()), int(ink.any(1).sum()))
            self.assertLessEqual(span, ui.ELITE_MAX, name)
            self.assertGreaterEqual(span, 8, name)
        for name in ("plated", "lean"):
            used = self.colours(cells[name])
            self.assertTrue(used <= set(ui.STEEL), name)
            self.assertGreater(len(used), 1, name)
        self.assertIn((216, 207, 195), self.colours(cells["lean"]))
        spiked = self.colours(cells["spiked"])
        self.assertTrue(spiked <= set(ui.SPIKED))
        self.assertIn((245, 117, 30), spiked)
        self.assertIn((32, 28, 26), spiked)

    def test_each_resource_icon_is_24_px_and_matches_a_rebuild(self):
        for name in ui.RESOURCES:
            path = os.path.join(ui.ROOT, "priv/static/images/ui", f"{name}.png")
            image = load(path)
            self.assertEqual(image.shape, (ui.RESOURCE_SIZE, ui.RESOURCE_SIZE, 4), name)
            self.assertTrue(np.array_equal(image, ui.resource_icon(name)), name)
            ink = image[:, :, 3] > 0
            rows = int(ink.any(1).sum())
            self.assertGreaterEqual(rows, 16, name)
            self.assertLessEqual(rows, 24, name)
        food = self.colours(load(os.path.join(ui.ROOT, "priv/static/images/ui/food.png")))
        self.assertTrue(any(r > 160 and g < 80 and b < 60 for r, g, b in food))

    def test_five_build_icons_rebuild_from_the_sheets_and_the_spire_has_none(self):
        for kind in ui.BUILDS:
            path = os.path.join(ui.ROOT, "priv/static/images/ui", f"build-{kind}.png")
            image = load(path)
            self.assertEqual(image.shape, (ui.BUILD_SIZE, ui.BUILD_SIZE, 4), kind)
            self.assertTrue(np.array_equal(image, ui.build_icon(kind)), kind)
            self.assertGreater(int((image[:, :, 3] > 0).sum()), 40, kind)
        spire = os.path.join(ui.ROOT, "priv/static/images/ui/build-mage_tower.png")
        self.assertFalse(os.path.exists(spire))

    def test_the_art_redo_rows_record_this_batch(self):
        with open(os.path.join(ui.ROOT, "docs/ART-REDO.md"), encoding="utf-8") as handle:
            text = handle.read()
        self.assertIn("elite-marks.png", text)
        self.assertIn("built, awaiting final review", text.split("elite marks", 1)[1][:800])
        self.assertIn("priv/static/images/ui/{wood,food,gold}.png", text)
        self.assertIn("mage tower has no sheet", text)
        self.assertIn("open question 22", text)
        pines = text.split("far pines |", 1)[1][:700]
        self.assertIn("built, awaiting final review", pines)
        question = text.split("15. **Far pines.**", 1)[1].split("16.", 1)[0]
        self.assertIn("placeTrees", question)
        self.assertIn("horizon window", question)
        self.assertIn("ground tiles", question)

    def colours(self, image):
        return {tuple(int(v) for v in pixel[:3]) for pixel in image.reshape(-1, 4) if pixel[3]}


if __name__ == "__main__":
    unittest.main()
