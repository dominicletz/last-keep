#!/usr/bin/env python3
"""Local tests for script/hero_sprites.py: python3 script/test_hero_sprites.py

Runs on the committed warrior and mage inputs; the precheck test builds a
mage sheet in memory twice, so the whole file takes about two minutes."""

import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_sprites as hs  # noqa: E402

HEROES = ["engineer", "farmer", "mage", "scout", "warrior"]
ASSETS = ["goblin", "skeleton"]  # non-hero figures with an asset.json (docs/ART-REDO.md)
APPROVED = {"mage": {"SW": 46, "NW": 67, "NE": 122, "SE": 156},
            "warrior": {"SW": 20, "NW": 74, "NE": 122, "SE": 166},
            "scout": {"SW": 32, "NW": 72, "NE": 120, "SE": 164},
            "farmer": {"SW": 42, "NW": 82, "NE": 117, "SE": 158},
            "engineer": {"SW": 30, "NW": 70, "NE": 118, "SE": 154}}


def png_bytes(arr):
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def read(path):
    with open(path, "rb") as fh:
        return fh.read()


class ConfigTest(unittest.TestCase):
    def test_every_hero_config_loads_and_names_its_items(self):
        for h in HEROES:
            cfg = hs.load_config(h)
            self.assertIn(cfg["possessive"], ("his", "her", "their"), h)
            self.assertTrue(cfg["items"], h)
            for item in cfg["items"]:
                self.assertTrue(item["name"] and item["at"], (h, item))
                for d in item.get("sides", {}):
                    self.assertIn(d, hs.COLUMNS, (h, item))
            self.assertLessEqual(set(cfg.get("diagonals") or {}), set(hs.DIAGONALS), h)
            c = cfg["concept"]
            self.assertTrue("file" in c or ("source" in c and len(c["box"]) == 4), h)

    def test_approved_heroes_pin_their_diagonals(self):
        for h, pins in APPROVED.items():
            self.assertEqual(hs.load_config(h)["diagonals"], pins)


class ConceptAndViewsTest(unittest.TestCase):
    def test_concept_crop_reproduces_the_mage_concept(self):
        cfg = hs.load_config("mage")
        c = cfg["concept"]
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, c["source"])).convert("RGB").crop(tuple(c["box"])))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_view_normalization_reproduces_the_mage_keyframes_byte_for_byte(self):
        cfg = hs.load_config("mage")
        for d in hs.CARDINALS:
            src = hs.view_source(cfg, d)
            self.assertIsNotNone(src, d)
            out = hs.normalize_view(np.asarray(Image.open(src).convert("RGB")))
            self.assertEqual(png_bytes(out), read(os.path.join(cfg["video"], "views", f"k-{d}.png")), d)

    def test_view_normalization_blanks_a_stray_speck_outside_the_figure(self):
        img = np.full((400, 400, 3), 255, np.uint8)
        img[100:300, 150:250] = (40, 60, 120)
        clean = hs.normalize_view(img)
        img[10:14, 10:14] = 0
        out = hs.normalize_view(img)
        self.assertTrue(np.array_equal(out, clean))
        ys, xs = np.nonzero(out.min(2) < hs.VIEW_MIN)
        self.assertEqual((ys.min(), ys.max() + 1), (hs.VIEW_FEET - hs.VIEW_HEIGHT, hs.VIEW_FEET))


class DirsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames = {h: hs.sv.run_ffmpeg_frames(os.path.join(hs.load_config(h)["video"], "turntable.mp4"))
                      for h in APPROVED}

    def cards(self, h):
        dirs = os.path.join(hs.load_config(h)["video"], "dirs")
        return {d: np.asarray(Image.open(os.path.join(dirs, f"{d}.png")).convert("RGB")) for d in hs.CARDINALS}

    def test_picker_lands_near_the_hand_picked_diagonals(self):
        # mage SW 46 is the approved pick; SE 156 was picked by eye over a
        # clean front-right 3/4 at 162. Warrior picks came from an older eye pass; scout, farmer and engineer picks are Dominic's.
        # The engineer SE pick is 16 frames before the picker's 170, where the planks vanish and the view is too frontal.
        slack = {"mage": {"SW": 2, "NW": 12, "NE": 12, "SE": 8},
                 "warrior": {"SW": 10, "NW": 6, "NE": 6, "SE": 10},
                 "scout": {"SW": 6, "NW": 8, "NE": 6, "SE": 6},
                 "farmer": {"SW": 8, "NW": 4, "NE": 4, "SE": 10},
                 "engineer": {"SW": 0, "NW": 0, "NE": 0, "SE": 16}}
        for h in APPROVED:
            cfg = hs.load_config(h)
            picked = hs.pick_diagonals(self.frames[h], self.cards(h), hs.key_frames(cfg, len(self.frames[h])))
            for d, t in APPROVED[h].items():
                self.assertLessEqual(abs(picked[d]["frame"] - t), slack[h][d], (h, d, picked[d]))
                a, b = hs.DIAGONALS[d]
                lo = hs.key_frames(cfg, 193)[a]
                self.assertGreater(picked[d]["frame"], lo, (h, d))

    def test_pinned_frames_reproduce_the_committed_diagonals_byte_for_byte(self):
        for h, pins in APPROVED.items():
            dirs = os.path.join(hs.load_config(h)["video"], "dirs")
            for d, t in pins.items():
                self.assertEqual(png_bytes(self.frames[h][t]), read(os.path.join(dirs, f"{d}.png")), (h, d))


