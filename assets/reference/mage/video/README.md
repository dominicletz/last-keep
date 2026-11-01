# Mage video inputs

Grok Imagine clips and stills for `priv/static/images/hd2d/mage-walk.png`, built with the pipeline in `docs/concepts/SPRITE-PIPELINE.md`:

```
python3 script/sprite_from_video.py mage
python3 script/check_sprite_sheet.py mage --out /tmp/approval
```

- `../concept.png` is the mage crop of `docs/concept/heroes.jpg`.
- `views/k-S.png`, `k-W.png`, `k-N.png`, `k-E.png` are the normalized cardinal keyframes. `dirs/S.png`, `W.png`, `N.png`, and `E.png` are the same files.
- `turntable.mp4` is 8 s at 24 fps (193 frames), with W at 2 s, N at 4 s, and E at 6 s.
- `dirs/NW.png` and `dirs/NE.png` follow the rule in the pipeline doc (sharpest frame within ±5 of 3 s and 5 s): turntable frames 67 and 122 (0-based).
- `dirs/SW.png` is turntable frame 46 (1.92 s) and `dirs/SE.png` is frame 156 (6.50 s), both 0-based. They were picked by hand because the frames at 1 s and 7 s still looked straight-on, not diagonal.
- `walk-<DIR>.mp4` and `idle-<DIR>.mp4` are 2 s clips at 24 fps, 720×720, with first frame = last frame = `dirs/<DIR>.png`.

## Open issue

`idle-E.mp4` fails `idle E subtle`. From about frame 19 to frame 31 (0.8–1.3 s) the staff crystal glows. Its light-cyan halo is not background, so the silhouette top rises by 10 source px (rows 121 → 111). That moves the per-frame fit, and idle frame 24 differs from its neighbours by 1336 silhouette px, against a ceiling of 0.6 × 733. Regenerate the clip with the crystal steady and no glow.
