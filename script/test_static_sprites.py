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
               {"variants": [{"id": "a", "colour": "red"}]}, {"variants": [{"id": "a", "pick": "middle"}]},
               {"variants": [{"id": "a", "squash_of": "a"}]}, {"variants": [{"id": "a", "squash_of": "z"}]},
               {"variants": [{"id": "a"}, {"id": "b", "squash_of": "a"}, {"id": "c", "squash_of": "b"}]},
               {"view": "top"}]
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

    def test_pick_keeps_one_figure_of_a_pair_and_drops_specks(self):
        big = pine_image(half=120)
        small = pine_image(top=300, half=70, seed=2)
        pair = np.full((720, 1440, 3), 255, np.uint8)
        pair[:, :720], pair[:, 720:] = big, small
        pair[20:24, 1400:1404] = 0  # a speck at the far right is not a figure
        cfg = self.config(variants=[{"id": "a", "pick": "left"}, {"id": "b", "pick": "right"}])
        _, left = hs.static_cut(pair, 110, "left")
        _, right = hs.static_cut(pair, 110, "right")
        _, alone = hs.static_cut(small, 110)
        self.assertEqual(right.shape, alone.shape)  # the right tree, cut as if it were alone
        self.assertEqual(left.shape, hs.static_cut(big, 110)[1].shape)
        sheet = hs.static_sheet(cfg, {"a": pair, "b": pair})
        self.assertEqual([n for ok, n, _ in hs.static_checks(cfg, sheet) if not ok], [])
        # Without a pick the pair is two pieces and too wide for the cell.
        with self.assertRaises(ValueError):
            hs.static_sheet(self.config(), {"a": pair, "b": pair})

    def test_the_pine_b_variant_is_picked_from_the_committed_pair(self):
        cfg = hs.load_config("pine")
        b = cfg["variants"][1]
        self.assertEqual((b["id"], b["pick"], b["scale"]), ("b", "right", 0.85))
        for word in ("younger", "narrower"):  # contrast wording made the model draw pairs
            self.assertNotIn(word, b["note"])
        from scipy import ndimage
        raw = np.asarray(Image.open(os.path.join(cfg["dir"], "views", "b.png")).convert("RGB"))
        self.assertGreaterEqual(ndimage.label(sv.cut_out(raw))[1], 2)  # the raw pair, not a hand crop
        with open(os.path.join(hs.ROOT, "priv/static/images/hd2d/pine-sheet.png"), "rb") as fh:
            committed = fh.read()
        tmp = tempfile.mkdtemp()
        out = os.path.join(tmp, "s.png")
        bad = hs.static_build(cfg, out=out, approval=os.path.join(tmp, "a"), log=lambda *a, **k: None)
        self.assertEqual(bad, 0)
        with open(out, "rb") as fh:
            self.assertEqual(fh.read(), committed)

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

    def test_the_building_pieces_match_their_cards_and_their_prompts_are_current(self):
        import re
        with open(os.path.join(hs.ROOT, "assets/js/yard_cards.js")) as fh:
            cards = {k: (int(w), int(h)) for k, w, h in re.findall(r"(\w+): \{ w: (\d+), h: (\d+),", fh.read())}
        want = {"wall": 40, "stone_wall": 40, "tower": 48, "house": 64, "forge": 36, "trap": 20}
        for name, wh in want.items():
            cfg = hs.load_config(name)
            self.assertEqual(cfg["type"], "static", name)
            self.assertEqual(cfg["world_height"], wh, name)
            if name in cards:  # stone_wall has no card: it falls back to the wall's 40
                self.assertEqual(cards[name][1], wh, name)
            self.assertEqual(cfg["height"], hs.sheet_height(wh), name)
            # The cell holds the card's width at the hero texel with the margins.
            w = cards.get(name, cards["wall"])[0]
            self.assertGreaterEqual(cfg["cell"][0], hs.sheet_height(w) + 2 * hs.STATIC_MARGIN, name)
            p = hs.build_prompts(cfg)
            with open(os.path.join(cfg["dir"], "prompts.json")) as fh:
                self.assertEqual(fh.read(), json.dumps(p, indent=1) + "\n", name)
            with open(os.path.join(cfg["dir"], "prompts.md")) as fh:
                self.assertEqual(fh.read(), hs.prompts_markdown(p), name)
            for c in p["calls"]:
                self.assertIn(f"One single {cfg['noun']} only", c["args"]["description"], name)
            box = cfg["concept"]["box"]
            concept = np.asarray(Image.open(os.path.join(cfg["dir"], "concept.png")))
            self.assertEqual(concept.shape[:2], (box[3] - box[1], box[2] - box[0]), name)
        trap = hs.load_config("trap")
        self.assertEqual([hs.static_height(trap, v) for v in trap["variants"]], [55, 33])

    def test_squash_of_builds_a_variant_from_another_without_an_image_or_a_prompt(self):
        cfg = self.config(variants=[{"id": "a"}, {"id": "b", "squash_of": "a", "scale": 0.6}])
        self.assertEqual([c["id"] for c in hs.static_prompts(cfg)["calls"]], ["image-a"])
        sheet = hs.static_sheet(cfg, {"a": pine_image()})
        self.assertEqual([n for ok, n, _ in hs.static_checks(cfg, sheet) if not ok], [])
        a = sheet[..., 3] > 0
        wa = np.nonzero(a[:, :128].any(0))[0]
        wb = np.nonzero(a[:, 128:].any(0))[0]
        self.assertEqual(len(wa), len(wb))  # same width: only the height is squashed
        hb = np.nonzero(a[:, 128:].any(1))[0]
        self.assertEqual(len(hb), 66)

    def test_the_view_key_sets_the_camera_wording_and_front_stays_the_default(self):
        front = hs.static_prompts(self.config())["calls"][0]["args"]["description"]
        self.assertIn("seen from the front at the game's camera angle, slightly from above.", front)
        tq = hs.static_prompts(self.config(view="three_quarter"))["calls"][0]["args"]["description"]
        self.assertIn("three-quarter view with one corner toward the camera", tq)
        self.assertNotIn("seen from the front", tq)

    def test_every_committed_static_sheet_rebuilds_byte_for_byte(self):
        views = {"pine": "front", "stone_wall": "front", "wall": "three_quarter", "tower": "three_quarter",
                 "house": "three_quarter", "forge": "three_quarter", "trap": "three_quarter",
                 "bush": "three_quarter", "rock": "three_quarter", "flowers": "three_quarter",
                 "broadleaf": "front", "field": "three_quarter", "forest_barrier": "front",
                 "stump_log": "three_quarter", "cliff_face": "front", "grass_tufts": "three_quarter",
                 "reeds": "three_quarter", "dead_tree": "front",
                 "ruin_stones": "three_quarter", "map_table": "three_quarter",
                 "quarry": "three_quarter", "camp": "three_quarter", "shrine": "three_quarter"}
        for name, view in views.items():
            cfg = hs.load_config(name)
            self.assertEqual(cfg.get("view", "front"), view, name)
            tmp = tempfile.mkdtemp()
            out = os.path.join(tmp, "s.png")
            self.assertEqual(hs.static_build(cfg, out=out, approval=os.path.join(tmp, "a"), log=lambda *a, **k: None), 0, name)
            with open(out, "rb") as a, open(os.path.join(hs.ROOT, f"priv/static/images/hd2d/{name}-sheet.png"), "rb") as b:
                self.assertEqual(a.read(), b.read(), name)
        trap = hs.load_config("trap")
        self.assertEqual(trap["variants"][1]["squash_of"], "a")
        self.assertFalse(os.path.exists(os.path.join(trap["dir"], "views", "b.png")))

    def test_the_flora_pieces_are_set_up_and_their_prompts_are_current(self):
        want = {"bush": (14, 3), "rock": (16, 3), "flowers": (6, 2)}
        for name, (wh, n) in want.items():
            cfg = hs.load_config(name)
            self.assertEqual((cfg["world_height"], len(cfg["variants"])), (wh, n), name)
            self.assertLess(wh, 32, name)  # under a hero, so heroes read over it
            self.assertGreaterEqual(cfg["cell"][1], cfg["height"] + 2 * hs.STATIC_MARGIN, name)
            p = hs.build_prompts(cfg)
            self.assertEqual(len(p["calls"]), n, name)
            with open(os.path.join(cfg["dir"], "prompts.json")) as fh:
                self.assertEqual(fh.read(), json.dumps(p, indent=1) + "\n", name)

        # Sizes come from scale, not from the generated image: rock c is drawn
        # small though its view filled the frame like a and b.
        rock = hs.load_config("rock")
        hs_ = [hs.static_height(rock, v) for v in rock["variants"]]
        self.assertEqual(hs_, sorted(hs_, reverse=True))
        self.assertLessEqual(hs_[2], hs_[0] * 0.55)

    def test_match_scales_saturation_and_value_to_the_reference_means(self):
        rng = np.random.default_rng(3)
        rgb = rng.integers(60, 250, (20, 20, 3), dtype=np.uint8)
        keep = np.ones((20, 20), bool)
        keep[:5] = False
        target = (120.0, 50.0)
        out = hs.match_hsv([(rgb, keep), (rgb, keep)], target)
        s, v = hs.hsv_means(np.concatenate([o for o, _ in out]), np.concatenate([k for _, k in out]))
        self.assertLess(abs(s - target[0]), 3)
        self.assertLess(abs(v - target[1]), 2)
        self.assertTrue(np.array_equal(out[0][0], hs.match_hsv([(rgb, keep)], target)[0][0]))
        for m in ("no such", 3, "p"):  # "p" is the piece itself
            with self.assertRaises(SystemExit, msg=m):
                self.config(match=m)

    def test_the_bush_matches_the_pine_sheet_and_the_built_flora_stands_small(self):
        bush = hs.load_config("bush")
        self.assertEqual(bush["match"], "pine")
        sheet = lambda n: np.asarray(Image.open(os.path.join(hs.ROOT, f"priv/static/images/hd2d/{n}-sheet.png")).convert("RGBA"))
        ps, pv = hs.sheet_hsv_means(sheet("pine"))
        bs, bv = hs.sheet_hsv_means(sheet("bush"))
        # The palette quantize moves the means a little off the pine's.
        self.assertLess(abs(bs - ps), 8)
        self.assertLess(abs(bv - pv), 6)
        for name in ("bush", "rock", "flowers"):
            cfg = hs.load_config(name)
            self.assertEqual([n for ok, n, _ in hs.static_checks(cfg, sheet(name)) if not ok], [], name)

    def test_the_terrain_and_scenery_pieces_are_set_up_and_their_prompts_are_current(self):
        # name: (world height, variants, drawn from text with only the concept's palette)
        want = {"broadleaf": (40, 2, False), "field": (12, 2, False), "forest_barrier": (32, 2, False),
                "stump_log": (10, 2, True), "cliff_face": (16, 2, True), "grass_tufts": (5, 3, False),
                "reeds": (9, 2, True), "dead_tree": (36, 1, True)}
        for name, (wh, n, text_only) in want.items():
            cfg = hs.load_config(name)
            self.assertEqual(cfg["type"], "static", name)
            self.assertEqual((cfg["world_height"], len(cfg["variants"])), (wh, n), name)
            self.assertLessEqual(wh, 40, name)  # no scenery piece outgrows the pine
            self.assertGreaterEqual(cfg["cell"][1], cfg["height"] + 2 * hs.STATIC_MARGIN, name)
            self.assertEqual(cfg["concept"]["source"], "docs/concept/theme.jpg", name)
            box = cfg["concept"]["box"]
            concept = np.asarray(Image.open(os.path.join(cfg["dir"], "concept.png")))
            self.assertEqual(concept.shape[:2], (box[3] - box[1], box[2] - box[0]), name)
            p = hs.build_prompts(cfg)
            self.assertEqual(len(p["calls"]), n, name)
            with open(os.path.join(cfg["dir"], "prompts.json")) as fh:
                self.assertEqual(fh.read(), json.dumps(p, indent=1) + "\n", name)
            with open(os.path.join(cfg["dir"], "prompts.md")) as fh:
                self.assertEqual(fh.read(), hs.prompts_markdown(p), name)
            for c in p["calls"]:
                d = c["args"]["description"]
                self.assertIn(f"One single {cfg['noun']} only", d, name)
                self.assertEqual("The reference shows no " in d, text_only, name)
        # Greens are matched to the pine forest, as the bush is.
        for name in ("broadleaf", "forest_barrier", "grass_tufts", "reeds"):
            self.assertEqual(hs.load_config(name)["match"], "pine", name)

    def test_framing_replaces_the_upright_sentence_and_pending_variants_wait_outside_the_sheet(self):
        cfg = self.config(variants=[{"id": "a"}, {"id": "b", "framing": "the whole log lying flat along the ground",
                                                  "pending": True}])
        a, b = [c["args"]["description"] for c in hs.static_prompts(cfg)["calls"]]
        self.assertIn("from its top to the ground it stands on, upright", a)
        self.assertNotIn("upright", b)
        self.assertIn("The whole log lying flat along the ground.", b)
        # b's image does not exist: the build leaves b out instead of refusing.
        os.makedirs(os.path.join(cfg["dir"], "views"))
        Image.fromarray(pine_image()).save(os.path.join(cfg["dir"], "views", "a.png"))
        tmp = tempfile.mkdtemp()
        out = os.path.join(tmp, "s.png")
        self.assertEqual(hs.static_build(cfg, out=out, approval=os.path.join(tmp, "x"), log=lambda *a, **k: None), 0)
        self.assertEqual(Image.open(out).size, (128, 120))
        for bad in ([{"id": "a", "pending": True}], [{"id": "a", "pending": "yes"}], [{"id": "a", "framing": 3}],
                    [{"id": "a", "pending": True}, {"id": "b", "squash_of": "a"}]):
            with self.assertRaises(SystemExit, msg=bad):
                self.config(variants=bad)

    def test_the_lying_log_has_its_own_framing_and_the_built_scenery_stands_on_its_foot_row(self):
        log = hs.load_config("stump_log")
        b = log["variants"][1]
        self.assertNotIn("pending", b)  # take 3 lies flat
        d = hs.static_prompts(log)["calls"][1]["args"]["description"]
        self.assertIn("lying flat along the ground, much longer than it is tall", d)
        self.assertNotIn("upright, centred", d)
        sizes = {"broadleaf": [110, 94], "field": [33, 33], "forest_barrier": [88, 88], "stump_log": [28, 28],
                 "cliff_face": [44, 44], "grass_tufts": [14, 11, 9], "reeds": [25, 20], "dead_tree": [99]}
        for name, want in sizes.items():
            cfg = hs.load_config(name)
            sheet = np.asarray(Image.open(os.path.join(hs.ROOT, f"priv/static/images/hd2d/{name}-sheet.png")).convert("RGBA"))
            cw, ch = cfg["cell"]
            self.assertEqual(sheet.shape[:2], (ch, cw * len(want)), name)
            got = []
            for i in range(len(want)):
                rows = np.nonzero((sheet[:, i * cw:(i + 1) * cw, 3] > 0).any(1))[0]
                self.assertEqual(rows[-1], ch - 1 - hs.STATIC_MARGIN, name)
                got.append(int(rows[-1] - rows[0] + 1))
            self.assertEqual(got, want, name)
            built = dict(cfg, variants=[v for v in cfg["variants"] if not v.get("pending")])
            self.assertEqual([n for ok, n, _ in hs.static_checks(built, sheet) if not ok], [], name)


