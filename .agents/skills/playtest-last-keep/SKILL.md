---
name: playtest-last-keep
description: "Run a Last Keep playtest with five specialists in one shared room. Use when a round of human-like play should produce screenshots and a written report, not when the browser proof suite is the check."
disable-model-invocation: true
---

# Playtest Last Keep

Five specialists play together in one room. They do not split into separate games. Each one may pick a hero. The report is written from the speciality, not from the hero's role. The browser proof stays `.agents/skills/verify-last-keep/SKILL.md`. This skill does not copy the steps in `e2e/scenarios.js`.

## Harness

`e2e/playtest/room.js` joins the party. It calls `createHost` and `joinQuery` from `e2e/scenarios.js`. `e2e/playtest/cli.js` keeps that party open so each specialist can be driven one action at a time.

```sh
node e2e/playtest/cli.js serve playtests/live
node e2e/playtest/cli.js shot playtests/live
node e2e/playtest/cli.js act playtests/live '{"player":"Ada","hold":["KeyW"],"ms":800}'
node e2e/playtest/cli.js act playtests/live '{"player":"Bram","build":"1","click":{"x":700,"y":420}}'
node e2e/playtest/cli.js stop playtests/live
```

`shot` writes `playtests/live/shots/NN-Name.png` and a sibling `.json` snapshot. The snapshot is for the game-logic specialist and for the aggregate. Gameplay, graphics, music, and character design choose the next action from the picture. Clicks are pixels on the 1280 by 800 screenshot. Keys are `KeyW`, `KeyA`, `KeyS`, `KeyD`. `build` is `1` through `6`. `skill` is `q`, `e`, or `r`. `start` presses the host's start button.

Unset `BASE_URL` for a local server. Set it to `https://agentyard.letz.tw` to play the deployed game. The local Chrome path is `CHROME_PATH`.

`e2e/playtest.spec.js` is the harness check: five heroes, one roster, and a warrior who walks.

## Specialists

They share one room. The hero is only the seat they play.

1. Gameplay, Ada, warrior, host. Starts the night. Judges whether a minute of play is readable, fair, and worth another minute. Reads `docs/GAME-INTERACTIONS.md` and the UI principles in `STYLE.md`. A new number on the chrome is a finding. A resource, a cooldown, or a clock that could have been a thing in the world is a finding. Cite LK-049 if it is the queued diegetic pass, instead of opening a duplicate.
2. Graphics, Lux, mage. Judges whether bodies, buildings, the yard, and the night read at a glance, against `STYLE.md`. Diegetic first, spatial when a world marker is clearer, meta rare, non-diegetic only for the invite, mute, and the fallen score. After the gallery exists, score fidelity in the asset review below.
3. Music and sound, Bram, engineer. Judges what is heard. Name the day loop, the night loop, the horn, the clear, and the hit, kill, build, keep, and fall cues if they play. If the build is silent, the report says so. Mute and volume should survive a reload.
4. Game logic, Pip, scout. Cross-checks the screenshot against the saved snapshot and against `docs/GAME-INTERACTIONS.md`. A planned edge is a finding. Screen and state that disagree are a finding.
5. Character design, Nia, farmer. Judges whether each hero and monster reads as that character, and whether the roster says who is who. The lobby cards in LK-057 are the queued portrait pass. Until those cards exist, say the picker is still text, and do not open a second copy of LK-057.

## Asset review

Run this after the five sections, once `artifacts/gallery/` exists. Before that, note that the gallery is still LK-058 and do not invent scores.

Graphics and Character design score each asset from 1 to 5 against the concept crop on the side-by-side sheet. File every gap in `playtests/BACKLOG.md` with the asset id. Append the score to the Fidelity table. A lower score than the previous row for that asset needs a reason in the table. The next implementation edits the model spec, regenerates, and re-scores. It does not paint the gallery by hand.

## Report

`playtests/round-N.md` has one section per speciality, in the order above. Each section has what that lens saw, bugs with the screenshot path, and a top 3. The aggregate then dedupes and ranks by severity and how many specialists hit it. Disagreements stay in the list. Append every new finding to `playtests/BACKLOG.md`. Re-check items already marked done.

Upgrades come from buildings and finds. There is no card pick.