class PromptsTest(unittest.TestCase):
    def calls(self, h):
        return {c["id"]: c for c in hs.build_prompts(hs.load_config(h))["calls"]}

    def test_every_hero_gets_views_turntable_walk_and_idle_calls(self):
        for h in HEROES:
            ids = list(self.calls(h))
            self.assertEqual(ids[:5], ["view-S", "view-N", "view-W", "view-E", "turntable"], h)
            self.assertEqual(sorted(ids[5:]), sorted(f"{k}-{d}" for d in hs.COLUMNS for k in ("walk", "idle")), h)

    def test_view_prompts_name_the_hand_and_the_image_side(self):
        c = self.calls("scout")
        self.assertIn("longbow in their right hand (on the image-left side)", c["view-S"]["args"]["description"])
        self.assertIn("longbow in their right hand (partly hidden behind the body)", c["view-W"]["args"]["description"])
        self.assertIn("longbow in their right hand (on the image-right side)", c["view-N"]["args"]["description"])
        self.assertIn("spyglass at their left hip (on the image-right side)", c["view-S"]["args"]["description"])
        self.assertIn("One single view only", c["view-E"]["args"]["description"])
        self.assertEqual(c["view-S"]["args"]["reference_image_paths"], ["assets/reference/scout/concept.png"])

    def test_mage_staff_sides_follow_the_override(self):
        c = self.calls("mage")
        self.assertIn("(on the image-left side)", c["walk-NW"]["args"]["prompt"])
        self.assertIn("(on the image-right side)", c["walk-SE"]["args"]["prompt"])

    def test_farmer_pitchfork_sides_match_the_clips(self):
        c = self.calls("farmer")
        self.assertIn("pitchfork with iron tines in his right hand (in front of the body, on the image-left side)",
                      c["walk-W"]["args"]["prompt"])
        self.assertIn("pitchfork with iron tines in his right hand (on the image-right side)", c["walk-SE"]["args"]["prompt"])
        self.assertIn("pitchfork with iron tines in his right hand (on the image-right side)", c["walk-E"]["args"]["prompt"])

    def test_engineer_hammer_and_plank_sides_match_the_clips(self):
        c = self.calls("engineer")
        self.assertIn("iron hammer in his right hand (low in front of the legs, on the image-left side)",
                      c["walk-W"]["args"]["prompt"])
        self.assertIn("iron hammer in his right hand (partly hidden behind the body)", c["walk-NW"]["args"]["prompt"])
        self.assertIn("iron hammer in his right hand (toward the camera)", c["walk-E"]["args"]["prompt"])
        self.assertIn("bundle of wooden planks on his back (toward the camera, on the image-left side)",
                      c["walk-N"]["args"]["prompt"])
        self.assertIn("bundle of wooden planks on his back (on the image-left side, partly hidden behind the body)",
                      c["walk-SE"]["args"]["prompt"])

    def test_turntable_design_can_name_the_held_items(self):
        turn = self.calls("engineer")["turntable"]["args"]["prompt"]
        self.assertIn("brown boots, iron hammer held low in his right hand, bundle of wooden planks on his back.", turn)
        view = self.calls("engineer")["view-S"]["args"]["description"]
        self.assertNotIn("hammer held low", view)
        scout = hs.load_config("scout")["design"]
        self.assertIn(scout, self.calls("scout")["turntable"]["args"]["prompt"])

    def test_walk_and_idle_prompts_carry_the_lessons(self):
        for h in HEROES:
            c = self.calls(h)
            for d in hs.COLUMNS:
                walk, idle = c[f"walk-{d}"]["args"], c[f"idle-{d}"]["args"]
                self.assertIn("torso does not twist", walk["prompt"])
                self.assertIn("No flashing, glowing or pulsing light", idle["prompt"])
                self.assertIn("head does not turn", idle["prompt"])
                for a in (walk, idle):
                    self.assertEqual(a["image_path"], a["last_frame_path"])
                    self.assertEqual(a["image_path"], f"assets/reference/{h}/video/dirs/{d}.png")
                    self.assertEqual(a["duration"], 2)
        self.assertIn("the cyan crystal keeps exactly the same brightness", self.calls("mage")["idle-E"]["args"]["prompt"])

    def test_turntable_call_uses_the_keyframes(self):
        a = self.calls("scout")["turntable"]["args"]
        self.assertEqual(a["image_path"], "assets/reference/scout/video/views/k-S.png")
        self.assertEqual(a["last_frame_path"], a["image_path"])
        self.assertEqual([(k["image_path"][-7:], k["timestamp_s"]) for k in a["keyframes"]],
                         [("k-W.png", 2), ("k-N.png", 4), ("k-E.png", 6)])
        self.assertEqual((a["duration"], a["resolution"]), (8, "720p"))

    def test_committed_prompt_files_are_current(self):
        for h in HEROES + ASSETS:
            cfg = hs.load_config(h)
            p = hs.build_prompts(cfg)
            self.assertEqual(read(os.path.join(cfg["dir"], "prompts.json")).decode(), json.dumps(p, indent=1) + "\n", h)
            self.assertEqual(read(os.path.join(cfg["dir"], "prompts.md")).decode(), hs.prompts_markdown(p), h)


