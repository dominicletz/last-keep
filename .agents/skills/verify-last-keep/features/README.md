# Last Keep verification map

Read this index, then the feature file. Drive the app with `npx playwright test` from the repo root.

## Baseline preconditions

- The page at `http://127.0.0.1:4000/` contains `Create game`, or `BASE_URL` points at a deploy of the commit under test.
- Playwright chromium is installed.
- Do not reuse a room code from a previous run.

## Driving conventions

- Two isolated browser contexts. They do not share `localStorage`.
- Use `#player-name`, `#create-button`, `#join-game`, `[data-roster]`, `[data-wave]`, and `input[value=hero]`.
- Save screenshots under `tmp/verify-artifacts/`.

## Proof and skip reporting

- Capture the click and the roster or canvas that follows it.
- Report a path you could not reach, with the command and the missing precondition. Do not mark it verified through a different path.

## Features

- [Create a game](./create.md) covers the landing form, the room URL, and the wait for the host.
- [Join from an invite](./invite.md) covers a query invite and the bare-link form.
- [Place a wall](./build.md) covers a click that spends wood.
- [See the wave and fight it](./wave.md) covers goblins on the yard, a real click kill, and surviving wave 1.
