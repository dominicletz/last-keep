# Create a game

`twoPlayerNight` in `e2e/scenarios.js` opens `/`, fills Bob, picks warrior on the start screen, and submits `#start-button`.

The room URL matches `/r/<code>`. `[data-clock]` stays `Waiting to start` and `[data-wave]` reads `Wave 1` until the host clicks `[data-start]`.