class AssetTest(unittest.TestCase):
    """Non-hero figures: the goblin is the first (docs/ART-REDO.md)."""

    def calls(self, a):
        return {c["id"]: c for c in hs.build_prompts(hs.load_config(a))["calls"]}

    def test_goblin_config_is_a_monster_with_its_clip_kinds(self):
        cfg = hs.load_config("goblin")
        self.assertEqual(cfg["type"], "monster")
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})
        for h in HEROES:
            self.assertEqual(hs.load_config(h)["type"], "hero", h)
            self.assertEqual(hs.load_config(h)["clips"], {"walk": hs.COLUMNS, "idle": hs.COLUMNS}, h)

    def test_goblin_sheet_keeps_the_hero_texel(self):
        # monsters.js draws the goblin 18 world units tall; at 32/88 units per
        # texel that is 50 px, so the goblin's pixels are the hero's size.
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"goblin: (\d+)", fh.read()).group(1))
        sheet = hs.load_config("goblin")["sheet"]
        self.assertEqual(sheet["world_height"], world)
        self.assertEqual(sheet["height"], hs.sheet_height(world))
        self.assertEqual(hs.sheet_height(32), 88)

    def test_goblin_calls_are_views_turntable_then_walk_attack_death(self):
        ids = list(self.calls("goblin"))
        self.assertEqual(ids[:5], ["view-S", "view-N", "view-W", "view-E", "turntable"])
        want = [f"{k}-{d}" for d in hs.COLUMNS for k in ("walk", "attack", "death")
                if k != "death" or d in hs.CARDINALS]
        self.assertEqual(ids[5:], want)
        self.assertNotIn("idle-S", ids)

    def test_goblin_front_view_takes_the_hero_style_reference(self):
        c = self.calls("goblin")
        s = c["view-S"]["args"]
        self.assertEqual(s["reference_image_paths"], ["assets/reference/goblin/concept.png",
                                                      "assets/reference/engineer/video/views/v-S.png"])
        for ref in s["reference_image_paths"]:
            self.assertTrue(os.path.exists(os.path.join(hs.ROOT, ref)), ref)
        self.assertIn("draw only one goblin", s["description"])
        self.assertIn("Match the rendering style of the second reference image", s["description"])
        self.assertIn("to the feet,", s["description"])
        w = c["view-W"]["args"]
        self.assertEqual(w["reference_image_paths"], ["assets/reference/goblin/concept.png",
                                                      "assets/reference/goblin/video/views/v-S.png"])
        self.assertNotIn("rendering style", w["description"])

    def test_goblin_attack_and_death_prompts(self):
        c = self.calls("goblin")
        attack, death = c["attack-E"]["args"], c["death-N"]["args"]
        self.assertIn("jabs the spear straight ahead", attack["prompt"])
        self.assertIn("returns exactly to the starting pose", attack["prompt"])
        self.assertIn("torso does not twist", attack["prompt"])
        self.assertEqual(attack["image_path"], attack["last_frame_path"])
        self.assertEqual(death["image_path"], "assets/reference/goblin/video/dirs/N.png")
        self.assertNotIn("last_frame_path", death)
        self.assertIn("lies still on the ground", death["prompt"])
        self.assertIn("Quick hunched goblin walk", c["walk-S"]["args"]["prompt"])
        self.assertEqual(c["attack-SE"].get("then"), "hero_sprites.py precheck")
        self.assertEqual([k for k, v in c.items() if v.get("then") == "hero_sprites.py precheck"], ["attack-SE"])

    def test_view_notes_add_one_sentence_to_one_view(self):
        # The E view was regenerated with this sentence after the first take
        # lost the spear; prompts.json must say what was sent.
        cfg = hs.load_config("goblin")
        note = cfg["view_notes"]["E"]
        c = self.calls("goblin")
        e = c["view-E"]["args"]["description"]
        self.assertIn("(toward the camera). " + note + " Whole figure", e)
        for d in ("S", "N", "W"):
            self.assertNotIn(note, c[f"view-{d}"]["args"]["description"], d)
        self.assertEqual(sum(note in json.dumps(v) for v in c.values()), 1)
        for h in HEROES:
            self.assertNotIn("view_notes", hs.load_config(h), h)

    def test_skeleton_sheet_keeps_the_hero_texel_in_a_wider_cell(self):
        # monsters.js draws the skeleton 22 world units tall: 60 px at the hero
        # texel (docs/ART-REDO.md). The 88 px cell leaves room for the slash.
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"skeleton: (\d+)", fh.read()).group(1))
        cfg = hs.load_config("skeleton")
        self.assertEqual(cfg["type"], "monster")
        self.assertEqual(cfg["sheet"], {"world_height": world, "height": 60, "cell": 88})
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})

    def test_skeleton_concept_is_the_registry_crop(self):
        cfg = hs.load_config("skeleton")
        with open(os.path.join(hs.ROOT, "assets/models/registry.js")) as fh:
            x, y, w, h = map(int, re.search(r'monster\("skeleton", \d+, \d+, crop\((\d+), (\d+), (\d+), (\d+)\)\)',
                                            fh.read()).groups())
        self.assertEqual(cfg["concept"]["box"], [x, y, x + w, y + h])
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, cfg["concept"]["source"])).convert("RGB").crop((x, y, x + w, y + h)))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_a_visible_weapon_is_asked_for_in_every_view_and_never_hidden(self):
        # The goblin's first view-E lost its spear: an item with "visible": true
        # gets its own sentence in all four views, and no prompt places it
        # "partly hidden behind the body" (the W view would, by its hand).
        cfg = hs.load_config("skeleton")
        sword = cfg["items"][0]
        self.assertIs(sword["visible"], True)
        line = hs.visible_line(sword, "his")
        c = self.calls("skeleton")
        for d in ("S", "N", "W", "E"):
            self.assertIn(line, c[f"view-{d}"]["args"]["description"], d)
            self.assertIn("in full view)", c[f"view-{d}"]["args"]["description"], d)
        for k, v in c.items():
            self.assertNotIn("partly hidden", json.dumps(v), k)
        self.assertIn("(in full view)", c["view-W"]["args"]["description"])
        self.assertIn("slashes it across", c["attack-SW"]["args"]["prompt"])
        self.assertIn("heap of bones", c["death-E"]["args"]["prompt"])
        self.assertIn("no shield", c["view-S"]["args"]["description"])
        # Without the flag the W view still says where the hand hides it.
        plain = dict(sword)
        del plain["visible"]
        self.assertIn("partly hidden behind the body", hs.item_line(plain, "W", "his"))

    def test_skeleton_clip_overrides_reproduce_the_second_takes_exactly(self):
        # Nine skeleton clips failed the first precheck and were regenerated
        # with these phrase changes. prompts.json must be what was sent: each
        # overridden clip is the plain prompt with exactly these swaps, and
        # every other call is untouched.
        cfg = hs.load_config("skeleton")
        plain = dict(cfg)
        del plain["clip_overrides"]
        base = {c["id"]: c for c in hs.build_prompts(plain)["calls"]}
        got = self.calls("skeleton")
        gait = ("Stiff jerky skeleton march: knees bent,",
                "Stiff upright skeleton march at full standing height: knees only slightly bent, never crouching "
                "or lowering the body,")
        bob = ("slight body bob", "very slight body bob")
        nw = ("blade below his shoulders.", "blade below his shoulders, the blade clearly visible beside his body in "
              "every frame, never hanging straight down or hidden behind him.")
        e = ("sword held low and angled forward in his right hand, blade below his shoulders.",
             "sword held low and angled forward in front of his legs in his right hand the whole time, blade below "
             "his shoulders; the sword never swings back behind his legs.")
        slash = "raises the sword to his shoulder and slashes it across in front of him toward the facing direction"
        wide = (slash, "raises the sword to his shoulder and swings it in a big, wide, full-arm sweep far out in front "
                "of him toward the facing direction, the arm fully extended and the blade reaching well beyond his body")
        south = (slash, "raises the sword only to his shoulder, never above or in front of his head, so his skull stays "
                 "fully visible and uncovered the whole time, and slashes it across in front of his chest toward the "
                 "facing direction")
        fall = "drops the sword and collapses straight down into a loose heap of bones on the ground."
        heap = ("lets the sword drop beside its feet, and collapses straight down in place into a loose heap of bones "
                "on the exact spot where it stood. It does not leap, lunge, step or fall forward toward the camera; "
                "the bones pile up where its feet were.")
        swaps = {"walk-SW": [gait, bob], "walk-NW": [gait, bob, nw], "walk-E": [e],
                 "attack-E": [wide], "attack-W": [wide], "attack-NW": [wide], "attack-S": [south],
                 "death-S": [(fall, heap)], "death-W": [(fall, heap.replace(" toward the camera", ""))]}
        self.assertEqual(set(got), set(base))
        for cid, call in base.items():
            want = json.loads(json.dumps(call))
            for old, new in swaps.get(cid, []):
                self.assertEqual(want["args"]["prompt"].count(old), 1, (cid, old))
                want["args"]["prompt"] = want["args"]["prompt"].replace(old, new)
            self.assertEqual(got[cid], want, cid)
        self.assertEqual(sorted(k for k in cfg["clip_overrides"] if not k.startswith("_")), sorted(swaps))
        for h in HEROES + ["goblin"]:
            self.assertNotIn("clip_overrides", hs.load_config(h), h)

    def test_a_bad_clip_override_is_refused(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "skeleton", "asset.json")))
        bad = [{"death-SW": {"death": "falls"}}, {"walk-S": {"attack": "jabs"}}, {"walk-S": {"walk": "low"}},
               {"attack-S": {"attack": " "}}, {"walk-S": {}}, {"idle-S": {"gait": "x"}}, ["walk-S"]]
        for over in bad:
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(dict(base, clip_overrides=over), fh)
                with self.assertRaises(SystemExit, msg=over):
                    hs.load_config("g", reference=tmp)

    def test_visible_leaves_every_other_prompt_file_alone(self):
        for h in HEROES + ["goblin"]:
            cfg = hs.load_config(h)
            self.assertFalse(any("visible" in i for i in cfg["items"]), h)
            self.assertNotIn("stays clearly visible in full", read(os.path.join(cfg["dir"], "prompts.json")).decode(), h)

    def test_a_bad_asset_config_is_refused(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "goblin", "asset.json")))
        bad = [("type", "dragon"), ("clips", {"walk": ["S", "UP"]}), ("clips", {"attack": ["S"], "walk": ["S"]}),
               ("sheet", {"world_height": 18, "height": 60, "cell": 80}),
               ("sheet", {"world_height": 18, "height": 50, "cell": 60}),
               ("view_notes", {"SE": "a diagonal view is not generated"}), ("view_notes", {"E": " "}),
               ("view_notes", ["E"]),
               ("items", [{"name": "sword", "at": "right hand", "visible": "yes"}]),
               ("items", [{"name": "cloak", "at": "body", "visible": True}])]
        for key, value in bad:
            cfg = dict(base, **{key: value})
            if key == "clips" and "attack" in value:
                cfg.pop("attack")
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(cfg, fh)
                with self.assertRaises(SystemExit, msg=(key, value)):
                    hs.load_config("g", reference=tmp)
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "g"))
            with open(os.path.join(tmp, "g", "hero.json"), "w") as fh:
                json.dump(base, fh)
            with self.assertRaises(SystemExit):
                hs.load_config("g", reference=tmp)

    def test_prep_rewrites_nothing_on_the_committed_goblin(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "goblin"), os.path.join(tmp, "goblin"))
            cfg = hs.load_config("goblin", reference=tmp)
            log = []
            self.assertFalse(hs.crop_concept(cfg))
            hs.write_prompts(cfg, log=log.append)
            self.assertTrue(log and all(line.startswith("same ") for line in log), log)