# Pieces prepped with no generated image yet. Heights are the world units in
# asset.json; the batch lists every GenerateImage call for them.
UNBUILT = {
    "ruin_stones": {"world_height": 20, "cell": [200, 64], "variants": ["a", "b", "c"],
                    "box": [640, 100, 688, 164]},
    "map_table": {"world_height": 16, "cell": [160, 56], "variants": ["a"],
                  "box": [740, 220, 840, 315]},
    "quarry": {"world_height": 32, "cell": [176, 96], "variants": ["a", "b"],
               "box": [620, 610, 720, 690]},
    "camp": {"world_height": 28, "cell": [160, 88], "variants": ["a"],
             "box": [519, 488, 619, 581]},
    "shrine": {"world_height": 24, "cell": [96, 80], "variants": ["a"],
               "box": [640, 100, 688, 164]},
}
ART_ROOT = "/workspace/lk-art-redo"


def unbuilt_batch():
    """The combined GenerateImage list. Paths are absolute under ART_ROOT,
    and save_as is the file the build reads."""
    calls = []
    for name in UNBUILT:
        for call in hs.static_prompts(hs.load_config(name))["calls"]:
            args = json.loads(json.dumps(call["args"]))
            args["reference_image_paths"] = [os.path.join(ART_ROOT, p) for p in args["reference_image_paths"]]
            calls.append({"id": f"{name}-{call['id']}", "asset": name, "tool": "GenerateImage",
                          "args": args, "save_as": os.path.join(ART_ROOT, call["save_as"])})
    return {"_note": "GenerateImage calls for the unbuilt static pieces. Paths are absolute under "
            "/workspace/lk-art-redo. save_as is the file `hero_sprites.py <asset> build` reads.",
            "calls": calls}


