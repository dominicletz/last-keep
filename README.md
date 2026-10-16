# Last Keep

Last Keep is a co-op medieval defense game. A band of heroes holds a keep in a forest clearing, builds between waves, and fights monsters that come from every side. The run ends when the keep falls. The score is waves survived plus kills.

The design notes live in [CONCEPT.md](CONCEPT.md).

## Play

Open the site, enter a name, pick a hero, and create a game. Send the invite link to friends. A link with `?name=` and `?hero=` drops that friend straight into the room. A bare link asks for a name first. No account is required. Closing the tab and opening the same link puts you back on your hero.

- WASD moves.
- The mouse aims.
- Left click attacks.
- Q and E are skills. R is the ultimate.
- Keys 1 through 6 choose a building. Click the ground to place it. Escape cancels.
- F, while standing at the keep, spends food to repair it.

The stockpile is shared. Wood comes from trees. Food and gold come from fields. Gold also drops from kills. Walls, towers, traps, a forge, and a mage tower are the buildings. A forge raises everyone's damage. A mage tower sharpens the mage. A scout shows where the next wave will arrive. Every fifth wave is an elite pack or a boss. A boss can leave a relic.

## Run it locally

You need Elixir 1.18, Erlang/OTP 28, and Node 22.

```sh
mix setup
mix phx.server
```

The game is at http://127.0.0.1:4000.

`mix setup` fetches Elixir dependencies, installs esbuild, and builds the JavaScript. `mix phx.server` starts the dev server with reloading.

## Tests

```sh
mix test
```

CI runs `mix format --check-formatted`, `mix compile --warnings-as-errors`, an asset build, `mix test`, the client unit tests, and a two-browser Playwright pass. The deploy workflow runs that same browser pass against the live site.

## Production

The production image is `ghcr.io/dominicletz/last-keep`. A push to `main` builds it and deploys it to https://agentyard.letz.tw. The deploy stops the old AgentYard stack in `/opt/agentyard` without deleting its files or volumes, then starts this stack from `/opt/last-keep`.

`SECRET_KEY_BASE` is not in the image. The first deploy writes `/opt/last-keep/.env` on the server and later deploys leave that file alone.
