/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: TT.TITLE,
  cols: ['Teddy (1P)', 'Tommy (2P)'],
  keys: [
    ['sail (up is NORTH)', 'W A S D', '↑ ← ↓ →'],
    ['water cannon (hold to keep splashing)', 'F or Space', 'L'],
    ['call your brother · 2 players: high five', 'T', 'Enter'],
    ['pause · sound', 'P or Esc · M', ''],
    ['title: Teddy · Tommy · both · easy / normal', '1 2 3 · E', ''],
  ],
  note: 'Playing alone, both sets of keys sail your ship. Sail up to the island with the treasure to dig it up.',
  touch: "The wheel (bottom left) sails the way you push it, the big 💦 button splashes, and your brother's face calls him.",
});
