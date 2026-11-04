"""Static art ("type": "static" in asset.json): config, prompts and the build."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_sprites as hs  # noqa: E402
import sprite_from_video as sv  # noqa: E402

BASE = {"type": "static", "noun": "pine tree", "concept": {"file": "docs/concept/theme.jpg"},
        "design": "a pine", "world_height": 40, "cell": [128, 120],
        "variants": [{"id": "a", "note": "full"}, {"id": "b", "note": "young", "scale": 0.85}]}


def pine_image(w=720, h=720, top=60, foot=680, half=170, seed=0):
    """A synthetic generated image: a green triangle with shaded tiers and a
    brown trunk on white, like a GenerateImage result."""
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), 255, np.uint8)
    trunk = foot - (foot - top) // 8
    for y in range(top, trunk):
        r = int(half * (y - top) / (trunk - top)) + 2
        g = 60 + 40 * ((y // 20) % 2)
        img[y, w // 2 - r:w // 2 + r] = (30, g, 35)
        img[y, w // 2: w // 2 + r // 3] = (90, g + 50, 40)
    img[trunk:foot, w // 2 - 12:w // 2 + 12] = (80, 50, 30)
    noise = rng.integers(-6, 7, img.shape)
    body = img.min(2) < 250
    img[body] = np.clip(img[body].astype(int) + noise[body], 0, 255).astype(np.uint8)
    return img


class StaticTest(unittest.TestCase):
    def config(self, **over):
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "p"))
        with open(os.path.join(tmp, "p", "asset.json"), "w") as fh:
            json.dump(dict(BASE, **over), fh)
        return hs.load_config("p", reference=tmp)

    def test_a_static_config_loads_with_its_height_at_the_hero_texel(self):
        cfg = self.config()
        self.assertEqual(cfg["type"], "static")
        self.assertEqual(cfg["height"], hs.sheet_height(40))
        self.assertEqual(cfg["height"], 110)
        self.assertEqual([hs.static_height(cfg, v) for v in cfg["variants"]], [110, 94])

    def test_bad_static_configs_are_refused(self):
        bad = [{"world_height": 0}, {"world_height": "40"}, {"cell": [128, 112]}, {"cell": [130, 120]},
               {"cell": [128]}, {"variants": []}, {"variants": [{"id": "a"}] * 2},
               {"variants": [{"id": f"v{i}"} for i in range(5)]}, {"variants": [{"id": "A"}]},
               {"variants": [{"id": "a", "scale": 0.3}]}, {"variants": [{"id": "a", "scale": 1.2}]},
               {"variants": [{"id": "a", "colour": "red"}]}]
        for over in bad:
            with self.assertRaises(SystemExit, msg=over):
                self.config(**over)
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "p"))
        with open(os.path.join(tmp, "p", "asset.json"), "w") as fh:
            json.dump({k: v for k, v in BASE.items() if k != "variants"}, fh)
        with self.assertRaises(SystemExit):
            hs.load_config("p", reference=tmp)

    def test_a_static_piece_only_runs_its_own_steps(self):
        for step in ("views", "dirs", "precheck"):
            with self.assertRaises(SystemExit):
                hs.main(["pine", step])

    def test_the_build_pixelizes_outlines_and_stands_every_variant_on_the_ground_row(self):
        cfg = self.config()
        sheet = hs.static_sheet(cfg, {"a": pine_image(), "b": pine_image(half=120, seed=1)})
        self.assertEqual(sheet.shape, (120, 256, 4))
        res = hs.static_checks(cfg, sheet)
        self.assertEqual([n for ok, n, _ in res if not ok], [], res)
        self.assertGreaterEqual(len(res), 4 + 4 * 2)
        a = sheet[..., 3] > 0
        self.assertFalse(a[:, :4].any() or a[:4].any())  # transparent around the figure
        for i, want in enumerate((110, 94)):
            ys, _ = np.nonzero(a[:, i * 128:(i + 1) * 128])
            self.assertEqual((ys.min(), ys.max()), (115 - want + 1, 115))
        # The outline is the shared outline colour, the palette at most 28 + outline.
        body = {tuple(c) for c in sheet[a][:, :3].tolist()} - {sv.OUTLINE}
        self.assertLessEqual(len(body), sv.COLOURS)
        self.assertIn(sv.OUTLINE, {tuple(c) for c in sheet[a][:, :3].tolist()})

    def test_the_build_is_deterministic(self):
        cfg = self.config()
        imgs = {"a": pine_image(), "b": pine_image(half=120, seed=1)}
        self.assertTrue(np.array_equal(hs.static_sheet(cfg, imgs), hs.static_sheet(cfg, imgs)))

    def test_a_figure_too_wide_for_its_cell_is_refused_not_cropped(self):
        cfg = self.config()
        with self.assertRaises(ValueError) as e:
            hs.static_sheet(cfg, {"a": pine_image(top=500, half=340), "b": pine_image()})
        self.assertIn("never crop", str(e.exception))

    def test_the_checks_catch_a_short_figure_a_hole_in_the_outline_and_a_floating_one(self):
        cfg = self.config()
        good = hs.static_sheet(cfg, {"a": pine_image(), "b": pine_image(half=120, seed=1)})
        names = lambda s: [n for ok, n, _ in hs.static_checks(cfg, s) if not ok]
        lifted = np.zeros_like(good)
        lifted[:-2] = good[2:]
        self.assertIn("a stands on the cell's ground row", names(lifted))
        holed = good.copy()
        ys, xs = np.nonzero(holed[:, :128, 3])
        holed[ys[0], xs[0], :3] = (200, 0, 0)
        self.assertIn("1 px outline on every silhouette edge", names(holed))
        cut = good.copy()
        cut[:30, :128] = 0
        self.assertIn("a height 110 px", names(cut))
        self.assertIn("sheet size", names(good[:, :128]))

    def test_static_build_writes_the_sheet_and_approval_files(self):
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "p", "views"))
        with open(os.path.join(tmp, "p", "asset.json"), "w") as fh:
            json.dump(BASE, fh)
        cfg = hs.load_config("p", reference=tmp)
        Image.fromarray(pine_image()).save(os.path.join(tmp, "p", "views", "a.png"))
        Image.fromarray(pine_image(half=120, seed=1)).save(os.path.join(tmp, "p", "views", "b.png"))
        out, appr = os.path.join(tmp, "sheet.png"), os.path.join(tmp, "appr")
        with contextlib.redirect_stdout(io.StringIO()):
            bad = hs.static_build(cfg, out=out, approval=appr, log=lambda *a, **k: None)
        self.assertEqual(bad, 0)
        self.assertEqual(sorted(os.listdir(appr)), ["check.txt", "contact.png", "sheet.png"])
        with open(out, "rb") as a, open(os.path.join(appr, "sheet.png"), "rb") as b:
            self.assertEqual(a.read(), b.read())
        self.assertEqual(Image.open(out).size, (256, 120))

    def test_the_pine_is_the_tree_card_at_the_hero_texel_and_its_prompts_are_current(self):
        cfg = hs.load_config("pine")
        self.assertEqual(cfg["type"], "static")
        self.assertEqual(cfg["world_height"], 40)  # yard_cards.js tree h
        root = hs.ROOT
        with open(os.path.join(root, "assets/js/yard_cards.js")) as fh:
            self.assertIn("tree: { w: 48, h: 40,", fh.read())
        self.assertEqual(cfg["height"], 110)
        self.assertEqual(cfg["cell"], [128, 120])
        self.assertEqual([v["id"] for v in cfg["variants"]], ["a", "b"])
        p = hs.build_prompts(cfg)
        with open(os.path.join(cfg["dir"], "prompts.json")) as fh:
            self.assertEqual(fh.read(), json.dumps(p, indent=1) + "\n")
        with open(os.path.join(cfg["dir"], "prompts.md")) as fh:
            self.assertEqual(fh.read(), hs.prompts_markdown(p))
        for c, v in zip(p["calls"], ("a", "b")):
            self.assertEqual(c["tool"], "GenerateImage")
            self.assertEqual(c["save_as"], f"assets/reference/pine/views/{v}.png")
            self.assertEqual(c["args"]["reference_image_paths"],
                             ["assets/reference/pine/concept.png", "assets/reference/engineer/video/views/v-S.png"])
            d = c["args"]["description"]
            for phrase in ("Plain flat white background", "nothing cropped", "One single pine tree only",
                           "draw only the single pine tree"):
                self.assertIn(phrase, d)
        concept = np.asarray(Image.open(os.path.join(cfg["dir"], "concept.png")))
        self.assertEqual(concept.shape[:2], (720 - 536, 392 - 278))


if __name__ == "__main__":
    unittest.main()
