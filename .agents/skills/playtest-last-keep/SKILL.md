---
name: playtest-last-keep
description: "Run a Last Keep playtest with four personas in one shared room. Use when a round of human-like play should produce screenshots and a written report, not when the browser proof suite is the check."
disable-model-invocation: true
---

# Playtest Last Keep

Four personas play together in one room. They do not split into separate games. The browser proof stays `.agents/skills/verify-last-keep/SKILL.md`. This skill does not copy the steps in `e2e/scenarios.js`.

## Harness

`e2e/playtest/room.js` joins the party. It calls `createHost` and `joinQuery` from `e2e/scenarios.js`. `e2e/playtest/cli.js` keeps that party open so each persona can be driven one action at a time.

```sh
node e2e/playtest/cli.js serve playtests/live
node e2e/playtest/cli.js shot playtests/live
node e2e/playtest/cli.js act playtests/live '{"player":"Ada","hold":["KeyW"],"ms":800}'
node e2e/playtest/cli.js act playtests/live '{"player":"Bram","build":"1","click":{"x":700,"y":420}}'
node e2e/playtest/cli.js stop playtests/live
```

`shot` writes `playtests/live/shots/NN-Name.png` and a sibling `.json` snapshot. The snapshot is for the aggregate and for game-logic review. A persona chooses the next action from the picture only. Clicks are pixels on the 1280 by 800 screenshot. Keys are `KeyW`, `KeyA`, `KeyS`, `KeyD`. `build` is `1` through `6`. `skill` is `q`, `e`, or `r`. `start` presses the host's start button.

Unset `BASE_URL` for a local server. Set it to `https://agentyard.letz.tw` to play the deployed game. The local Chrome path is `CHROME_PATH`.

`e2e/playtest.spec.js` is the harness check: four heroes, one roster, and a warrior who walks.

## Personas

1. Pip, scout, casual. Reads the HUD. Does not know the optimal build. Says when a label, button, or number is unclear.
2. Ada, warrior, host and tank. Stays near the keep, starts the night, and blocks bites.
3. Lux, mage. Aims at monsters and uses Fireball, Frost, and Meteor.
4. Bram, engineer. Places walls, towers, traps, and fields, and watches wood and gold.

Each persona writes fun, clarity, difficulty, bugs with the screenshot path, and a top 3. The aggregate is `playtests/round-N.md`: one section per persona, then a deduped list ranked by severity and how many personas hit it. Disagreements stay in the list. Append every new finding to `playtests/BACKLOG.md`. Re-check items already marked done.

Gameplay and game logic also read `docs/GAME-INTERACTIONS.md`. A planned edge is a finding, not a surprise. Upgrades come from buildings and finds. There is no card pick.
