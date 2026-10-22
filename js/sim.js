/* TT Pirates: the rules. No Three.js here, so tools/check.js can run it in Node.
   The sea is an n x n map of squares (SQ world units each). x grows EAST, y grows SOUTH, so NORTH is up on the screen
   and on the treasure map. Ships sail where the stick points (hold ⬆️ to sail NORTH); water cannons splash, never harm:
   a ship that gets splashed enough is SOAKED, drops coins and goes home to dry. Each voyage has a list of treasure
   islands; the treasure map's clue says where the next one is. Events go to S.events for the game to show. */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});

  const SQ = 4;
  const ISLAND_R = 1.55, ROCK_R = 1.15, SHIP_R = 0.85;
  const DOCK = ISLAND_R + SHIP_R + 0.4;

  const LEVELS = {
    // 🐣 EASY (Tommy, 5): a small sea, the X is on the map and an arrow says which way; slow friends who miss a lot.
    easy: {
      n: 7, islands: 6, rocks: 3, coins: 10, treasures: 4, clue: 'arrow',
      turn: 3.6, speed: 4.6, assist: 0.75, playerHits: 7,
      rivalSpeed: 2.9, rivalTurn: 2.4, rivalFire: 2.6, rivalAim: 0.32, rivalHits: 3, engage: 7.5, calm: 7,
    },
    // 🔥 NORMAL (Teddy, 8): a bigger sea, the clue gives steps from a landmark island; quicker friends who aim better.
    normal: {
      n: 9, islands: 8, rocks: 7, coins: 14, treasures: 5, clue: 'steps',
      turn: 3.2, speed: 5.2, assist: 0.35, playerHits: 5,
      rivalSpeed: 4.0, rivalTurn: 2.8, rivalFire: 1.5, rivalAim: 0.12, rivalHits: 4, engage: 10, calm: 4,
    },
  };

  const ISLANDS = [
    { id: 'palm', emoji: '🌴', name: 'PALM ISLAND', sand: '#f6d98b', top: '#5cc94f' },
    { id: 'shell', emoji: '🐚', name: 'SHELL ISLAND', sand: '#ffe2cf', top: '#ffb3c7' },
    { id: 'volcano', emoji: '🌋', name: 'VOLCANO ISLAND', sand: '#d9b48a', top: '#7a5a48' },
    { id: 'turtle', emoji: '🐢', name: 'TURTLE ISLAND', sand: '#f2dc96', top: '#3fae5a' },
    { id: 'parrot', emoji: '🦜', name: 'PARROT ISLAND', sand: '#f6d98b', top: '#47c27a' },
    { id: 'banana', emoji: '🍌', name: 'BANANA ISLAND', sand: '#fff0a8', top: '#8ad64a' },
    { id: 'crab', emoji: '🦀', name: 'CRAB ISLAND', sand: '#ffd9b0', top: '#e8784a' },
    { id: 'star', emoji: '⭐', name: 'STAR ISLAND', sand: '#fff3c4', top: '#ffd400' },
    { id: 'castle', emoji: '🏰', name: 'CASTLE ISLAND', sand: '#e9dcc0', top: '#9aa3b5' },
  ];

  // The eight winds, starting EAST and going clockwise (y grows south). [name, arrow, dx, dy]
  const WINDS = [
    ['EAST', '➡️', 1, 0], ['SOUTH-EAST', '↘️', 1, 1], ['SOUTH', '⬇️', 0, 1], ['SOUTH-WEST', '↙️', -1, 1],
    ['WEST', '⬅️', -1, 0], ['NORTH-WEST', '↖️', -1, -1], ['NORTH', '⬆️', 0, -1], ['NORTH-EAST', '↗️', 1, -1],
  ];
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Which wind is (dx, dy)? The four main ones get wider slices (60°) than the in-between ones (30°): easier for little
  // sailors, and "NORTH" stays "NORTH" until the treasure is clearly off to one side.
  function wind(dx, dy, sab) {
    let a = Math.atan2(dy, dx); // 0 = east, +π/2 = south
    if (sab === 'flip') a = Math.PI - a; // the broken compass for the check: east and west swapped
    const deg = ((a * 180) / Math.PI + 360) % 360;
    for (let i = 0; i < 8; i++) {
      const c = i * 45, half = i % 2 ? 15 : 30;
      if (Math.abs(((deg - c + 540) % 360) - 180) <= half) return WINDS[i];
    }
    return WINDS[0];
  }

  // ------------------------------------------------------------------ the sea map

  // 0 water, 1 island, 2 rock. Islands never touch each other (not even corners), so there's water all round them.
  // The player starts at the bottom middle; the friends' homes are the top corners.
  function makeSea(seed, level, opts = {}) {
    const L = LEVELS[level];
    const n = L.n;
    const R = rng(seed * 7919 + (level === 'easy' ? 11 : 23));
    for (let tries = 0; tries < 400; tries++) {
      const grid = new Array(n * n).fill(0);
      const start = [Math.floor(n / 2), n - 1];
      const homes = [[0, 0], [n - 1, 0]];
      const reserved = new Set();
      const reserve = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) reserved.add(y * n + x); };
      reserve(start[0], start[1], 1);
      homes.forEach(([x, y]) => reserve(x, y, 0));
      const islands = [];
      const pool = ISLANDS.slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      let guard = 0;
      while (islands.length < L.islands && guard++ < 500) {
        const x = Math.floor(R() * n), y = Math.floor(R() * (n - 1));
        if (reserved.has(y * n + x) || grid[y * n + x]) continue;
        let near = false;
        for (const o of islands) if (Math.abs(o.cx - x) <= 1 && Math.abs(o.cy - y) <= 1) near = true;
        if (near) continue;
        grid[y * n + x] = 1;
        const kind = pool[islands.length];
        islands.push({ ...kind, cx: x, cy: y, x: (x + 0.5) * SQ, y: (y + 0.5) * SQ, found: false });
      }
      if (islands.length < L.islands) continue;
      const rocks = [];
      guard = 0;
      while (rocks.length < L.rocks && guard++ < 500) {
        const x = Math.floor(R() * n), y = Math.floor(R() * n);
        if (reserved.has(y * n + x) || grid[y * n + x]) continue;
        grid[y * n + x] = 2;
        rocks.push({ cx: x, cy: y, x: (x + 0.5) * SQ, y: (y + 0.5) * SQ, r: ROCK_R, spin: R() * 6 });
      }
      const sea = { n, size: n * SQ, grid, islands, rocks, start, homes, seed, level };
      if (opts.raw || seaProblems(sea).length === 0) return sea;
    }
    throw new Error('no sea for seed ' + seed);
  }

  const cellOf = (sea, x, y) => [clamp(Math.floor(x / SQ), 0, sea.n - 1), clamp(Math.floor(y / SQ), 0, sea.n - 1)];
  const isWater = (sea, x, y) => x >= 0 && y >= 0 && x < sea.n && y < sea.n && sea.grid[y * sea.n + x] === 0;

  // Water squares you can sail to from (sx, sy), stepping to the 8 neighbours (a corner step needs both sides open).
  function flood(sea, sx, sy) {
    const n = sea.n, seen = new Uint8Array(n * n), q = [[sx, sy]];
    if (!isWater(sea, sx, sy)) return seen;
    seen[sy * n + sx] = 1;
    while (q.length) {
      const [x, y] = q.shift();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!isWater(sea, nx, ny) || seen[ny * n + nx]) continue;
        if (dx && dy && (!isWater(sea, x + dx, y) || !isWater(sea, x, y + dy))) continue;
        seen[ny * n + nx] = 1;
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  // The water squares right next to an island (N, E, S, W): where a ship lands.
  const shoreOf = (sea, isl) => [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [isl.cx + dx, isl.cy + dy]).filter(([x, y]) => isWater(sea, x, y));

  // Everything that would make a sea unfair: an island nobody can sail to, a friend's home cut off.
  function seaProblems(sea) {
    const probs = [];
    const seen = flood(sea, sea.start[0], sea.start[1]);
    if (!isWater(sea, sea.start[0], sea.start[1])) probs.push('the start is not water');
    for (const isl of sea.islands) {
      if (!shoreOf(sea, isl).some(([x, y]) => seen[y * sea.n + x])) probs.push(`${isl.name} can't be reached`);
    }
    for (const [x, y] of sea.homes) if (!seen[y * sea.n + x]) probs.push(`home ${x},${y} can't be reached`);
    return probs;
  }

  // Shortest water path between squares (8 neighbours), as a list of squares, or null.
  function path(sea, from, goals) {
    const n = sea.n, prev = new Int32Array(n * n).fill(-2);
    const goalSet = new Set(goals.map(([x, y]) => y * n + x));
    const s = from[1] * n + from[0];
    if (!isWater(sea, from[0], from[1])) return null;
    prev[s] = -1;
    const q = [s];
    let end = -1;
    while (q.length) {
      const c = q.shift();
      if (goalSet.has(c)) { end = c; break; }
      const x = c % n, y = (c - x) / n;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!isWater(sea, nx, ny) || prev[ny * n + nx] !== -2) continue;
        if (dx && dy && (!isWater(sea, x + dx, y) || !isWater(sea, x, y + dy))) continue;
        prev[ny * n + nx] = c;
        q.push(ny * n + nx);
      }
    }
    if (end < 0) return null;
    const out = [];
    for (let c = end; c !== -1; c = prev[c]) out.push([c % n, (c - (c % n)) / n]);
    return out.reverse();
  }

  // ------------------------------------------------------------------ clues

  // NORMAL's clue: "From 🐚, sail 2 NORTH and 1 EAST." The landmark is one of the nearest other islands.
  function stepsClue(sea, target, R, sab) {
    const others = sea.islands.filter((o) => o !== target)
      .map((o) => ({ o, d: Math.abs(o.cx - target.cx) + Math.abs(o.cy - target.cy) }))
      .filter((c) => Math.abs(c.o.cx - target.cx) <= 4 && Math.abs(c.o.cy - target.cy) <= 4)
      .sort((a, b) => a.d - b.d);
    const pickFrom = others.slice(0, Math.min(2, others.length));
    const from = pickFrom.length ? pickFrom[Math.floor(R() * pickFrom.length)].o : sea.islands.find((o) => o !== target);
    const dx = target.cx - from.cx, dy = target.cy - from.cy;
    const parts = [];
    const ns = dy < 0 ? WINDS[6] : WINDS[2], ew = dx > 0 ? WINDS[0] : WINDS[4];
    const ewSab = sab === 'flip' ? (dx > 0 ? WINDS[4] : WINDS[0]) : ew;
    if (dy) parts.push({ n: Math.abs(dy), dir: ns[0], arrow: ns[1] });
    if (dx) parts.push({ n: Math.abs(dx), dir: ewSab[0], arrow: ewSab[1] });
    if (R() < 0.5) parts.reverse();
    return { kind: 'steps', target: target.id, from: from.id, parts };
  }

  function makeClue(S, target) {
    if (S.L.clue === 'arrow') return { kind: 'arrow', target: target.id };
    return stepsClue(S.sea, target, S.R, S.sab);
  }

  // Where a clue points, read the way a kid reads it: start at the landmark and count squares. (The check and the
  // autopilot use this; it never peeks at clue.target.)
  const DIRV = { NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0] };
  function readClue(sea, clue, from) {
    if (clue.kind !== 'steps') return null;
    const L = sea.islands.find((o) => o.id === clue.from);
    let x = L.cx, y = L.cy;
    for (const p of clue.parts) { const v = DIRV[p.dir]; x += v[0] * p.n; y += v[1] * p.n; }
    return sea.islands.find((o) => o.cx === x && o.cy === y) || null;
  }

  // ------------------------------------------------------------------ the game

  function create(o = {}) {
    const level = o.level || 'easy';
    const L = Object.assign({}, LEVELS[level], o.tweak || {});
    const seed = o.seed || 1 + Math.floor(Math.random() * 1e6);
    const sea = o.sea || makeSea(seed, level);
    const R = rng(seed * 31 + 7);
    const kinds = o.players || ['teddy'];
    const buddyFor = o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy'));
    const sab = o.sabotage || null;
    const S = {
      sea, L, level, seed, R, sab, t: 0, events: [], ships: [], shots: [], coins: [],
      players: [], rivals: [], input: [], auto: kinds.map(() => false), autoMode: kinds.map(() => 'treasure'),
      targets: [], ti: 0, clue: null, wrong: 0, won: false, wonT: 0, buddy: null, buddyKind: buddyFor(kinds[0]),
      treatI: Math.floor(R() * TREATS.length), fiveT: 0, coinT: 0, battles: [], ended: [],
    };
    const emit = (type, e = {}) => { e.type = type; e.t = S.t; S.events.push(e); return e; };
    S.emit = emit;

    function ship(kind, team, x, y, h, extra) {
      const s = Object.assign({
        id: S.ships.length, kind, team, x, y, h, v: 0, r: SHIP_R, soak: 0, lastHit: -99, cool: 0, drip: 0, spin: 0,
        coins: 0, dig: 0, dock: null, bump: 0, path: null, pathT: 0, goal: null,
      }, extra || {});
      S.ships.push(s);
      return s;
    }
    const [sx, sy] = sea.start;
    kinds.forEach((k, i) => {
      const off = kinds.length === 2 ? (i ? 1.6 : -1.6) : 0;
      const P = ship(k, 'p', (sx + 0.5) * SQ + off, (sy + 0.5) * SQ, -Math.PI / 2, { i, hits: L.playerHits, maxV: L.speed, turn: L.turn });
      S.players.push(P);
      S.input.push({ dx: 0, dy: 0, fire: false, press: false });
    });
    const rivalKinds = o.rivals || ['foxy', 'froggy'];
    rivalKinds.forEach((k, i) => {
      const [hx, hy] = sea.homes[i % sea.homes.length];
      S.rivals.push(ship(k, 'r', (hx + 0.5) * SQ, (hy + 0.5) * SQ, Math.PI / 2, {
        home: [hx, hy], ai: 'roam', calm: 3 + i * 2, hits: L.rivalHits, maxV: L.rivalSpeed, turn: L.rivalTurn, fireT: 1 + i, target: null, aiT: 0,
      }));
    });

    // the voyage: which islands hold treasure, in order
    const order = sea.islands.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    S.targets = order.slice(0, Math.min(L.treasures, order.length));
    S.clue = S.targets.length ? makeClue(S, S.targets[0]) : { kind: 'none' };

    // coins floating on open water
    const reach = flood(sea, sx, sy);
    const waterCells = [];
    for (let y = 0; y < sea.n; y++) for (let x = 0; x < sea.n; x++) if (reach[y * sea.n + x] && !(x === sx && y === sy)) waterCells.push([x, y]);
    S.waterCells = waterCells;
    function addCoin(x, y, drop) { const c = { id: ++S.coinId, x, y, vx: 0, vy: 0, drop: !!drop, born: S.t }; S.coins.push(c); return c; }
    S.coinId = 0;
    S.addCoin = addCoin;
    function spawnCoin() {
      for (let k = 0; k < 20; k++) {
        const [cx, cy] = waterCells[Math.floor(R() * waterCells.length)];
        const x = (cx + 0.2 + R() * 0.6) * SQ, y = (cy + 0.2 + R() * 0.6) * SQ;
        if (S.ships.some((s) => Math.hypot(s.x - x, s.y - y) < 4)) continue;
        if (S.coins.some((c) => Math.hypot(c.x - x, c.y - y) < 1.5)) continue;
        return addCoin(x, y);
      }
      return null;
    }
    for (let i = 0; i < L.coins; i++) spawnCoin();

    const isTarget = (isl) => S.targets[S.ti] === isl;
    S.target = () => (S.won ? null : S.targets[S.ti]);
    S.island = (id) => sea.islands.find((o) => o.id === id);
    S.left = () => S.targets.length - S.ti;
    S.hint = () => (L.clue === 'arrow' ? 2 : Math.min(2, S.wrong));
    S.total = () => S.players.reduce((a, P) => a + P.coins, 0);

    // ---------------------------------------------------------------- ships

    function steer(s, inp, dt) {
      if (s.dig > 0 || s.spin > 0) { s.v *= Math.exp(-6 * dt); return; }
      let mx = inp.dx, my = inp.dy;
      if (sab === 'mirror' && s.team === 'p') mx = -mx;
      const mag = Math.min(1, Math.hypot(mx, my));
      let want = 0;
      if (mag > 0.05) {
        const a = Math.atan2(my, mx);
        const d = angDiff(s.h, a);
        s.h += clamp(d, -s.turn * dt, s.turn * dt);
        want = s.maxV * mag * Math.max(0.3, Math.cos(angDiff(s.h, a)));
      }
      if (s.drip > 0) want *= 0.55;
      s.v += (want - s.v) * Math.min(1, (want > s.v ? 2.6 : 2.0) * dt);
    }

    function collide(s) {
      const pushOut = (ox, oy, r) => {
        const dx = s.x - ox, dy = s.y - oy, d = Math.hypot(dx, dy), m = r + s.r;
        if (d >= m || d < 1e-6) return false;
        s.x = ox + (dx / d) * m;
        s.y = oy + (dy / d) * m;
        return true;
      };
      let hit = false;
      const [cx, cy] = cellOf(sea, s.x, s.y);
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        if (x < 0 || y < 0 || x >= sea.n || y >= sea.n) continue;
        const g = sea.grid[y * sea.n + x];
        if (g) hit = pushOut((x + 0.5) * SQ, (y + 0.5) * SQ, g === 1 ? ISLAND_R : ROCK_R) || hit;
      }
      const lo = 0.7, hi = sea.size - 0.7;
      if (s.x < lo || s.x > hi || s.y < lo || s.y > hi) { s.x = clamp(s.x, lo, hi); s.y = clamp(s.y, lo, hi); hit = true; }
      if (hit) { s.v *= 0.6; if (S.t - s.bump > 0.6 && s.team === 'p' && Math.abs(s.v) > 1) { s.bump = S.t; emit('bump', { ship: s }); } }
    }

    function separate() {
      for (let i = 0; i < S.ships.length; i++) for (let j = i + 1; j < S.ships.length; j++) {
        const a = S.ships[i], b = S.ships[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d < m && d > 1e-6) {
          const k = (m - d) / 2;
          a.x -= (dx / d) * k; a.y -= (dy / d) * k;
          b.x += (dx / d) * k; b.y += (dy / d) * k;
        }
      }
    }

    // ---------------------------------------------------------------- water cannons

    const enemiesOf = (s) => S.ships.filter((o) => o.team !== s.team && !(o.ai === 'dry'));
    function fire(s, aim) {
      if (s.cool > 0 || s.dig > 0 || s.spin > 0) return null;
      s.cool = s.team === 'p' ? 0.42 : L.rivalFire;
      let a = aim === undefined ? s.h : aim;
      if (s.team === 'p' && L.assist > 0) {
        // a little help aiming: the splash bends toward a ship that's nearly in front
        let best = null, bd = L.assist;
        for (const o of enemiesOf(s)) {
          const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (d > 10) continue;
          const dd = Math.abs(angDiff(a, Math.atan2(o.y - s.y, o.x - s.x)));
          if (dd < bd) { bd = dd; best = o; }
        }
        if (best) a = Math.atan2(best.y - s.y, best.x - s.x);
      }
      const sp = 12;
      const shot = { id: ++S.shotId, owner: s, team: s.team, x: s.x + Math.cos(a) * 1.1, y: s.y + Math.sin(a) * 1.1, vx: Math.cos(a) * sp + Math.cos(s.h) * s.v * 0.5, vy: Math.sin(a) * sp + Math.sin(s.h) * s.v * 0.5, t: 0, life: 0.72 };
      S.shots.push(shot);
      emit('fire', { ship: s, shot });
      return shot;
    }
    S.shotId = 0;
    S.fire = fire;

    function hitShip(o, by) {
      battleNote(o, by);
      if (o.team === 'p' && S.buddy) { emit('blocked', { ship: o, by, buddy: S.buddyKind }); return; }
      if (sab === 'dry') { emit('splash', { x: o.x, y: o.y, on: 'ship', ship: o }); return; } // the check's broken cannon
      o.soak += 1;
      o.lastHit = S.t;
      emit('hit', { ship: o, by, soak: o.soak, hits: o.hits });
      if (o.soak >= o.hits) soakShip(o, by);
    }

    function soakShip(o, by) {
      o.soak = 0;
      if (o.team === 'r') {
        o.ai = 'dry';
        o.path = null;
        o.target = null;
        for (let k = 0; k < 3; k++) dropCoin(o, k);
      } else {
        o.spin = 1.2;
        o.drip = 3;
        const n = Math.min(2, o.coins);
        o.coins -= n;
        for (let k = 0; k < n; k++) dropCoin(o, k);
        if (by && by.team === 'r') { by.ai = 'cheer'; by.aiT = 1.6; by.calm = L.calm; by.target = null; }
      }
      battleEnd(o, by, 'soaked');
      emit('soaked', { ship: o, by });
    }

    function dropCoin(o, k) {
      const a = o.h + Math.PI + (k - 1) * 0.9;
      const c = addCoin(o.x, o.y, true);
      c.vx = Math.cos(a) * 3.2;
      c.vy = Math.sin(a) * 3.2;
    }

    function stepShots(dt) {
      for (let i = S.shots.length - 1; i >= 0; i--) {
        const b = S.shots[i];
        b.t += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        let done = null;
        for (const o of S.ships) {
          if (o.team === b.team || o.ai === 'dry') continue;
          if (Math.hypot(o.x - b.x, o.y - b.y) < o.r + 0.45) { hitShip(o, b.owner); done = 'ship'; break; }
        }
        if (!done) {
          const [cx, cy] = cellOf(sea, b.x, b.y);
          const g = sea.grid[cy * sea.n + cx];
          if (g && Math.hypot(b.x - (cx + 0.5) * SQ, b.y - (cy + 0.5) * SQ) < (g === 1 ? ISLAND_R : ROCK_R)) done = g === 1 ? 'island' : 'rock';
        }
        if (!done && (b.t >= b.life || b.x < 0 || b.y < 0 || b.x > sea.size || b.y > sea.size)) done = 'water';
        if (done) {
          if (done !== 'ship') emit('splash', { x: b.x, y: b.y, on: done });
          S.shots.splice(i, 1);
        }
      }
    }

    // ---------------------------------------------------------------- battles (for the check: every one must end)

    function battleNote(a, b) {
      if (!a || !b) return;
      const P = a.team === 'p' ? a : b, Rv = a.team === 'p' ? b : a;
      if (P.team !== 'p' || Rv.team !== 'r') return;
      let bt = S.battles.find((x) => x.p === P && x.r === Rv);
      if (!bt) { bt = { p: P, r: Rv, start: S.t, far: 0, hits: 0 }; S.battles.push(bt); }
      bt.hits++;
    }
    function battleEnd(a, b, how) {
      for (let i = S.battles.length - 1; i >= 0; i--) {
        const bt = S.battles[i];
        if (bt.p === a || bt.r === a) { S.ended.push({ p: bt.p.kind, r: bt.r.kind, how, dur: S.t - bt.start }); S.battles.splice(i, 1); }
      }
    }
    function stepBattles(dt) {
      for (let i = S.battles.length - 1; i >= 0; i--) {
        const bt = S.battles[i];
        const d = Math.hypot(bt.p.x - bt.r.x, bt.p.y - bt.r.y);
        bt.far = d > 14 ? bt.far + dt : 0;
        if (bt.far > 3) { S.ended.push({ p: bt.p.kind, r: bt.r.kind, how: 'sailed away', dur: S.t - bt.start }); S.battles.splice(i, 1); }
      }
    }

    // ---------------------------------------------------------------- following a path (friends and the autopilot)

    function followTo(s, goals, finalXY, dt) {
      s.pathT -= dt;
      const here = cellOf(sea, s.x, s.y);
      const key = goals.map((g) => g.join(',')).join(';');
      if (!s.path || s.pathT <= 0 || s.goal !== key) {
        s.path = path(sea, here, goals) || [];
        s.goal = key;
        s.pathT = 1.2;
        s.wp = 1;
      }
      while (s.path && s.wp < s.path.length) {
        const [wx, wy] = s.path[s.wp];
        const tx = (wx + 0.5) * SQ, ty = (wy + 0.5) * SQ;
        if (Math.hypot(tx - s.x, ty - s.y) < 1.4 || (here[0] === wx && here[1] === wy && s.wp < s.path.length - 1)) s.wp++;
        else return { dx: tx - s.x, dy: ty - s.y, done: false };
      }
      if (finalXY) return { dx: finalXY[0] - s.x, dy: finalXY[1] - s.y, done: Math.hypot(finalXY[0] - s.x, finalXY[1] - s.y) < 0.8 };
      return { dx: 0, dy: 0, done: true };
    }
    S.followTo = followTo;
    const norm = (v, m = 1) => { const d = Math.hypot(v.dx, v.dy); return d > 1e-6 ? { dx: (v.dx / d) * m, dy: (v.dy / d) * m } : { dx: 0, dy: 0 }; };

    // ---------------------------------------------------------------- the friends' ships

    function rivalBrain(r, dt) {
      r.calm -= dt;
      r.aiT -= dt;
      const inp = { dx: 0, dy: 0 };
      if (r.ai === 'dry') {
        const home = [(r.home[0] + 0.5) * SQ, (r.home[1] + 0.5) * SQ];
        const g = followTo(r, [r.home], home, dt);
        if (Math.hypot(home[0] - r.x, home[1] - r.y) < 1.5) {
          r.dryT = (r.dryT || 0) + dt;
          if (r.dryT > 6) { r.dryT = 0; r.ai = 'roam'; r.calm = L.calm; r.path = null; emit('dried', { ship: r }); }
        } else Object.assign(inp, norm(g, 0.8));
        return inp;
      }
      if (r.ai === 'cheer') {
        if (r.aiT <= 0) { r.ai = 'roam'; r.path = null; }
        return inp;
      }
      const prey = S.players.filter((P) => P.drip <= 0 && P.spin <= 0)
        .map((P) => ({ P, d: Math.hypot(P.x - r.x, P.y - r.y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (r.ai === 'roam') {
        if (prey && prey.d < L.engage && r.calm <= 0 && !S.won) { r.ai = 'fight'; r.target = prey.P; r.aiT = 0; r.far = 0; battleNote(r, prey.P); }
        else {
          if (!r.roamTo || Math.hypot((r.roamTo[0] + 0.5) * SQ - r.x, (r.roamTo[1] + 0.5) * SQ - r.y) < 1.6) {
            r.roamTo = S.waterCells[Math.floor(R() * S.waterCells.length)];
          }
          const g = followTo(r, [r.roamTo], null, dt);
          if (g.done) r.roamTo = null;
          return norm(g, 0.7);
        }
      }
      if (r.ai === 'fight') {
        const P = r.target;
        if (!P || P.drip > 0 || S.won) { r.ai = 'roam'; r.target = null; r.calm = 2; return inp; }
        const d = Math.hypot(P.x - r.x, P.y - r.y);
        r.far = d > L.engage + 6 ? (r.far || 0) + dt : 0;
        if (r.far > 3) { r.ai = 'roam'; r.target = null; r.calm = L.calm; return inp; }
        const toP = Math.atan2(P.y - r.y, P.x - r.x);
        // sail up close, then turn the bow (and the water cannon) to face you, drifting slowly
        let v, mag = 1;
        if (d > 5.5) v = followTo(r, [cellOf(sea, P.x, P.y)], [P.x, P.y], dt);
        else { v = { dx: Math.cos(toP), dy: Math.sin(toP) }; mag = d < 3 ? 0.08 : 0.2; }
        Object.assign(inp, norm(v, mag));
        if (d < 8.5 && Math.abs(angDiff(r.h, toP)) < 0.45) fire(r, toP + (R() * 2 - 1) * L.rivalAim);
        return inp;
      }
      return inp;
    }

    // ---------------------------------------------------------------- the autopilot (demo, tests)

    function autoBrain(P, dt) {
      const mode = S.autoMode[P.i];
      const inp = { dx: 0, dy: 0, fire: false };
      if (mode === 'sit') return inp;
      if (mode === 'fight') {
        const prey = S.rivals.filter((r) => r.ai !== 'dry').map((r) => ({ r, d: Math.hypot(r.x - P.x, r.y - P.y) })).sort((a, b) => a.d - b.d)[0];
        if (!prey) return inp;
        const toR = Math.atan2(prey.r.y - P.y, prey.r.x - P.x);
        const g = prey.d > 5 ? followTo(P, [cellOf(sea, prey.r.x, prey.r.y)], [prey.r.x, prey.r.y], dt) : { dx: Math.cos(toR), dy: Math.sin(toR) };
        Object.assign(inp, norm(g, prey.d > 3 ? 1 : 0.3));
        inp.fire = prey.d < 8 && Math.abs(angDiff(P.h, toR)) < 0.5;
        return inp;
      }
      // treasure: read the clue like a kid would, then sail there; splash friends who come close
      const isl = S.won ? null : S.clue.kind === 'steps' ? readClue(sea, S.clue) : S.island(S.clue.target);
      if (isl) {
        const g = followTo(P, shoreOf(sea, isl), [isl.x, isl.y], dt);
        Object.assign(inp, norm(g, 1));
      }
      const near = S.rivals.find((r) => r.ai !== 'dry' && Math.hypot(r.x - P.x, r.y - P.y) < 7 && Math.abs(angDiff(P.h, Math.atan2(r.y - P.y, r.x - P.x))) < 0.6);
      inp.fire = !!near;
      return inp;
    }

    // ---------------------------------------------------------------- landing on islands

    function land(P) {
      for (const isl of sea.islands) {
        const d = Math.hypot(isl.x - P.x, isl.y - P.y);
        if (P.dock === isl.id) { if (d > DOCK + 0.9) P.dock = null; continue; }
        if (d > DOCK || P.dig > 0) continue;
        P.dock = isl.id;
        if (isl.found) { emit('dug', { ship: P, island: isl }); continue; }
        if (!S.won && isTarget(isl)) {
          isl.found = true;
          P.dig = 1.7;
          P.coins += 10;
          emit('treasure', { ship: P, island: isl, coins: 10 });
          S.ti++;
          S.wrong = 0;
          if (S.ti >= S.targets.length) { S.won = true; S.wonT = S.t + 1.7; S.winner = P; }
          else { S.clue = makeClue(S, S.targets[S.ti]); emit('clue', { clue: S.clue, after: 1.7 }); }
        } else {
          S.wrong++;
          emit('wrong', { ship: P, island: isl, hint: S.hint() });
        }
      }
    }

    // ---------------------------------------------------------------- the brother (1 player) and the high five (2 players)

    S.callBuddy = function (i = 0) {
      if (S.won) return null;
      if (S.players.length > 1) {
        if (S.t < S.fiveT) return null;
        S.fiveT = S.t + 0.8;
        return emit('highFive', { by: i });
      }
      const B = S.buddy;
      if (!B) {
        S.buddy = { kind: S.buddyKind, phase: 'hello', t: 0, more: 0, calls: 1 };
        return emit('buddyIn', { kind: S.buddyKind, to: S.players[0] });
      }
      B.calls++;
      if (B.phase === 'stay' || B.phase === 'bye') { B.phase = 'treat'; B.t = 0; emit('buddyAgain', { kind: B.kind }); }
      else B.more++;
      return B;
    };

    function stepBuddy(dt) {
      const B = S.buddy;
      if (!B) return;
      B.t += dt;
      const P = S.players[0];
      if (B.phase === 'hello' && B.t > 1.1) { B.phase = 'treat'; B.t = 0; }
      if (B.phase === 'treat' && B.t > 0 && !B.tossed) {
        B.tossed = true;
        const [emoji, name] = TREATS[S.treatI++ % TREATS.length];
        emit('treat', { kind: B.kind, emoji, name, to: P });
      }
      if (B.phase === 'treat' && B.t > 1.6) { B.phase = 'splash'; B.t = 0; B.tossed = false; bigSplash(P); }
      if (B.phase === 'splash' && B.t > 0.9) { B.phase = 'stay'; B.t = 0; }
      if (B.phase === 'stay') {
        if (B.more > 0) { B.more--; B.phase = 'treat'; B.t = 0; }
        else if (B.t > 7) { B.phase = 'bye'; B.t = 0; emit('buddyBye', { kind: B.kind }); }
      }
      if (B.phase === 'bye' && B.t > 1) { S.buddy = null; emit('buddyOut', { kind: B.kind }); }
    }

    // The brother's helper: one BIG SPLASH all round the ship. Every friend's ship nearby is soaked at once, flying
    // splashes are washed away, and your own ship is dried off.
    function bigSplash(P) {
      const R0 = 9.5;
      const e = emit('bigSplash', { x: P.x, y: P.y, r: R0, kind: S.buddyKind, soaked: [] });
      for (let i = S.shots.length - 1; i >= 0; i--) if (S.shots[i].team === 'r') S.shots.splice(i, 1);
      for (const r of S.rivals) {
        if (r.ai === 'dry' || Math.hypot(r.x - P.x, r.y - P.y) > R0) continue;
        if (sab === 'dry') continue;
        battleNote(r, P);
        soakShip(r, P);
        e.soaked.push(r.kind);
      }
      P.soak = 0;
      P.drip = 0;
    }

    // ---------------------------------------------------------------- one tick

    S.step = function (dt) {
      S.t += dt;
      for (let i = 0; i < S.players.length; i++) {
        const P = S.players[i];
        const inp = S.auto[i] ? autoBrain(P, dt) : S.input[i];
        if (S.won && S.t > S.wonT - 1.7) { inp.dx = 0; inp.dy = 0; }
        steer(P, inp, dt);
        if ((inp.fire || inp.press) && !S.won) fire(P);
        S.input[i].press = false;
      }
      for (const r of S.rivals) steer(r, rivalBrain(r, dt), dt);
      for (const s of S.ships) {
        s.x += Math.cos(s.h) * s.v * dt;
        s.y += Math.sin(s.h) * s.v * dt;
        s.cool = Math.max(0, s.cool - dt);
        s.dig = Math.max(0, s.dig - dt);
        s.drip = Math.max(0, s.drip - dt);
        if (s.spin > 0) { s.spin = Math.max(0, s.spin - dt); s.h += dt * 9; }
        // a soak dries off slowly once nobody's splashing you
        if (s.soak > 0 && S.t - s.lastHit > 5) { s.soak = Math.max(0, s.soak - dt * 0.5); }
      }
      separate();
      for (const s of S.ships) collide(s);
      stepShots(dt);
      for (const P of S.players) land(P);
      // coins: dropped ones slide to a stop; anyone who sails over one picks it up (friends too, for fun)
      for (let i = S.coins.length - 1; i >= 0; i--) {
        const c = S.coins[i];
        if (c.vx || c.vy) {
          c.x = clamp(c.x + c.vx * dt, 0.8, sea.size - 0.8);
          c.y = clamp(c.y + c.vy * dt, 0.8, sea.size - 0.8);
          const k = Math.exp(-2.5 * dt);
          c.vx *= k; c.vy *= k;
          if (Math.hypot(c.vx, c.vy) < 0.05) c.vx = c.vy = 0;
        }
        if (S.t - c.born < 0.5) continue;
        const P = S.players.find((s) => Math.hypot(s.x - c.x, s.y - c.y) < 1.4);
        if (P) { P.coins += 1; S.coins.splice(i, 1); emit('coin', { ship: P, x: c.x, y: c.y }); }
      }
      S.coinT -= dt;
      if (S.coins.length < L.coins / 2 && S.coinT <= 0) { S.coinT = 3; const c = spawnCoin(); if (c) emit('coinUp', { coin: c }); }
      stepBuddy(dt);
      stepBattles(dt);
      if (S.won && !S.winSaid && S.t >= S.wonT) {
        S.winSaid = true;
        for (const bt of S.battles) S.ended.push({ p: bt.p.kind, r: bt.r.kind, how: 'voyage over', dur: S.t - bt.start });
        S.battles.length = 0;
        emit('win', { by: S.winner });
      }
    };

    S.give = function (what) {
      // test hook: jump to the last treasure, or win now
      if (what === 'last') { while (S.ti < S.targets.length - 1) { S.targets[S.ti].found = true; S.ti++; } S.clue = makeClue(S, S.targets[S.ti]); emit('clue', { clue: S.clue }); }
      if (what === 'win') { const P = S.players[0]; const isl = S.targets[S.ti]; P.x = isl.x; P.y = isl.y + DOCK - 0.2; P.dock = null; }
    };
    return S;
  }

  TT.sim = { SQ, ISLAND_R, ROCK_R, SHIP_R, DOCK, LEVELS, ISLANDS, WINDS, TREATS, wind, makeSea, seaProblems, flood, shoreOf, path, readClue, stepsClue, create, rng, angDiff, cellOf };
})();
