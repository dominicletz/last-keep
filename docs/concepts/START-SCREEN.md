# Start screen

The player picks a name and a class once, in the yard, and then they are in the game. A stored seat does not see this screen again.

## What other games do

Kingdom Two Crowns puts the menu in the world. The monarch is already standing in the landscape under the title. Choosing a monarch is a horizontal scroll: left and right on the keyboard, the stick, or a swipe, and the figure changes in place. The text is the monarch's name, plus a lock when a figure is not owned. Confirm starts the campaign. There is no typed name. Coat colour is a separate down-press during the load, with no class copy. Mobile uses the same left and right, as a drag.

Octopath Traveler's title is also the HD-2D town, but the character choice is a second screen. Eight travelers are portraits. Each one shows a name, a job, and a sentence or two about that path. The stick, the d-pad, or the arrow keys move a cursor, and confirm accepts. The names are fixed. The camera does not roam.

Triangle Strategy's title is a still of the party. Choosing units is a list: a portrait, a name, a class, and a short role, with stats on another page. Bumpers or L and R change the page. The protagonist's name is a separate keyboard, not a field on the battlefield.

## What Last Keep takes from that

The yard at dusk is the screen. The same HD-2D picture draws it. The hero stands in the centre, in front of the keep. Left and right are the only class control, on every device:

- Arrow keys, and A and D, while the name field is not being edited.
- On-screen arrows, for the mouse and for a tap.
- A sideways swipe on the picture.
- The gamepad bumpers, when the browser exposes a pad. Keys and arrows stay the path when it does not.

The swap is a short scale-in of the new sheet. The sheet comes from `hero-data.js` through `heroParts`. A new sheet replaces the picture without a change to this screen. The one-line role sits in `heroes.js` beside that list, because `hero-data.js` is the locked atlas.

The copy is the class name and that one line. The name field is small, prefilled from this machine, and it is not focused until the player chooses it, so the arrows keep changing the class. Enter and the one button accept. The button says Create on the home page and Join on `/r/<code>`.

The picture starts on the low tier, with the controls already live, so bloom and depth of field do not gate the first press. The game itself uses the device tier after the seat is in.

A seat stored for this room skips the screen and connects with that same token. A channel that has lost the seat enlists that token, name, and class again. A visitor with nothing stored is the one who sees the screen. The empty-room clock does not use the four-second close on a seat that has never connected. That seat keeps the lobby wait.
