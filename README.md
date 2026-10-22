# TT Pirates

[![TT Pirates title screen](docs/screenshot.jpg)](https://adong.github.io/pirates-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

**中文：** 海盗船：开着你的玩具海盗船，看懂藏宝地图，找到小岛上的宝藏，再用水炮把朋友们的船喷湿（只是玩水，谁都不会受伤）。地图上的“北、东、南、西”帮你学方向。Tommy 玩 🐣 简单的小海，Teddy 玩 🔥 普通的大海；可以一个人玩，也可以两个人各开一艘船。

A treasure-hunting sailing game for Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js on the shared Claude Games kit. Each brother captains a toy pirate ship in a pirate hat, with a water cannon on the bow. A treasure map shows the whole sea, and its clue teaches the directions: up on the screen is always **NORTH**. 🦊 Foxy and 🐸 Froggy sail their own ships and love a water fight. Nobody gets hurt: a ship that gets splashed enough is just **SOAKED**, drops a few coins and sails home to dry in the sun.

There are no image, model or audio files: the boys, Foxy and Froggy are the kit's blocky characters, the ships and islands are built from boxes and tubes, every texture and the treasure map are painted on canvases, and every sound is synthesised.

The name lives in one constant, `TT.TITLE` in `js/title.js`, and the page title, logo and ? panel follow it.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/pirates-tt.html` is the whole game in one page (about 825 KB). AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name pirates-tt`

On the title screen, tap your face to sail alone (**TEDDY** or **TOMMY**), or **TEDDY + TOMMY** for two ships at once on one keyboard or one iPad. Pick 🐣 **EASY** or 🔥 **NORMAL** first.

## The treasure hunt

- **The sea** is a map of squares, with dashed lines on the water so you can count them. A rope of red and white floats marks the edge, and big **N E S W** buoys sit in the middle of each side.
- **Islands** each have their own picture on a round sign: 🌴 🐚 🌋 🐢 🦜 🍌 🦀 ⭐ 🏰. The treasure map uses the same pictures.
- **The treasure map** (top right) shows the whole sea, the islands, the rocks, your ship as an arrow and the friends as little dots. Its clue says where the next treasure is.
- **🐣 EASY** (for Tommy, 5): a 7 × 7 sea and 4 treasures. The map marks the treasure island with a red ❌, a golden light shines down on it, and the clue is one arrow that follows you as you sail: "SAIL ↗️ NORTH-EAST!". When you're there it says "🦀 LAND HERE!".
- **🔥 NORMAL** (for Teddy, 8): a 9 × 9 sea and 5 treasures. No ❌ at first: the clue gives steps from a landmark island, like "FROM 🐚 SAIL 2 ⬆️ NORTH, 1 ➡️ EAST", and the map circles that landmark. Land on a wrong island and the map draws the path; land on another and the ❌ appears too.
- **Landing:** sail right up to an island. On the treasure island your captain digs, a chest pops up with gold (+10 coins), and a new map comes. On any other island it says "NOT HERE!".
- **The compass** (bottom middle, or under your card on a phone) shows which way your ship points: "SAILING ⬆️ NORTH".
- **Coins** float on the water: sail over them to collect them (+1).
- **Win:** find every treasure. Your captain turns round and does his signature move (Teddy boxes, then a 🏀 jump shot; Tommy does his Y pose ✌️), confetti falls, and you get **PLAY AGAIN** with your coins, your time and your best (for each level, alone or together).

## Water fights

- **Your water cannon** splashes forward. On 🐣 EASY the splash bends toward a friend's ship that's nearly in front; on 🔥 NORMAL it helps a little less.
- **Foxy and Froggy** sail around their corners of the sea. When you come close they come over for a water fight: they turn to face you and splash back.
- **Soaked:** the drops over a ship fill up with each splash. A friend is soaked after 3 splashes (🐣) or 4 (🔥): "FOXY IS SOAKED!", three coins spill out, and she sails home to dry in the sun ☀️ before she plays again. You're soaked after 7 splashes (🐣) or 5 (🔥): your ship spins, drops up to 2 coins (fish them back out), and goes slowly for 3 seconds. A soak dries off by itself if nobody splashes you for a while.
- After soaking you, a friend cheers and leaves you alone for a bit.

## Controls

| | Teddy (1P) | Tommy (2P) | Touch |
|---|---|---|---|
| sail (up is NORTH) | W A S D | ↑ ← ↓ → | the ship's wheel: push the way you want to go |
| water cannon | F or Space | L | the big 💦 SPLASH button |
| call your brother · 2 players: high five | T | Enter | tap his face |
| pause · sound | P or Esc · M | | ❚❚ · 🔊 on the treasure map |

- **Sailing:** hold a direction and the ship turns and sails that way. Two keys together sail the in-between ways (W + D is NORTH-EAST).
- **Playing alone**, both key sets sail your ship.
- **Water cannon:** tap for one splash, or hold to keep splashing.
- **Title screen keys:** 1 plays Teddy, 2 Tommy, 3 both, E switches 🐣 / 🔥, Enter plays the last mode again.
- **Touch:** one player gets the wheel (bottom left), 💦 (bottom right) and the brother's face beside it. Two players on an iPad each get a wheel and a 💦 button on their own side, with the high five in the middle.

## Companion

Playing alone, press **T** (or tap the face) to call your brother, any time and as often as you like:

1. He pops onto your deck at his own size (Tommy is smaller), with a sparkle, and does his signature move: Teddy boxes, Tommy does his Y pose ✌️.
2. He tosses you a treat (🍦 💧 🧃 🍪 🍉 🍌): "🍪 COOKIE FROM TOMMY!".
3. Then he fires a **BIG SPLASH**: "TOMMY SAYS: BIG SPLASH!". A wall of water races out all round the ship and soaks every friend's ship close by at once, washes away their splashes in the air, and dries your own ship off.
4. He stays on deck for about 7 seconds and blocks every splash aimed at you ("TOMMY BLOCKED IT!"), then waves goodbye. Call again while he's there for another treat and another big splash; keep calling and he keeps protecting you.

With two players, T (or Enter) is a **high five**: both captains jump, two ✋ fly together between the ships, and stars burst.

## The check

`window.game` has `start()`, `step(seconds)` and `check()`. The rules (`js/sim.js`) have no Three.js, so the same check runs in Node:

```bash
node tools/check.js
```

- **navigation:** holding each of the 8 directions sails the ship that way (within 20°) on both levels; the compass words point within 31° of the true direction (2,000 random bearings); and on 150 NORMAL seas, every island's step clue, counted from its landmark by the words alone, lands exactly on the treasure island (1,200 clues).
- **every island reachable:** on 400 seas (200 per level), every island has open water next to it that the start can sail to, by the check's own flood fill (separate from the sea maker); every friend's home too. Then an autopilot really sails from the start up to every island on 24 of those seas (168 trips).
- **battles end:** splash fights where you fight back, and where you just sit still, on both levels: every battle ends (somebody soaked, or the ships sail apart) within 45 seconds. Last full run: 494 battles, 493 ended with a soaked ship.
- **whole voyages:** the autopilot reads each clue the way a kid would and finds all the treasure, 1 player (Teddy, Tommy) and 2 players, both levels (30 voyages).
- **It can fail:** `game.check({ sabotage })` and `node tools/check.js` run the same check on a deliberately broken game. `flip` (the compass swaps EAST and WEST) and `mirror` (the wheel steers backwards) fail navigation, `wall` (rocks ring an island) fails reachability, and `dry` (water cannons don't soak) fails battles end.

More hooks for testing: `game.input(i, { dx, dy, fire })` holds a player's stick, `game.autopilot()`, `game.buddy()`, `game.win()` (straight to the last treasure), `game.friendNear()`, `game.peek(...)` (a close-up camera), `game.state()`. `node tools/shoot.js` takes screenshots with headless Chrome (`node tools/shoot.js tools/shots.json docs 1200 750` makes `docs/screenshot.jpg`).

## Files

- `index.html`: the page, the HUD and the screens.
- `js/title.js`: the name. `js/friends.js`: Foxy and Froggy (from TT Sea Battle). `js/sim.js`: the rules. `js/check.js`: the check.
- `js/art.js`: the sea, islands, ships, pirate hats, coins and effects. `js/sfx.js`: the sounds. `js/game.js`: everything else.
- `js/keys.js`: the ? panel. `js/zh.js`: 中文.
- `kit/`: a copy of the shared kit (`python3 ../kit/tools/sync.py .`). Never edit it here.

## Not verified

- Sound: never heard. All testing was muted (`claudeGames.muted = 1`); the sounds only ran as code.
- Real touch devices: touch was tested with real touch events in headless Chrome on phone and iPad sizes (the wheel, 💦 and the brother's face), not on an actual iPad or phone.
- Real kids: whether 🐣 EASY is easy enough for Tommy and 🔥 NORMAL's step clues are right for Teddy.
- Double-clicking `index.html` from Finder: the page was tested from `file://` in headless Chrome, which is the same thing, but not by hand.
- The iPad home-screen icon (🏴‍☠️ on a cyan tile).