class IdempotencyTest(unittest.TestCase):
    def test_prep_views_and_dirs_rewrite_nothing_on_the_committed_mage(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "mage"), os.path.join(tmp, "mage"))
            before = {f: read(os.path.join(dp, f)) for dp, _, fs in os.walk(tmp) for f in fs}
            cfg = hs.load_config("mage", reference=tmp)
            log = []
            hs.make_dirs(cfg, log=log.append)
            hs.write_prompts(cfg, log=log.append)
            self.assertTrue(log and all(line.startswith("same ") for line in log), log)
            after = {f: read(os.path.join(dp, f)) for dp, _, fs in os.walk(tmp) for f in fs}
            self.assertEqual(before, after)


class PrecheckTest(unittest.TestCase):
    def test_precheck_names_the_clips_to_regenerate(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "mage"), os.path.join(tmp, "mage"))
            vid = os.path.join(tmp, "mage", "video")
            cfg = hs.load_config("mage", reference=tmp)
            self.assertEqual(hs.precheck(cfg, log=lambda *a, **k: None), {})
            # An idle that walks, and a walk cut short so its loop cannot close.
            shutil.copyfile(os.path.join(vid, "walk-E.mp4"), os.path.join(vid, "idle-E.mp4"))
            src = os.path.join(tmp, "walk-S.mp4")
            shutil.move(os.path.join(vid, "walk-S.mp4"), src)
            subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-frames:v", "30", "-an", "-y",
                            os.path.join(vid, "walk-S.mp4")], check=True)
            problems = hs.precheck(cfg, log=lambda *a, **k: None)
            self.assertIn("idle-E.mp4", problems)
            self.assertTrue(any(w.startswith("idle moves too much") for w in problems["idle-E.mp4"]), problems)
            self.assertIn("walk-S.mp4", problems)
            self.assertTrue(any(w.startswith("format") for w in problems["walk-S.mp4"]), problems)
            self.assertTrue(any(w.startswith("loop does not close") for w in problems["walk-S.mp4"]), problems)
            self.assertLessEqual(set(problems), {"idle-E.mp4", "walk-S.mp4"}, problems)


