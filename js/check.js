/* TT Pirates: the headless check of the rules (no Three.js; tools/check.js runs it in Node, game.check() in the page).
   1. navigation: the stick sails the ship the way it points (all 8 winds), the compass words point the right way, and
      NORMAL's step clues ("from 🐚, 2 NORTH, 1 EAST") land exactly on the treasure island.
   2. every island reachable: on hundreds of seas, every island has open water next to it that the start can sail to
      (worked out here, separately from the sea maker), and the autopilot really sails up to each one.
   3. battles end: splash fights with friends always finish (somebody gets soaked, or they sail apart), whether you
      fight back or just sit there.
   4. whole voyages: the autopilot reads each clue the way a kid would and finds every treasure, 1 and 2 players.
   check({ sabotage }) runs the same check on a deliberately broken game, to prove the check can fail:
   'flip' (the compass swaps EAST and WEST), 'mirror' (the stick steers backwards), 'wall' (rocks ring an island),
   'dry' (water cannons don't soak). */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});
  const M = TT.sim;
  const SQ = M.SQ;

  // The check's own compass, written out separately from the game's.
  const VEC = {
    NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0],
    'NORTH-EAST': [1, -1], 'NORTH-WEST': [-1, -1], 'SOUTH-EAST': [1, 1], 'SOUTH-WEST': [-1, 1],
  };
  const angle = (ax, ay, bx, by) => {
    const c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  };

  // an empty sea for steering tests
  function openSea(n = 9) {
    return { n, size: n * SQ, grid: new Array(n * n).fill(0), islands: [], rocks: [], start: [Math.floor(n / 2), Math.floor(n / 2)], homes: [[0, 0], [n - 1, 0]], seed: 1 };
  }

  // Islands you can sail to, by the check's own flood fill (4 neighbours, so no squeezing between corners).
  function reachable(sea) {
    const n = sea.n, seen = new Set(), q = [sea.start];
    const water = (x, y) => x >= 0 && y >= 0 && x < n && y < n && sea.grid[y * n + x] === 0;
    if (!water(sea.start[0], sea.start[1])) return { islands: [], seen };
    seen.add(sea.start.join(','));
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (water(x + dx, y + dy) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); }
      }
    }
    const ok = sea.islands.filter((i) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${i.cx + dx},${i.cy + dy}`)));
    return { islands: ok, seen };
  }

  function makeSea(seed, level, sab) {
    if (sab !== 'wall') return M.makeSea(seed, level);
    // ring one island with rocks (the sea maker would never)
    const sea = M.makeSea(seed, level);
    const isl = sea.islands.find((i) => i.cx > 0 && i.cy > 0 && i.cx < sea.n - 1 && i.cy < sea.n - 1) || sea.islands[0];
    for (let y = isl.cy - 1; y <= isl.cy + 1; y++) for (let x = isl.cx - 1; x <= isl.cx + 1; x++) {
      if (x < 0 || y < 0 || x >= sea.n || y >= sea.n || sea.grid[y * sea.n + x]) continue;
      sea.grid[y * sea.n + x] = 2;
      sea.rocks.push({ cx: x, cy: y, x: (x + 0.5) * SQ, y: (y + 0.5) * SQ, r: M.ROCK_R, spin: 0 });
    }
    return sea;
  }

  function run(S, secs, until) {
    const dt = 1 / 30;
    for (let t = 0; t < secs; t += dt) {
      S.step(dt);
      S.events.length = 0;
      if (until && until()) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- 1. navigation

  function navigation(o) {
    const probs = [];
    let checks = 0;
    // the stick: hold each wind for 2.5 s in an open sea and see which way the ship went
    for (const level of ['easy', 'normal']) {
      for (const name of Object.keys(VEC)) {
        const S = M.create({ level, sea: openSea(), rivals: [], seed: 5, sabotage: o.sabotage });
        S.coins.length = 0;
        const P = S.players[0];
        const x0 = P.x, y0 = P.y;
        S.input[0].dx = VEC[name][0];
        S.input[0].dy = VEC[name][1];
        run(S, 2.5);
        checks++;
        const err = angle(P.x - x0, P.y - y0, VEC[name][0], VEC[name][1]);
        if (!(err < 20) || Math.hypot(P.x - x0, P.y - y0) < 3) probs.push(`${level}: holding ${name} sailed ${err.toFixed(0)}° off`);
      }
    }
    // the compass words: the wind's name must point within 31° of the true direction
    const R = M.rng(99);
    for (let k = 0; k < 2000; k++) {
      const dx = R() * 2 - 1, dy = R() * 2 - 1;
      if (Math.hypot(dx, dy) < 0.05) continue;
      const w = M.wind(dx, dy, o.sabotage);
      checks++;
      const err = angle(dx, dy, VEC[w[0]][0], VEC[w[0]][1]);
      if (err > 31) { probs.push(`compass says ${w[0]} for a bearing ${err.toFixed(0)}° away`); break; }
    }
    // NORMAL's step clues: count the squares from the landmark, by the words, and you're on the treasure island
    let clues = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const sea = M.makeSea(seed, 'normal');
      const R2 = M.rng(seed);
      for (const target of sea.islands) {
        const c = M.stepsClue(sea, target, R2, o.sabotage);
        const from = sea.islands.find((i) => i.id === c.from);
        let x = from.cx, y = from.cy;
        for (const p of c.parts) {
          if (!(p.n >= 1) || !VEC[p.dir] || /-/.test(p.dir)) { probs.push(`seed ${seed}: odd step ${p.n} ${p.dir}`); break; }
          x += VEC[p.dir][0] * p.n;
          y += VEC[p.dir][1] * p.n;
        }
        clues++;
        checks++;
        if (x !== target.cx || y !== target.cy) { probs.push(`seed ${seed}: the clue from ${from.name} leads to ${x},${y}, not ${target.name}`); break; }
        if (c.from === c.target) { probs.push(`seed ${seed}: a clue starts on its own treasure`); break; }
      }
      if (probs.length > 6) break;
    }
    return { name: 'navigation', checks, clues, probs };
  }

  // ---------------------------------------------------------------- 2. every island reachable

  function islands(o) {
    const probs = [];
    let seas = 0, isl = 0, sailed = 0;
    for (const level of ['easy', 'normal']) {
      for (let seed = 1; seed <= (o.seas || 200); seed++) {
        const sea = makeSea(seed, level, o.sabotage);
        seas++;
        const r = reachable(sea);
        isl += sea.islands.length;
        if (sea.islands.length !== M.LEVELS[level].islands) probs.push(`${level} seed ${seed}: ${sea.islands.length} islands`);
        for (const i of sea.islands) if (!r.islands.includes(i)) probs.push(`${level} seed ${seed}: ${i.name} can't be reached`);
        for (const [hx, hy] of sea.homes) if (!r.seen.has(`${hx},${hy}`)) probs.push(`${level} seed ${seed}: a friend's home is cut off`);
        if (probs.length > 6) break;
      }
      // really sail there: the autopilot from the start to every island, on some of the seas
      for (let seed = 1; seed <= (o.sail || 12); seed++) {
        const sea = makeSea(seed, level, o.sabotage);
        for (const target of sea.islands) {
          const S = M.create({ level, sea, rivals: [], seed });
          const P = S.players[0];
          const shore = M.shoreOf(sea, target);
          const ok = shore.length && run(S, 60, () => {
            const g = S.followTo(P, shore, [target.x, target.y], 1 / 30);
            const d = Math.hypot(g.dx, g.dy) || 1;
            S.input[0].dx = g.dx / d;
            S.input[0].dy = g.dy / d;
            return Math.hypot(P.x - target.x, P.y - target.y) < M.DOCK;
          });
          sailed++;
          if (!ok) { probs.push(`${level} seed ${seed}: the autopilot couldn't sail to ${target.name}`); break; }
        }
        if (probs.length > 6) break;
      }
    }
    return { name: 'every island reachable', seas, islands: isl, sailed, probs };
  }

  // ---------------------------------------------------------------- 3. battles end

  function battles(o) {
    const probs = [];
    const LIMIT = 45;
    let fights = 0, soaked = 0;
    for (const level of ['easy', 'normal']) {
      for (const mode of ['fight', 'sit']) {
        let soakedHere = 0;
        for (let seed = 1; seed <= (o.fights || 6); seed++) {
          const S = M.create({ level, seed: 1000 + seed, sabotage: o.sabotage });
          S.auto[0] = true;
          S.autoMode[0] = mode;
          if (mode === 'sit') S.rivals.forEach((r) => { r.calm = 0; });
          let stuck = null;
          run(S, 150, () => {
            for (const bt of S.battles) if (S.t - bt.start > LIMIT) { stuck = bt; return true; }
            return false;
          });
          for (const e of S.ended) {
            fights++;
            if (e.dur > LIMIT) probs.push(`${level} ${mode} seed ${seed}: a battle took ${e.dur.toFixed(0)} s`);
            if (e.how === 'soaked') soakedHere++;
          }
          soaked += S.ended.filter((e) => e.how === 'soaked').length;
          if (stuck) probs.push(`${level} ${mode} seed ${seed}: ${stuck.p.kind} vs ${stuck.r.kind} still splashing after ${LIMIT} s`);
          if (probs.length > 6) break;
        }
        if (!soakedHere) probs.push(`${level} ${mode}: no battle ended with a soaked ship`);
      }
    }
    return { name: 'battles end', fights, soaked, probs };
  }

  // ---------------------------------------------------------------- 4. whole voyages

  function voyages(o) {
    const probs = [];
    let runs = 0, found = 0, time = 0;
    for (const level of ['easy', 'normal']) {
      for (const players of [['teddy'], ['tommy'], ['teddy', 'tommy']]) {
        for (let seed = 1; seed <= (o.voyages || 5); seed++) {
          const S = M.create({ level, players, seed: 500 + seed, sabotage: o.sabotage });
          S.auto = players.map(() => true);
          const ok = run(S, 400, () => S.winSaid);
          runs++;
          found += S.ti;
          time += S.t;
          if (!ok) probs.push(`${level} ${players.join('+')} seed ${seed}: found ${S.ti} of ${S.targets.length} treasures in 400 s`);
          if (probs.length > 6) break;
        }
      }
    }
    return { name: 'whole voyages', runs, found, avgTime: Math.round(time / Math.max(1, runs)), probs };
  }

  function check(o = {}) {
    const parts = [navigation(o), islands(o), battles(o), voyages(o)];
    return { ok: parts.every((p) => !p.probs.length), sabotage: o.sabotage || null, parts };
  }

  TT.check = { check, navigation, islands, battles, voyages, reachable, openSea, SABOTAGES: ['flip', 'mirror', 'wall', 'dry'] };
})();