class UnbuiltStaticTest(unittest.TestCase):
    def test_the_remaining_static_pieces_keep_their_prompts(self):
        style = ["assets/reference/engineer/video/views/v-S.png"]
        for name, want in UNBUILT.items():
            cfg = hs.load_config(name)
            self.assertEqual(cfg["type"], "static", name)
            self.assertEqual(cfg.get("view"), "three_quarter", name)
            self.assertEqual(cfg["world_height"], want["world_height"], name)
            self.assertEqual(cfg["height"], hs.sheet_height(want["world_height"]), name)
            self.assertEqual(cfg["cell"], want["cell"], name)
            self.assertEqual([v["id"] for v in cfg["variants"]], want["variants"], name)
            self.assertEqual(cfg["concept"]["box"], want["box"], name)
            self.assertEqual(cfg["concept"]["source"], "docs/concept/theme.jpg", name)
            self.assertEqual(cfg["style_refs"], style, name)
            self.assertTrue(cfg["source_note"].startswith("The reference shows no "), name)
            with Image.open(os.path.join(cfg["dir"], "concept.png")) as image:
                concept = np.asarray(image)
            box = want["box"]
            self.assertEqual(concept.shape[:2], (box[3] - box[1], box[2] - box[0]), name)
            p = hs.build_prompts(cfg)
            self.assertEqual(len(p["calls"]), len(want["variants"]), name)
            with open(os.path.join(cfg["dir"], "prompts.json")) as fh:
                self.assertEqual(fh.read(), json.dumps(p, indent=1) + "\n", name)
            with open(os.path.join(cfg["dir"], "prompts.md")) as fh:
                self.assertEqual(fh.read(), hs.prompts_markdown(p), name)
            for call, vid in zip(p["calls"], want["variants"]):
                self.assertEqual(call["save_as"], f"assets/reference/{name}/views/{vid}.png", name)
                self.assertIn(f"One single {cfg['noun']} only", call["args"]["description"], name)
                self.assertIn("The reference shows no ", call["args"]["description"], name)
            sheet = os.path.join(hs.ROOT, f"priv/static/images/hd2d/{name}-sheet.png")
            self.assertTrue(os.path.exists(sheet), name)

        ruin = hs.load_config("ruin_stones")
        self.assertEqual([v.get("scale", 1) for v in ruin["variants"]], [1, 0.55, 0.5])
        column = hs.static_prompts(ruin)["calls"][1]["args"]["description"]
        self.assertIn("lying flat along the ground", column)
        self.assertNotIn("upright, centred", column)
        table = hs.static_prompts(hs.load_config("map_table"))["calls"][0]["args"]["description"]
        self.assertIn("no map", table)
        shrine = hs.static_prompts(hs.load_config("shrine"))["calls"][0]["args"]["description"]
        self.assertIn("no relic", shrine)

    def test_the_static_batch_lists_every_call_with_absolute_paths(self):
        path = os.path.join(hs.ROOT, "assets/reference/static-batch-2.json")
        with open(path) as fh:
            batch = json.load(fh)
        want = unbuilt_batch()
        self.assertEqual(batch, want)
        self.assertEqual(len(batch["calls"]), 8)
        for call in batch["calls"]:
            self.assertEqual(call["tool"], "GenerateImage")
            for ref in call["args"]["reference_image_paths"]:
                self.assertTrue(ref.startswith(ART_ROOT + "/"), ref)
                self.assertTrue(os.path.exists(os.path.join(hs.ROOT, ref[len(ART_ROOT) + 1:])), ref)
            self.assertTrue(call["save_as"].startswith(ART_ROOT + "/assets/reference/"))
            self.assertTrue(call["save_as"].endswith(".png"))


if __name__ == "__main__":
    unittest.main()
