#!/usr/bin/env python3
"""The wordmark, the logo, and the favicon rebuild from the title view."""
import os
import sys
import unittest

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import title_art as title  # noqa: E402


class TitleTest(unittest.TestCase):
    def test_the_wordmark_is_382_px_and_rebuilds_byte_for_byte(self):
        mark = title.wordmark()
        self.assertEqual(mark.shape, (title.TITLE_H, title.TITLE_W, 4))
        self.assertTrue(320 <= title.TITLE_W <= 480)
        with open(title.TITLE, "rb") as handle:
            self.assertEqual(handle.read(), title.png_bytes(mark))
        self.assertEqual(title.png_bytes(mark), title.png_bytes(title.wordmark()))
        self.assertGreater(int((mark[:, :, 3] == 0).sum()), 1000)
        ink = mark[mark[:, :, 3] > 0][:, :3]
        self.assertTrue(((ink[:, 0] > 180) & (ink[:, 1] > 70) & (ink[:, 2] < 90)).any())

    def test_the_logo_is_32_px_and_the_favicon_holds_16_and_32(self):
        icon32, icon16 = title.favicon_icons()
        self.assertEqual(icon32.shape, (32, 32, 4))
        self.assertEqual(icon16.shape, (16, 16, 4))
        self.assertGreater(int((icon32[:, :, 3] > 0).sum()), 40)
        with open(title.LOGO, "rb") as handle:
            self.assertEqual(handle.read(), title.png_bytes(icon32))
        with open(title.FAVICON, "rb") as handle:
            self.assertEqual(handle.read(), title.ico_bytes(icon32, icon16))
        with Image.open(title.FAVICON) as ico:
            self.assertEqual(set(ico.info["sizes"]), {(16, 16), (32, 32)})

    def test_the_start_screen_uses_the_wordmark_and_the_logo_is_not_the_svg(self):
        root = title.ROOT
        with open(os.path.join(root, "lib/last_keep_web/components/start_screen.ex"), encoding="utf-8") as handle:
            screen = handle.read()
        self.assertIn("/images/hd2d/title.png", screen)
        self.assertIn('alt="Last Keep"', screen)
        with open(os.path.join(root, "lib/last_keep_web/components/layouts.ex"), encoding="utf-8") as handle:
            layout = handle.read()
        self.assertIn("/images/logo.png", layout)
        self.assertNotIn("logo.svg", layout)
        with open(os.path.join(root, "docs/ART-REDO.md"), encoding="utf-8") as handle:
            text = handle.read()
        for label in ("start-screen title and landscape", "logo, favicon"):
            row = text.split(label, 1)[1].split("\n", 1)[0]
            self.assertIn("built, awaiting final review", row, label)


if __name__ == "__main__":
    unittest.main()