class MonsterPrecheckTest(unittest.TestCase):
    def test_monster_precheck_names_the_clips_to_regenerate(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "goblin"), os.path.join(tmp, "goblin"))
            vid = os.path.join(tmp, "goblin", "video")
            cfg = hs.load_config("goblin", reference=tmp)
            # An attack cut short: wrong format, and it ends mid-jab.
            src = os.path.join(tmp, "attack-E.mp4")
            shutil.move(os.path.join(vid, "attack-E.mp4"), src)
            subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-frames:v", "14", "-an", "-y",
                            os.path.join(vid, "attack-E.mp4")], check=True)
            lines = []
            problems = hs.precheck(cfg, log=lines.append)
            self.assertIn("attack-E.mp4", problems)
            self.assertTrue(any(w.startswith("format") for w in problems["attack-E.mp4"]), problems)
            self.assertTrue(any(w.startswith("loop does not close") for w in problems["attack-E.mp4"]), problems)
            # Every flag names a clip (never the whole sheet), and only clips that exist.
            for clip in problems:
                self.assertTrue(os.path.exists(os.path.join(vid, clip)), (clip, problems))
            # Death clips are inspected once each, without a loop check;
            # the diagonals reuse them.
            deaths = [x for x in lines if x.startswith("death-")]
            self.assertEqual(sorted(x.split(":")[0] for x in deaths), [f"death-{d}.mp4" for d in "ENSW"])
            self.assertTrue(all("no loop (death)" in x for x in deaths), deaths)

    def test_monster_precheck_reports_a_missing_cardinal_death(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "goblin"), os.path.join(tmp, "goblin"))
            os.remove(os.path.join(tmp, "goblin", "video", "death-N.mp4"))
            problems = hs.precheck(hs.load_config("goblin", reference=tmp), log=lambda *a, **k: None)
            self.assertEqual(problems, {"death-N.mp4": ["missing"]})


if __name__ == "__main__":
    unittest.main()
