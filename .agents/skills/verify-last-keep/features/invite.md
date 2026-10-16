# Join from an invite

A second browser enters the host's room.

## Sub-features

- `query-invite` opens `/r/<code>?name=LLL&hero=mage` and is already in the game.
- `form-invite` opens a bare `/r/<code>`, types a name, and submits Enter.
- `shared-roster` shows both names to both browsers.

## How to get to it (user POV)

- Copy the invite from the host, or open the room URL.
- Add `name` and `hero` to enter without the form.
- On a bare link, use the Join the Keep form.

## Driving it with Playwright

Preconditions: a room exists and the guest context has empty `localStorage`.

- Query invite: `goto` `/r/<code>?name=LLL&hero=mage`. `#join-game` is hidden. Both rosters contain `Ada` and `LLL`.
- Form invite: `goto` `/r/<code>`. The form is visible. Fill `#player-name` with `Bo`, check `input[value=engineer]`, click `#join-game button[type=submit]`. Both rosters contain `Bo`.

## Gotchas

- A guest context that already stored `lastkeep:<code>` reconnects the old hero and ignores the query.
- `name` without `hero`, or an unknown hero, stays on the form. That is a failure only when both values were valid.
