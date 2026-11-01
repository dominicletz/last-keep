# Scout video inputs

Built with `python3 script/hero_sprites.py scout prep|dirs|precheck|build` (see `docs/concepts/SPRITE-PIPELINE.md`).

- `views/v-*.jpg`: the four generated views. `views/k-*.png` are their normalized copies (`hero_sprites.py scout views`).
- `turntable.mp4`: 8 s, keyframes W 2 s, N 4 s, E 6 s, first = last = `k-S.png`.
- `dirs/*.png`: start poses. The cardinals are the `k-*.png`. The diagonals are turntable frames (0-based) SW 32, NW 72, NE 120, SE 164, picked by Dominic and pinned in `../hero.json`. The automatic picker chose 28, 79, 123, 165 (`diagonals.json`).
- `walk-*.mp4`, `idle-*.mp4`: 2 s clips started and ended on `dirs/<DIR>.png`. `precheck` passed all 16.
