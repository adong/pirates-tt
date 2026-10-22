/* TT Pirates: the game. Sets up Three.js, runs the rules (js/sim.js) at a fixed 60 ticks a second, turns the rules'
   events into splashes, coins, treasure chests, sounds, toasts and the HUD (the treasure map and the compass), and
   handles menus, keys and touch. Test hooks live on window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const T = THREE;
  const TT = window.TT;
  const G = Kit.gfx;
  const A = TT.art;
  const M = TT.sim;
  const SFX = TT.sfx;
  const $ = (id) => document.getElementById(id);
  const DT = 1 / 60;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY', froggy: 'FROGGY' };
  const t = (s) => Kit.lang.t(s);

  // ---------------------------------------------------------------- storage

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const settings = Object.assign({ level: 'easy', players: ['teddy'] }, store.get('piratesTT.settings', {}));
  const best = store.get('piratesTT.best', {});
  const saveSettings = () => store.set('piratesTT.settings', settings);

  // ---------------------------------------------------------------- renderer, scene, camera

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  scene.background = new T.Color('#1f78c4');
  scene.fog = new T.Fog('#1f78c4', 60, 140);
  const camera = new T.PerspectiveCamera(40, 1, 0.5, 300);
  scene.add(new T.HemisphereLight('#ffffff', '#3a6a8a', 0.85));
  const sun = new T.DirectionalLight('#fff3dc', 1.05);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const fx = A.makeFx(scene);
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (touch) document.body.classList.add('touch');

  // pictures for the menus and the HUD
  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 152 });
  document.querySelectorAll('img[data-face]').forEach((img) => { img.src = faces[img.dataset.face]; });

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'title', modeT: 0, time: 0, demo: false, players: ['teddy'], level: settings.level, S: null, sea3d: null,
    views: new Map(), shots: new Map(), coins: new Map(), toasts: [], banner: null, anims: [], frozen: false,
    keepAwake: false, shake: 0, hold: [null, null], cel: null, clueAt: 0, mapDirty: true, streak: 0, streakT: 0, lastToast: {},
  };
  const cam = { x: 0, z: 0, d: 30, el: 0.95, init: false };

  // ---------------------------------------------------------------- the voyage

  function clearWorld() {
    if (st.sea3d) st.sea3d.dispose();
    st.sea3d = null;
    for (const v of st.views.values()) scene.remove(v.root);
    st.views.clear();
    for (const m of st.shots.values()) scene.remove(m);
    st.shots.clear();
    for (const m of st.coins.values()) scene.remove(m);
    st.coins.clear();
    for (const a of st.anims) if (a.cleanup) a.cleanup();
    st.anims.length = 0;
    fx.clear();
    st.cel = null;
  }

  function newVoyage(players, level, demo) {
    clearWorld();
    st.players = players;
    st.level = level;
    st.demo = demo;
    const S = M.create({ level, players, buddyFor: Kit.roster.buddyFor });
    st.S = S;
    st.sea3d = A.makeSea(scene, S.sea);
    for (const s of S.ships) {
      const v = A.makeShip(s.kind);
      v.s = s;
      scene.add(v.root);
      if (s.team === 'r') {
        const tag = G.nameTag(NAMES[s.kind], Kit.roster.get(s.kind).tag || '#ffb02e');
        tag.position.y = 3.6;
        tag.scale.multiplyScalar(0.9);
        v.root.add(tag);
      }
      st.views.set(s.id, v);
    }
    for (const c of S.coins) addCoinView(c);
    if (demo) { S.auto = players.map(() => true); }
    st.sea3d.show(S);
    st.clueAt = 0;
    st.mapDirty = true;
    st.voyageT = 0;
    st.toasts.forEach((o) => o.el.remove());
    st.toasts.length = 0;
    cam.init = false;
    setupHud();
  }

  function addCoinView(c) {
    const m = A.makeCoin();
    m.position.copy(st.sea3d.pos(c.x, c.y, 0.45));
    m.userData.ph = Math.random() * 6;
    scene.add(m);
    st.coins.set(c.id, m);
    return m;
  }

  // ---------------------------------------------------------------- events from the rules

  const P3 = (s, h = 0) => st.sea3d.pos(s.x, s.y, h);
  const nameOf = (s) => NAMES[s.kind];

  function onEvent(e) {
    const S = st.S;
    const loud = !st.demo;
    switch (e.type) {
      case 'fire': {
        const v = st.views.get(e.ship.id);
        if (v) v.kick = 1;
        if (v && e.ship.team === 'p') { v.pose = 'give'; v.poseT = 0.25; }
        if (loud && near(e.ship)) SFX.squirt();
        break;
      }
      case 'splash':
        fx.splash(st.sea3d.pos(e.x, e.y, e.on === 'water' ? 0 : 0.4), false);
        if (loud && near(e)) SFX.plip();
        break;
      case 'hit': {
        const s = e.ship;
        fx.splash(P3(s, 0.6), true);
        fx.word(['SPLASH!', 'SPLOOSH!', 'SPLISH!'][Math.floor(Math.random() * 3)], P3(s), s.team === 'p' ? '#ffd0d0' : '#8fe3ff', 2);
        if (loud) { SFX.splash(); if (s.team === 'p') { SFX.brr(); bumpCard(s.i); } }
        break;
      }
      case 'soaked': {
        const s = e.ship;
        fx.splash(P3(s, 0.6), true);
        fx.droplets(P3(s, 1), 22, { speed: 3, up: 7, size: 0.4 });
        fx.word('SOAKED!', P3(s, 0.6), '#5ad0ff', 2.6);
        if (!loud) break;
        SFX.soaked();
        if (s.team === 'r') {
          const by = e.by && e.by.team === 'p' ? e.by : null;
          toast(by && S.players.length > 1 ? `${nameOf(by)} SOAKED ${nameOf(s)}! 🪙🪙🪙` : `${nameOf(s)} IS SOAKED! 🪙🪙🪙`, 'good', 2.2);
        } else {
          toast(S.players.length > 1 ? `${nameOf(s)} GOT SOAKED!` : 'YOU GOT SOAKED!', 'oops', 2);
          const v = st.views.get(s.id);
          if (v) { v.pose = 'fall'; v.poseT = 1.2; }
        }
        break;
      }
      case 'blocked':
        fx.word('BLOCKED!', P3(e.ship, 0.4), '#ffd400', 1.8);
        fx.sparkle(P3(e.ship, 1), 6, '#bff0ff');
        if (loud) { SFX.blocked(); toastOnce('block', `${NAMES[e.buddy]} BLOCKED IT!`, 'buddy', 1.6, 2.5); }
        break;
      case 'coin': {
        const m = st.coins.get(findCoinId(e));
        fx.sparkle(st.sea3d.pos(e.x, e.y, 0.6), 6);
        if (loud) {
          st.streak = st.time - st.streakT < 1.5 ? st.streak + 1 : 0;
          st.streakT = st.time;
          Kit.sound.coin(st.streak);
          bumpCard(e.ship.i);
        }
        if (m) { scene.remove(m); }
        break;
      }
      case 'coinUp': addCoinView(e.coin).scale.setScalar(0.01); break;
      case 'treasure': {
        const I = e.island;
        const v3 = st.sea3d.isl.get(I.id);
        st.sea3d.show(S);
        const p = st.sea3d.pos(I.x, I.y, 0.6);
        fx.sparkle(p, 18);
        fx.confetti(p, 24);
        fx.word('TREASURE!', p, '#ffd400', 2.8);
        const v = st.views.get(e.ship.id);
        if (v) { v.pose = 'dig'; v.poseT = 1.7; }
        if (v3) v3.rise = 0;
        if (loud) {
          SFX.treasure();
          const left = S.left();
          toast(left ? `💰 TREASURE! +10 · ${left} MORE TO FIND` : '💰 TREASURE! +10', 'good', 2.6);
          bumpCard(e.ship.i);
        }
        st.mapDirty = true;
        break;
      }
      case 'wrong':
        if (!loud) break;
        SFX.wrong();
        fx.word('NOT HERE!', st.sea3d.pos(e.island.x, e.island.y, 0.5), '#ffffff', 2.2);
        if (S.L.clue === 'arrow') toastOnce('wrong', 'NO TREASURE HERE! FOLLOW THE ARROW', 'oops', 2.4, 2);
        else if (e.hint === 1) toastOnce('wrong', 'NOT HERE! NOW THE MAP SHOWS THE WAY', 'oops', 2.6, 2);
        else toastOnce('wrong', 'NOT HERE! LOOK FOR THE ❌ ON THE MAP', 'oops', 2.6, 2);
        flashMap();
        st.sea3d.show(S);
        st.mapDirty = true;
        break;
      case 'dug':
        if (loud) toastOnce('dug', 'WE ALREADY FOUND THIS ONE!', '', 1.6, 4);
        break;
      case 'clue':
        st.clueAt = st.time + (e.after || 0);
        st.mapDirty = true;
        break;
      case 'win':
        st.sea3d.show(S);
        if (st.demo) { st.restartDemoAt = st.time + 3; break; }
        startCelebrate();
        break;
      case 'buddyIn': {
        const v = st.views.get(e.to.id);
        if (!v) break;
        if (v.buddy) { v.body.remove(v.buddy.p.root); v.buddy = null; }
        v.buddy = A.addBuddy(v, e.kind);
        v.buddy.pose = Kit.roster.signature(Kit.roster.get(e.kind), 'hello');
        v.buddy.t = 0;
        v.buddy.pop = 0;
        fx.sparkle(P3(e.to, 1), 14, '#ffe08a');
        if (loud) { SFX.pop(); toast(`${NAMES[e.kind]} IS HERE! ⛵`, 'buddy', 1.6); }
        break;
      }
      case 'treat': throwTreat(e); break;
      case 'bigSplash': {
        const p = st.sea3d.pos(e.x, e.y, 0);
        fx.bigSplash(p, e.r);
        st.shake = 0.5;
        const v = st.views.get(S.players[0].id);
        if (v && v.buddy) { v.buddy.pose = 'jumpshot'; v.buddy.t = 0; }
        if (loud) {
          SFX.bigSplash();
          toast(`${NAMES[e.kind]} SAYS: BIG SPLASH!`, 'buddy', 2.4);
        }
        break;
      }
      case 'buddyBye': {
        const v = st.views.get(S.players[0].id);
        if (v && v.buddy) { v.buddy.pose = Kit.roster.signature(Kit.roster.get(e.kind), 'goodbye'); v.buddy.t = 0; }
        break;
      }
      case 'buddyOut': {
        const v = st.views.get(S.players[0].id);
        if (v && v.buddy) {
          fx.sparkle(P3(S.players[0], 1), 12, '#ffe08a');
          v.body.remove(v.buddy.p.root);
          v.buddy = null;
          if (loud) SFX.pop();
        }
        break;
      }
      case 'highFive': highFive(); break;
      case 'dried': fx.sparkle(P3(e.ship, 1), 6, '#fff3a0'); if (loud && near(e.ship)) SFX.dried(); break;
      case 'bump': if (loud) Kit.sound.bump(); break;
      default: break;
    }
  }

  // which coin view a 'coin' event took (the rules drop it from their list)
  function findCoinId(e) {
    for (const [id, m] of st.coins) if (!st.S.coins.some((c) => c.id === id)) { st.coins.delete(id); return id; }
    return -1;
  }

  // is this thing on screen-ish (for sounds)?
  function near(o) {
    if (!st.S) return false;
    const p = st.sea3d.pos(o.x, o.y);
    return Math.abs(p.x - cam.x) < 16 && Math.abs(p.z - cam.z) < 14;
  }

  // the brother's treat: it arcs from him to the captain
  function throwTreat(e) {
    const v = st.views.get(e.to.id);
    if (!v) return;
    const spr = A.spriteOf(G.emojiTexture(e.emoji), 0.7, { depthTest: false });
    spr.renderOrder = 9;
    scene.add(spr);
    if (!st.demo) SFX.treat();
    st.anims.push({
      t: 0, dur: 0.9,
      tick(a, dt) {
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        const p = P3(e.to);
        spr.position.set(p.x + 0.4 * (1 - k), 1.4 + Math.sin(k * Math.PI) * 2.4, p.z + 0.4 * (1 - k));
        spr.material.rotation = k * 6;
        if (k >= 1) {
          fx.sparkle(P3(e.to, 1.2), 8);
          if (!st.demo) toast(`${e.emoji} ${e.name} FROM ${NAMES[e.kind]}!`, 'good', 2);
          return true;
        }
        return false;
      },
      cleanup() { scene.remove(spr); },
    });
  }

  // 2 players: T is a high five. Both captains jump, two hands fly together, stars.
  function highFive() {
    const S = st.S;
    const [a, b] = S.players;
    const pa = P3(a, 1.6), pb = P3(b, 1.6);
    const mid = pa.clone().lerp(pb, 0.5);
    for (const P of S.players) { const v = st.views.get(P.id); v.pose = 'jump'; v.poseT = 0.7; }
    const hands = [pa, pb].map((p) => { const s = A.spriteOf(G.emojiTexture('✋'), 0.9, { depthTest: false }); s.renderOrder = 9; s.position.copy(p); scene.add(s); return s; });
    SFX.clap();
    st.anims.push({
      t: 0,
      tick(o, dt) {
        o.t += dt;
        const k = Math.min(1, o.t / 0.45);
        hands[0].position.copy(pa).lerp(mid, smooth(k)).y += Math.sin(k * Math.PI) * 1.2;
        hands[1].position.copy(pb).lerp(mid, smooth(k)).y += Math.sin(k * Math.PI) * 1.2;
        if (k >= 1 && !o.done) {
          o.done = true;
          fx.sparkle(mid, 16);
          fx.word('HIGH FIVE!', mid, '#ffd400', 2.6);
          SFX.clap();
          toast('HIGH FIVE! 🙌', 'good', 1.6);
        }
        return o.t > 0.9;
      },
      cleanup() { hands.forEach((h) => scene.remove(h)); },
    });
  }

  // ---------------------------------------------------------------- toasts, banner

  function toast(text, cls = '', dur = 1.8) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    st.toasts.unshift({ el, born: st.time, dur });
    while (st.toasts.length > 4) st.toasts.pop().el.remove();
  }
  function toastOnce(key, text, cls, dur, gap) {
    if (st.time - (st.lastToast[key] || -99) < gap) return;
    st.lastToast[key] = st.time;
    toast(text, cls, dur);
  }
  function updateToasts() {
    // high on the screen, clear of the ship in the middle (under the treasure map on a tall phone)
    const h = window.innerHeight, portrait = document.body.classList.contains('portrait');
    const y0 = portrait ? $('mapCard').getBoundingClientRect().bottom + 10 : h * 0.13;
    for (let i = st.toasts.length - 1; i >= 0; i--) {
      const o = st.toasts[i];
      const age = st.time - o.born;
      if (age > o.dur) { o.el.remove(); st.toasts.splice(i, 1); continue; }
      const kin = Math.min(1, age / 0.18), kout = clamp((o.dur - age) / 0.3, 0, 1);
      const sc = kin < 1 ? 1.6 - 0.6 * smooth(kin) : 1;
      o.el.style.opacity = String(Math.min(kin * 1.5, kout));
      o.el.style.top = `${y0 + i * 44 - (1 - kout) * 20}px`;
      o.el.style.transform = `translateX(-50%) scale(${sc})`;
    }
  }
  function banner(html, dur = 2) {
    const el = $('banner');
    el.innerHTML = html;
    el.classList.remove('hidden');
    st.banner = { born: st.time, dur };
  }
  function updateBanner() {
    const el = $('banner'), b = st.banner;
    if (!b) return;
    const age = st.time - b.born;
    if (age > b.dur) { el.classList.add('hidden'); st.banner = null; return; }
    const kin = Math.min(1, age / 0.3);
    el.style.top = `${window.innerHeight * 0.14}px`;
    el.style.opacity = String(Math.min(kin * 2, clamp((b.dur - age) / 0.3, 0, 1)));
    el.style.transform = `scale(${kin < 1 ? 2 - smooth(kin) : 1})`;
  }
  function flashMap() {
    const el = $('mapCard');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  const cardBump = [-9, -9];
  function bumpCard(i) { if (i >= 0) cardBump[i] = st.time; }

  // ---------------------------------------------------------------- the HUD: cards, treasure map, compass

  function setupHud() {
    const S = st.S;
    for (let i = 0; i < 2; i++) {
      const el = $('card' + i);
      const P = S.players[i];
      el.classList.toggle('hidden', !P || st.demo);
      if (!P) continue;
      el.className = 'card ' + P.kind + (st.demo ? ' hidden' : '');
      el.querySelector('img').src = faces[P.kind];
      el.querySelector('.nm').textContent = NAMES[P.kind];
      el.querySelector('.drops').innerHTML = '<i>💧</i>'.repeat(P.hits);
    }
    const two = S.players.length === 2;
    const bud = $('budBtn');
    const imgs = bud.querySelectorAll('img');
    bud.classList.toggle('two', two);
    if (two) {
      imgs[0].src = faces.teddy; imgs[1].src = faces.tommy; imgs[1].classList.remove('hidden');
      bud.querySelector('small').textContent = 'HIGH FIVE';
    } else {
      imgs[0].src = faces[S.buddyKind]; imgs[1].classList.add('hidden');
      bud.querySelector('small').textContent = `CALL ${NAMES[S.buddyKind]}`;
    }
    $('prog').innerHTML = '<i>💰</i>'.repeat(S.targets.length);
    st.hudKey = {};
  }

  function setText(el, key, text) {
    if (st.hudKey[key] === text) return;
    st.hudKey[key] = text;
    el.textContent = text;
  }

  function clueText(S) {
    if (S.won) return 'ALL TREASURE FOUND!';
    const c = S.clue;
    if (c.kind === 'arrow') {
      const tgt = S.target();
      const P = S.players.slice().sort((a, b) => Math.hypot(a.x - tgt.x, a.y - tgt.y) - Math.hypot(b.x - tgt.x, b.y - tgt.y))[0];
      const dx = tgt.x - P.x, dy = tgt.y - P.y;
      if (Math.hypot(dx, dy) < M.DOCK + 0.8) return `${tgt.emoji} LAND HERE!`;
      const w = M.wind(dx, dy);
      return `SAIL ${w[1]} ${w[0]}!`;
    }
    const from = S.island(c.from);
    return `FROM ${from.emoji} SAIL ${c.parts.map((p) => `${p.n} ${p.arrow} ${p.dir}`).join(', ')}`;
  }

  function updateHud() {
    const S = st.S;
    if (!S || st.demo) return;
    S.players.forEach((P, i) => {
      const el = $('card' + i);
      setText(el.querySelector('.coins'), 'c' + i, `🪙 ${P.coins}`);
      const on = Math.ceil(P.soak - 1e-6);
      if (st.hudKey['d' + i] !== on) {
        st.hudKey['d' + i] = on;
        el.querySelectorAll('.drops i').forEach((d, k) => d.classList.toggle('on', k < on));
      }
      el.classList.toggle('bump', st.time - cardBump[i] < 0.35);
    });
    const found = S.ti;
    if (st.hudKey.prog !== found) {
      st.hudKey.prog = found;
      $('prog').querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k < found));
    }
    if (st.time >= st.clueAt) {
      if (st.clueAt) { st.clueAt = 0; flashMap(); if (!st.demo) { SFX.newMap(); toast('🗺️ NEW TREASURE MAP!', 'good', 1.8); } }
      setText($('clue'), 'clue', clueText(S));
    }
    const B = S.buddy;
    $('budBtn').classList.toggle('on', !!B);
    // the compass: which way your ship is pointing
    const P = S.players[0];
    const w = M.wind(Math.cos(P.h), Math.sin(P.h));
    setText($('heading'), 'head', S.players.length > 1 ? `${w[1]} ${w[0]}` : `SAILING ${w[1]} ${w[0]}`);
    drawCompass(S);
  }

  // the treasure map: the whole sea on old paper, with the islands' badges, your ship and the clue drawn on it
  const mapCv = $('mapCv'), mg = mapCv.getContext('2d');
  function drawMap(S) {
    const W = mapCv.width, n = S.sea.n, pad = 16, cs = (W - pad * 2) / n;
    const X = (x) => pad + (x / M.SQ) * cs, Y = (y) => pad + (y / M.SQ) * cs;
    mg.fillStyle = '#f6e7bf';
    mg.fillRect(0, 0, W, W);
    const gr = mg.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W * 0.75);
    gr.addColorStop(0, 'rgba(160,110,40,0)');
    gr.addColorStop(1, 'rgba(160,110,40,0.35)');
    mg.fillStyle = gr;
    mg.fillRect(0, 0, W, W);
    // water squares
    mg.fillStyle = 'rgba(80,170,210,0.22)';
    mg.fillRect(pad, pad, n * cs, n * cs);
    mg.strokeStyle = 'rgba(120,80,30,0.35)';
    mg.lineWidth = 2;
    mg.setLineDash([5, 5]);
    for (let i = 0; i <= n; i++) {
      mg.beginPath(); mg.moveTo(pad + i * cs, pad); mg.lineTo(pad + i * cs, pad + n * cs); mg.stroke();
      mg.beginPath(); mg.moveTo(pad, pad + i * cs); mg.lineTo(pad + n * cs, pad + i * cs); mg.stroke();
    }
    mg.setLineDash([]);
    mg.strokeStyle = 'rgba(90,55,20,0.8)';
    mg.lineWidth = 4;
    mg.strokeRect(pad, pad, n * cs, n * cs);
    // rocks
    mg.fillStyle = '#8d93a3';
    for (const r of S.sea.rocks) { mg.beginPath(); mg.arc(X(r.x), Y(r.y), cs * 0.22, 0, Math.PI * 2); mg.fill(); }
    const c = S.clue, hint = S.hint(), tgt = S.target();
    // NORMAL: ring the landmark island the clue starts from, and after a wrong landing draw the steps
    if (c.kind === 'steps' && tgt) {
      const L = S.island(c.from);
      mg.strokeStyle = '#1d6fd6';
      mg.lineWidth = 5;
      mg.setLineDash([8, 6]);
      mg.beginPath(); mg.arc(X(L.x), Y(L.y), cs * 0.52, 0, Math.PI * 2); mg.stroke();
      mg.setLineDash([]);
      if (hint >= 1) {
        mg.strokeStyle = '#e5322d';
        mg.lineWidth = 5;
        mg.setLineDash([10, 7]);
        mg.beginPath();
        let x = L.cx, y = L.cy;
        mg.moveTo(pad + (x + 0.5) * cs, pad + (y + 0.5) * cs);
        const V = { NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0] };
        for (const p of c.parts) { x += V[p.dir][0] * p.n; y += V[p.dir][1] * p.n; mg.lineTo(pad + (x + 0.5) * cs, pad + (y + 0.5) * cs); }
        mg.stroke();
        mg.setLineDash([]);
      }
    }
    // islands
    mg.textAlign = 'center';
    mg.textBaseline = 'middle';
    for (const I of S.sea.islands) {
      const x = X(I.x), y = Y(I.y);
      mg.fillStyle = I.sand;
      mg.beginPath(); mg.arc(x, y, cs * 0.42, 0, Math.PI * 2); mg.fill();
      mg.strokeStyle = 'rgba(90,55,20,0.6)'; mg.lineWidth = 2; mg.stroke();
      mg.font = `${Math.round(cs * 0.55)}px ${G.EMOJI_FONT}`;
      mg.globalAlpha = I.found ? 0.45 : 1;
      mg.fillText(I.emoji, x, y + cs * 0.04);
      mg.globalAlpha = 1;
      if (I.found) { mg.font = `${Math.round(cs * 0.36)}px ${G.EMOJI_FONT}`; mg.fillText('💰', x + cs * 0.3, y - cs * 0.28); }
    }
    // the X marks the spot
    if (tgt && hint >= 2) {
      const x = X(tgt.x), y = Y(tgt.y), r = cs * 0.34;
      const pulse = 1 + Math.sin(st.time * 6) * 0.08;
      mg.strokeStyle = '#14121f'; mg.lineWidth = 11; mg.lineCap = 'round';
      mg.beginPath(); mg.moveTo(x - r * pulse, y - r * pulse); mg.lineTo(x + r * pulse, y + r * pulse); mg.moveTo(x + r * pulse, y - r * pulse); mg.lineTo(x - r * pulse, y + r * pulse); mg.stroke();
      mg.strokeStyle = '#e5322d'; mg.lineWidth = 7;
      mg.beginPath(); mg.moveTo(x - r * pulse, y - r * pulse); mg.lineTo(x + r * pulse, y + r * pulse); mg.moveTo(x + r * pulse, y - r * pulse); mg.lineTo(x - r * pulse, y + r * pulse); mg.stroke();
      mg.lineCap = 'butt';
    }
    // ships: the friends as small dots, you as an arrow pointing the way you sail
    for (const s of S.ships) {
      const x = X(s.x), y = Y(s.y);
      const col = A.SHIPS[s.kind].hull;
      if (s.team === 'r') {
        mg.globalAlpha = s.ai === 'dry' ? 0.45 : 1;
        mg.font = `${Math.round(cs * 0.42)}px ${G.EMOJI_FONT}`;
        mg.fillStyle = col; mg.beginPath(); mg.arc(x, y, cs * 0.24, 0, Math.PI * 2); mg.fill();
        mg.fillText(A.SHIPS[s.kind].mark, x, y + 1);
        mg.globalAlpha = 1;
        continue;
      }
      mg.save();
      mg.translate(x, y);
      mg.rotate(s.h);
      const k = cs * 0.34;
      mg.fillStyle = col; mg.strokeStyle = '#14121f'; mg.lineWidth = 4;
      mg.beginPath(); mg.moveTo(k * 1.2, 0); mg.lineTo(-k * 0.8, k * 0.75); mg.lineTo(-k * 0.45, 0); mg.lineTo(-k * 0.8, -k * 0.75); mg.closePath();
      mg.stroke(); mg.fill();
      mg.restore();
    }
    // N for north
    mg.fillStyle = '#14121f';
    mg.font = `${Math.round(W * 0.075)}px ${G.FONT}`;
    mg.fillStyle = '#e5322d';
    mg.beginPath(); mg.moveTo(W - 30, 10); mg.lineTo(W - 42, 34); mg.lineTo(W - 18, 34); mg.closePath(); mg.fill();
    mg.fillStyle = '#14121f';
    mg.fillText(t('N', '北'), W - 30, 50);
  }

  const compCv = $('compassCv'), cg = compCv.getContext('2d');
  let compKey = '';
  function drawCompass(S) {
    const P = S.players[0];
    const key = `${P.h.toFixed(2)}|${Kit.lang.get()}`;
    if (key === compKey) return;
    compKey = key;
    const W = compCv.width, c = W / 2;
    cg.clearRect(0, 0, W, W);
    cg.fillStyle = '#f6e7bf';
    cg.beginPath(); cg.arc(c, c, c - 3, 0, Math.PI * 2); cg.fill();
    cg.lineWidth = 5; cg.strokeStyle = '#14121f'; cg.stroke();
    cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.font = `${Math.round(W * 0.2)}px ${G.FONT}`;
    [['N', 0, -1, '#e5322d'], ['E', 1, 0, '#14121f'], ['S', 0, 1, '#14121f'], ['W', -1, 0, '#14121f']].forEach(([l, x, y, col]) => {
      cg.fillStyle = col;
      cg.fillText(A.letter(l), c + x * c * 0.68, c + y * c * 0.68 + 2);
    });
    cg.save();
    cg.translate(c, c);
    cg.rotate(P.h);
    cg.fillStyle = A.SHIPS[P.kind].hull; cg.strokeStyle = '#14121f'; cg.lineWidth = 3;
    cg.beginPath(); cg.moveTo(c * 0.5, 0); cg.lineTo(-c * 0.2, c * 0.16); cg.lineTo(-c * 0.2, -c * 0.16); cg.closePath(); cg.fill(); cg.stroke();
    cg.restore();
    cg.fillStyle = '#14121f'; cg.beginPath(); cg.arc(c, c, 5, 0, Math.PI * 2); cg.fill();
  }
  Kit.lang.onChange(() => { compKey = ''; st.mapDirty = true; if (st.sea3d) st.sea3d.relabel(); if (st.hudKey) st.hudKey = {}; });

  // ---------------------------------------------------------------- the ships on screen

  // the turn (inside a ship turned by yaw) that makes a person face the camera; people face -z
  function faceCam(p, yaw) { return Math.atan2(-(cam.camX - p.x), -(cam.camZ - p.z)) - yaw; }

  function syncViews(dt) {
    const S = st.S;
    if (!S) return;
    for (const v of st.views.values()) {
      const s = v.s;
      const p = P3(s);
      v.phase += dt;
      v.root.position.set(p.x, Math.sin(st.time * 2 + v.phase * 0) * 0.05 + Math.sin(st.time * 2.3 + s.id) * 0.04, p.z);
      const yaw = -s.h - Math.PI / 2;
      const turn = v.lastYaw === undefined ? 0 : M.angDiff(v.lastYaw, yaw) / Math.max(dt, 1e-3);
      v.lastYaw = yaw;
      v.root.rotation.y = yaw;
      v.lean = lerp(v.lean || 0, clamp(-turn * 0.06, -0.25, 0.25), 1 - Math.exp(-6 * dt));
      v.body.rotation.z = v.lean + Math.sin(st.time * 1.7 + s.id) * 0.03;
      v.body.rotation.x = Math.sin(st.time * 2.1 + s.id) * 0.025 - Math.min(0.08, Math.abs(s.v) * 0.012);
      v.flag.rotation.y = Math.sin(st.time * 6 + s.id) * 0.35;
      v.kick = Math.max(0, (v.kick || 0) - dt * 5);
      v.cannon.position.z = -0.85 + v.kick * 0.12;
      // wake: little foam rings behind a moving ship
      v.wakeT = (v.wakeT || 0) - dt;
      if (Math.abs(s.v) > 1.2 && v.wakeT <= 0) {
        v.wakeT = 0.16;
        const b = st.sea3d.pos(s.x - Math.cos(s.h) * 1.2, s.y - Math.sin(s.h) * 1.2);
        fx.ring(b, 0.2, 0.75, 0.7, '#ffffff', 0.55);
      }
      // the soak meter: always for the friends, for you only while you're wet
      const show = s.team === 'r' || s.soak > 0.01 || s.drip > 0;
      v.meter.visible = show && !(st.cel && s.team === 'r');
      if (show) v.setSoak(s.soak, s.hits, s.ai === 'dry');
      // dripping wet
      if (s.drip > 0 && Math.random() < dt * 10) fx.droplets(P3(s, 1.4), 1, { speed: 0.6, up: 0.5, size: 0.2 });
      // captain's pose
      const per = v.person;
      let mode = 'stand';
      if (v.poseT > 0) { v.poseT -= dt; mode = v.pose; }
      if (s.dig > 0) mode = Math.floor(st.time * 5) % 2 ? 'grab' : 'stand';
      if (s.spin > 0) mode = 'fall';
      if (st.cel && v.cel) mode = v.cel.mode;
      if (mode === 'dig') mode = 'grab';
      Kit.people.pose(per, st.time * 6, mode, 1 - Math.exp(-14 * dt));
      per.root.position.y = 0.42 + (mode === 'jump' ? Math.abs(Math.sin(st.time * 9)) * 0.25 : 0) + (v.cel ? v.cel.hop : 0);
      per.root.rotation.y += M.angDiff(per.root.rotation.y, v.cel ? faceCam(p, yaw) : 0) * (1 - Math.exp(-6 * dt));
      // the brother on deck
      if (v.buddy) {
        const B = v.buddy;
        B.t += dt;
        B.pop = Math.min(1, B.pop + dt * 4);
        B.p.root.scale.setScalar(B.s * (B.pop < 1 ? 0.3 + 0.7 * smooth(B.pop) + Math.sin(B.pop * Math.PI) * 0.25 : 1));
        let bm = B.pose;
        if (bm === 'jumpshot' && B.t > 1.1) bm = 'wave';
        if (bm === 'boxing' && B.t > 1.2 && S.buddy && S.buddy.phase === 'stay') bm = 'wave';
        Kit.people.pose(B.p, st.time * 6, bm, 1 - Math.exp(-14 * dt));
        B.p.root.position.y = 0.42 + (bm === 'jumpshot' && B.t < 0.8 ? Math.sin((B.t / 0.8) * Math.PI) * 0.3 : 0);
        B.p.root.rotation.y += M.angDiff(B.p.root.rotation.y, faceCam(p, yaw)) * (1 - Math.exp(-6 * dt));
      }
    }
    // splashes in flight
    for (const b of S.shots) {
      let m = st.shots.get(b.id);
      if (!m) { m = A.makeShot(); scene.add(m); st.shots.set(b.id, m); }
      const p = st.sea3d.pos(b.x, b.y, 0.7 + Math.sin((b.t / b.life) * Math.PI) * 0.9);
      m.position.copy(p);
      m.userData.live = true;
      if (Math.random() < dt * 25) fx.droplets(p, 1, { speed: 0.4, up: 0.2, size: 0.16 });
    }
    for (const [id, m] of st.shots) {
      if (!m.userData.live) { scene.remove(m); st.shots.delete(id); } else m.userData.live = false;
    }
    // coins bob and spin; dropped ones slide
    for (const c of S.coins) {
      const m = st.coins.get(c.id);
      if (!m) continue;
      m.position.copy(st.sea3d.pos(c.x, c.y, 0.45 + Math.sin(st.time * 3 + m.userData.ph) * 0.08));
      m.rotation.y += dt * 2.5;
      if (m.scale.x < 1) m.scale.setScalar(Math.min(1, m.scale.x + dt * 3));
    }
  }

  // ---------------------------------------------------------------- camera

  function freeRect(w, h, portrait) {
    // the title: the demo ship sails in the free corner beside the menu
    if (st.mode === 'title') return portrait ? { x: 0, y: h * 0.72, w, h: h * 0.28 } : { x: 0, y: h * 0.42, w: w * 0.3, h: h * 0.58 };
    if (!['play', 'pause'].includes(st.mode) || st.demo) return { x: 0, y: 0, w, h };
    const r = $('mapCard').getBoundingClientRect();
    if (!portrait) return { x: 0, y: 0, w: Math.max(w * 0.5, r.left - 6), h };
    const bot = touch ? (st.players.length > 1 ? 300 : 175) : 80;
    const top = Math.min(h * 0.45, r.bottom + 6);
    return { x: 0, y: top, w, h: Math.max(h * 0.4, h - top - bot) };
  }

  function updateCamera(dt) {
    const S = st.S;
    if (!S) return;
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = h > w * 1.08;
    const half = S.sea.size / 2;
    let tx, tz, needW = portrait ? 13 : st.level === 'easy' ? 19 : 21, needH = portrait ? 15 : 13, el = 0.95;
    if (st.mode === 'title') { needW = 8; needH = 7; }
    const ps = st.demo ? S.players.slice(0, 1) : S.players;
    const pts = ps.map((P) => P3(P));
    tx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    tz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    if (pts.length === 2) {
      needW = Math.max(needW, Math.abs(pts[0].x - pts[1].x) + 9);
      needH = Math.max(needH, Math.abs(pts[0].z - pts[1].z) + 8);
    }
    if (st.cel) {
      const k = smooth(clamp(st.cel.t / 1.2, 0, 1));
      needW = lerp(needW, pts.length === 2 ? Math.max(9, Math.abs(pts[0].x - pts[1].x) + 6) : 6.5, k);
      needH = lerp(needH, pts.length === 2 ? Math.max(6, Math.abs(pts[0].z - pts[1].z) + 5) : 4.5, k);
      el = lerp(0.95, 0.5, k);
    }
    // keep the view on the sea (a little ocean beyond the edge is fine)
    const mx = Math.max(0, half - needW / 2 + 3), mz = Math.max(0, half - needH / 2 + 3);
    if (!st.cel) { tx = clamp(tx, -mx, mx); tz = clamp(tz, -mz, mz); }
    // aim at the part of the screen the HUD leaves free (beside the treasure map, or under it on a tall phone)
    const fr = freeRect(w, h, portrait);
    needW *= w / fr.w;
    needH *= h / fr.h;
    const fov = (camera.fov * Math.PI) / 180, tv = Math.tan(fov / 2);
    const d = Math.max(needW / 2 / (tv * camera.aspect), (needH * Math.sin(el)) / 2 / tv);
    const ox = Math.round(w / 2 - (fr.x + fr.w / 2)), oy = Math.round(h / 2 - (fr.y + fr.h / 2));
    cam.ox = lerp(cam.ox || 0, ox, cam.init ? 1 - Math.exp(-4 * dt) : 1);
    cam.oy = lerp(cam.oy || 0, oy, cam.init ? 1 - Math.exp(-4 * dt) : 1);
    if (Math.abs(cam.ox - (cam.lastOx || 0)) > 0.3 || Math.abs(cam.oy - (cam.lastOy || 0)) > 0.3) {
      cam.lastOx = cam.ox;
      cam.lastOy = cam.oy;
      camera.setViewOffset(w, h, cam.ox, cam.oy, w, h);
      camera.updateProjectionMatrix();
    }
    if (!cam.init) { cam.x = tx; cam.z = tz; cam.d = d; cam.el = el; cam.init = true; }
    const k = 1 - Math.exp(-3 * dt);
    cam.x = lerp(cam.x, tx, k);
    cam.z = lerp(cam.z, tz, k);
    cam.d = lerp(cam.d, d, 1 - Math.exp(-2 * dt));
    cam.el = lerp(cam.el, el, 1 - Math.exp(-2.5 * dt));
    let sx = 0;
    if (st.shake > 0) { st.shake = Math.max(0, st.shake - dt); sx = (Math.random() - 0.5) * st.shake * 0.8; }
    const look = new T.Vector3(cam.x, st.cel ? 1 : 0, cam.z);
    camera.position.set(cam.x + sx, look.y + Math.sin(cam.el) * cam.d, cam.z + Math.cos(cam.el) * cam.d);
    camera.lookAt(look);
    cam.camX = camera.position.x;
    cam.camZ = camera.position.z;
    if (st.peek) { camera.position.set(st.peek.x, st.peek.y, st.peek.z); camera.lookAt(st.peek.lx, st.peek.ly, st.peek.lz); }
    sun.position.set(cam.x - 8, 20, cam.z + 6);
    sun.target.position.set(cam.x, 0, cam.z);
  }

  // ---------------------------------------------------------------- the win: signature moves and confetti

  function startCelebrate() {
    const S = st.S;
    setMode('celebrate');
    st.cel = { t: 0 };
    for (const P of S.players) {
      const v = st.views.get(P.id);
      v.cel = { mode: 'wave', hop: 0, seg: 0, segT: 0, ball: false };
    }
    banner('ALL TREASURE FOUND!<small>YO HO HO!</small>', 3);
    SFX.treasure();
    Kit.sound.powerup();
    const sum = S.total();
    const key = `${st.level}-${S.players.length}`;
    const b = best[key] || {};
    st.result = { coins: sum, time: S.t, newBest: !b.coins || sum > b.coins, fast: !b.time || S.t < b.time, prev: b };
    best[key] = { coins: Math.max(sum, b.coins || 0), time: Math.min(S.t, b.time || Infinity) };
    store.set('piratesTT.best', best);
  }

  function updateCelebrate(dt) {
    const c = st.cel;
    c.t += dt;
    const S = st.S;
    if (Math.floor(c.t * 3) !== Math.floor((c.t - dt) * 3) && c.t < 4.5) {
      for (const P of S.players) fx.confetti(P3(P, -1.5), 16);
    }
    for (const P of S.players) {
      const v = st.views.get(P.id);
      const cel = v.cel;
      if (!cel) continue;
      cel.segT += dt;
      cel.hop = 0;
      if (c.t < 0.8) { cel.mode = 'wave'; continue; }
      if (P.kind === 'teddy') {
        const segs = [['boxing', 2.0], ['jumpshot', 1.1]];
        if (cel.segT > segs[cel.seg][1]) { cel.seg = (cel.seg + 1) % 2; cel.segT = 0; cel.ball = false; }
        cel.mode = segs[cel.seg][0];
        if (cel.mode === 'jumpshot') {
          const j = cel.segT / 1.1;
          cel.hop = Math.sin(clamp(j / 0.7, 0, 1) * Math.PI) * 0.18;
          if (!cel.ball && j > 0.35) {
            cel.ball = true;
            v.root.updateMatrixWorld(true);
            const hp = Kit.people.handWorld(v.person, 1);
            fx.emoji('🏀', hp, { size: 0.35, vx: 0.4, vy: 5, vz: -1.5, g: 8, life: 1.2, rot: -8 });
            if (!st.demo) Kit.sound.swish();
          }
        }
      } else {
        cel.mode = 'peace';
        cel.hop = Math.abs(Math.sin(cel.segT * 5)) * 0.08;
      }
    }
    if (c.t > 5.2 && st.mode === 'celebrate') showResults();
  }

  function fmtTime(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')}`; }

  function showResults() {
    const S = st.S, r = st.result;
    setMode('results');
    show('results');
    $('resTitle').textContent = S.players.length > 1 ? 'TEAM TREASURE!' : 'ALL THE TREASURE!';
    const lines = S.players.map((P) => `<div class="line"><img alt="" class="${P.kind === 'tommy' ? 'tm' : ''}" src="${faces[P.kind]}"><span>${NAMES[P.kind]}</span><span>🪙 ${P.coins}</span></div>`);
    if (S.players.length > 1) lines.push(`<div class="line"><span>TOGETHER</span><span>🪙 ${r.coins}</span></div>`);
    lines.push(`<div class="line"><span>⏱️ ${fmtTime(r.time)}</span></div>`);
    const bestLine = r.newBest && r.prev.coins ? `NEW BEST! 🪙 ${r.coins}` : `BEST: 🪙 ${best[`${st.level}-${S.players.length}`].coins} · ⏱️ ${fmtTime(best[`${st.level}-${S.players.length}`].time)}`;
    lines.push(`<div class="line best">${bestLine}</div>`);
    $('resStats').innerHTML = lines.join('');
    Kit.sound.music('title');
  }

  // ---------------------------------------------------------------- input

  const keys = new Set();
  const keyFire = [false, false], pressFire = [false, false];
  const stick = [null, null], touchFire = [false, false];
  const P1 = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
  const P2 = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  function keyVec(map) {
    let x = 0, y = 0;
    for (const [c, v] of Object.entries(map)) if (keys.has(c)) { x += v[0]; y += v[1]; }
    return [x, y];
  }
  function readInput() {
    const S = st.S;
    if (!S || st.demo) return;
    const one = S.players.length === 1;
    const k1 = keyVec(P1), k2 = keyVec(P2);
    for (let i = 0; i < S.players.length; i++) {
      const inp = S.input[i];
      let v = i === 0 ? (one ? [k1[0] + k2[0], k1[1] + k2[1]] : k1) : k2;
      if (stick[i]) v = stick[i];
      if (st.hold[i]) v = [st.hold[i].dx || 0, st.hold[i].dy || 0];
      const m = Math.hypot(v[0], v[1]);
      inp.dx = m > 1 ? v[0] / m : v[0];
      inp.dy = m > 1 ? v[1] / m : v[1];
      inp.fire = keyFire[i] || touchFire[i] || (one && keyFire[1]) || !!(st.hold[i] && st.hold[i].fire);
      if (pressFire[i] || (one && pressFire[1])) inp.press = true;
    }
    pressFire[0] = pressFire[1] = false;
  }
  function clearInput() {
    keys.clear();
    keyFire[0] = keyFire[1] = pressFire[0] = pressFire[1] = touchFire[0] = touchFire[1] = false;
    stick[0] = stick[1] = null;
  }

  const firstGesture = () => { Kit.sound.init(); if (st.mode === 'title') Kit.sound.music('title'); };
  const FIRE1 = ['KeyF', 'Space'], FIRE2 = ['KeyL', 'Slash', 'Numpad0'];

  window.addEventListener('keydown', (e) => {
    firstGesture();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    if (st.mode === 'play') {
      if (c in P1 || c in P2) { e.preventDefault(); keys.add(c); return; }
      if (FIRE1.includes(c)) { e.preventDefault(); if (!e.repeat) pressFire[0] = true; keyFire[0] = true; return; }
      if (FIRE2.includes(c)) { e.preventDefault(); if (!e.repeat) pressFire[1] = true; keyFire[1] = true; return; }
      if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { e.preventDefault(); callBuddy(c === 'KeyT' ? 0 : 1); return; }
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') { e.preventDefault(); resume(); }
      else if (c === 'KeyR') startGame(st.players);
      else if (c === 'KeyQ') toMenu();
      return;
    }
    if (st.mode === 'title') {
      if (c === 'Digit1' || c === 'Numpad1') startGame(['teddy']);
      else if (c === 'Digit2' || c === 'Numpad2') startGame(['tommy']);
      else if (c === 'Digit3' || c === 'Numpad3') startGame(['teddy', 'tommy']);
      else if (c === 'KeyE') setLevel(st.pickLevel === 'easy' ? 'normal' : 'easy');
      else if (c === 'Enter' || c === 'Space') { e.preventDefault(); startGame(settings.players || ['teddy']); }
      return;
    }
    if (st.mode === 'results') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); startGame(st.players); }
      else if (c === 'Escape') toMenu();
    }
  });
  window.addEventListener('keyup', (e) => {
    const c = e.code;
    keys.delete(c);
    if (FIRE1.includes(c)) keyFire[0] = false;
    if (FIRE2.includes(c)) keyFire[1] = false;
  });
  window.addEventListener('blur', clearInput);

  // touch: the ship's wheel (a stick: push toward where you want to sail) and the SPLASH button
  function bindStick(el, i) {
    let id = null;
    const knob = el.querySelector('.knob');
    const set = (e) => {
      const r = el.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const max = r.width * 0.32, d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      stick[i] = d < r.width * 0.08 ? [0, 0] : [dx / max, dy / max];
    };
    el.addEventListener('pointerdown', (e) => { firstGesture(); id = e.pointerId; el.setPointerCapture(id); set(e); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const up = (e) => { if (e.pointerId !== id) return; id = null; stick[i] = null; knob.style.transform = ''; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function bindFire(el, i) {
    el.addEventListener('pointerdown', (e) => { firstGesture(); el.setPointerCapture(e.pointerId); touchFire[i] = true; pressFire[i] = true; el.classList.add('down'); e.preventDefault(); });
    const up = () => { touchFire[i] = false; el.classList.remove('down'); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  bindStick($('stick0'), 0);
  bindStick($('stick1'), 1);
  bindFire($('fire0'), 0);
  bindFire($('fire1'), 1);
  $('budBtn').addEventListener('pointerdown', (e) => {
    firstGesture();
    e.preventDefault();
    const el = $('budBtn');
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 120);
    callBuddy(0);
  });

  function callBuddy(i) {
    if (st.mode !== 'play' || !st.S || st.demo) return;
    st.S.callBuddy(i);
  }

  function toggleMute() {
    Kit.sound.init();
    const m = Kit.sound.toggleMute();
    document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; });
  }
  document.querySelectorAll('.muteBtn').forEach((b) => {
    b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    b.addEventListener('click', toggleMute);
  });
  Kit.sound.onMute((m) => document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; }));
  $('pauseBtn').addEventListener('click', () => (st.mode === 'pause' ? resume() : pause()));

  // ---------------------------------------------------------------- screens and flow

  const SCREENS = ['title', 'pause', 'results'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }

  function setMode(m) {
    st.mode = m;
    st.modeT = 0;
    const hud = ['play', 'pause', 'celebrate'].includes(m);
    $('hud').classList.toggle('hidden', !hud);
    $('budBtn').classList.toggle('hidden', m === 'celebrate');
    $('compass').classList.toggle('hidden', m === 'celebrate' || st.players.length > 1);
    layout();
  }

  function startGame(players) {
    st.hold = [null, null];
    settings.players = players;
    settings.level = st.pickLevel;
    saveSettings();
    Kit.sound.init();
    newVoyage(players, st.pickLevel, false);
    show(null);
    setMode('play');
    clearInput();
    SFX.sail();
    Kit.sound.music('play');
    banner(`SET SAIL!<small>${st.pickLevel === 'easy' ? 'FOLLOW THE ARROW TO THE X' : 'READ THE TREASURE MAP'}</small>`, 2.2);
  }

  function pause() {
    if (st.mode !== 'play') return;
    setMode('pause');
    show('pause');
    clearInput();
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    show(null);
    setMode('play');
    Kit.sound.music('play');
  }
  function toMenu() {
    startDemo();
    setMode('title');
    show('title');
    refreshTitle();
    Kit.sound.music('title');
  }
  function startDemo() {
    newVoyage([Math.random() < 0.5 ? 'teddy' : 'tommy'], 'easy', true);
  }

  function setLevel(l) {
    st.pickLevel = l;
    settings.level = l;
    saveSettings();
    refreshTitle();
  }
  function refreshTitle() {
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === st.pickLevel)));
    const parts = [];
    for (const [k, label] of [['easy-1', '🐣'], ['normal-1', '🔥'], ['easy-2', '🐣 👫'], ['normal-2', '🔥 👫']]) {
      const b = best[k];
      if (b && b.coins) parts.push(`${label} 🪙 ${b.coins} · ⏱️ ${fmtTime(b.time)}`);
    }
    $('bests').textContent = parts.length ? `BEST: ${parts.join('   ')}` : '';
  }
  function setupTitle() {
    $('logoMain').textContent = TT.TITLE.toUpperCase();
    document.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      firstGesture();
      const p = b.dataset.play;
      startGame(p === 'both' ? ['teddy', 'tommy'] : [p]);
    }));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => { firstGesture(); setLevel(b.dataset.level); }));
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', () => startGame(st.players));
    $('quitBtn').addEventListener('click', toMenu);
    $('againBtn').addEventListener('click', () => startGame(st.players));
    $('resMenuBtn').addEventListener('click', toMenu);
  }

  // ---------------------------------------------------------------- layout

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    cam.lastOx = cam.lastOy = 0;
    const portrait = h > w * 1.08;
    const compact = Math.min(w, h) < 520;
    const short = h < 440;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('compact', compact);
    document.body.classList.toggle('short', short);
    const two = st.players.length === 2 && !st.demo;
    document.body.classList.toggle('two', two);
    const playing = ['play', 'pause'].includes(st.mode);
    const place = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };
    const sticks = [$('stick0'), $('stick1')], fires = [$('fire0'), $('fire1')], bud = $('budBtn');
    sticks.forEach((s) => s.classList.remove('show'));
    fires.forEach((f) => f.classList.remove('show'));
    const sw = short ? 124 : 150, fs = short ? 86 : 104, bs = short ? 80 : 96, m = 14;
    // the kit's round buttons sit in the middle of the left edge: keep the stick clear of them
    const kitTop = h / 2 - 26, kitBot = h / 2 + 120;
    const stickTop = h - m - sw;
    const sx = stickTop < kitBot && stickTop + sw > kitTop ? 64 : 16;
    if (touch && playing) {
      sticks[0].classList.add('show');
      place(sticks[0], sx, stickTop);
      fires[0].classList.add('show');
      if (two) {
        sticks[1].classList.add('show');
        place(sticks[1], w - sw - 16, stickTop);
        fires[1].classList.add('show');
        if (portrait) {
          place(fires[0], sx + 8, stickTop - fs - 14);
          place(fires[1], w - fs - 24, stickTop - fs - 14);
        } else {
          place(fires[0], sx + sw + 12, h - m - fs);
          place(fires[1], w - sw - 16 - fs - 12, h - m - fs);
        }
        place(bud, (w - bs) / 2, portrait ? stickTop - bs - 30 : h - m - bs - (short ? 8 : 70));
      } else {
        place(fires[0], w - fs - 20, h - m - fs - 4);
        // on a short screen the brother sits beside the SPLASH button, so the treasure map keeps the right edge
        if (short && !portrait) place(bud, w - fs - 20 - bs - 18, h - m - bs - 8);
        else place(bud, w - bs - 24, h - m - fs - bs - 30);
      }
    } else {
      place(bud, w - bs - 20, h - bs - 24);
    }
    // the compass (1 player) sits bottom middle, between the stick and the buttons
    $('compass').classList.toggle('hidden', two || st.mode === 'celebrate' || !['play', 'pause'].includes(st.mode));
    // on a tall phone it goes top left, under Teddy's or Tommy's card
    $('compass').style.top = portrait ? `${$('cards').getBoundingClientRect().bottom + 8}px` : '';
  }

  // ---------------------------------------------------------------- the loop

  function tick(dt) {
    st.time += dt;
    st.modeT += dt;
    const S = st.S;
    const runs = S && (st.mode === 'play' || st.mode === 'celebrate' || st.mode === 'results' || (st.mode === 'title' && st.demo));
    if (runs) {
      st.acc = (st.acc || 0) + dt;
      let n = 0;
      while (st.acc >= DT - 1e-9 && n++ < 8) {
        readInput();
        S.step(DT);
        st.acc -= DT;
        for (const e of S.events) onEvent(e);
        S.events.length = 0;
      }
      if (st.acc > DT) st.acc = 0;
    }
    if (st.demo && S && (st.restartDemoAt && st.time > st.restartDemoAt || S.t > 240)) { st.restartDemoAt = 0; startDemo(); }
    if (st.cel && (st.mode === 'celebrate' || st.mode === 'results')) updateCelebrate(dt);
    for (let i = st.anims.length - 1; i >= 0; i--) {
      const a = st.anims[i];
      if (a.tick(a, dt)) { if (a.cleanup) a.cleanup(); st.anims.splice(i, 1); }
    }
    syncViews(dt);
    fx.update(dt);
    if (st.sea3d) st.sea3d.tick(st.time, dt);
    updateCamera(dt);
    if (S && !st.demo) {
      updateHud();
      st.mapT = (st.mapT || 0) - dt;
      if (st.mapT <= 0 || st.mapDirty) { st.mapT = 1 / 12; st.mapDirty = false; drawMap(S); }
    }
    updateToasts();
    updateBanner();
  }

  function render() { renderer.render(scene, camera); }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!st.keepAwake) { pause(); Kit.sound.suspend(); }
    } else Kit.sound.resume();
  });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  // ---------------------------------------------------------------- start

  document.title = `${TT.TITLE} · Teddy & Tommy`;
  st.pickLevel = settings.level === 'normal' ? 'normal' : 'easy';
  setupTitle();
  $('loading').remove();
  startDemo();
  setMode('title');
  show('title');
  refreshTitle();
  layout();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` and draw (the Browser pane throttles animation while hidden)
    step(seconds = 1 / 60) {
      let n = Math.max(1, Math.round(seconds / DT));
      while (n-- > 0) tick(DT);
      render();
      return game.state();
    },
    // start a voyage: { players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], level: 'easy' | 'normal' }
    start(o = {}) {
      if (o.level) st.pickLevel = o.level;
      startGame(o.players || ['teddy']);
      return game.state();
    },
    state() {
      const S = st.S;
      return {
        mode: st.mode, demo: st.demo, level: st.level, lang: Kit.lang.get(),
        found: S ? S.ti : null, treasures: S ? S.targets.length : null, clue: S ? $('clue').textContent : null,
        target: S && S.target() ? S.target().name : null, hint: S ? S.hint() : null,
        players: S ? S.players.map((P) => ({ kind: P.kind, x: +P.x.toFixed(1), y: +P.y.toFixed(1), h: +P.h.toFixed(2), coins: P.coins, soak: +P.soak.toFixed(1) })) : null,
        rivals: S ? S.rivals.map((r) => ({ kind: r.kind, ai: r.ai, soak: r.soak, x: +r.x.toFixed(1), y: +r.y.toFixed(1) })) : null,
        buddy: S && S.buddy ? { kind: S.buddy.kind, phase: S.buddy.phase, calls: S.buddy.calls } : null,
      };
    },
    sim: () => st.S,
    buddy(i = 0) { callBuddy(i); return game.state().buddy; },
    // hold a player's stick (and fire): game.input(0, { dx: 1, dy: 0, fire: true }); game.input(0, null) lets go
    input(i, o) { st.hold[i] = o; },
    autopilot(on = true, mode = 'treasure') { if (st.S) { st.S.auto = st.S.players.map(() => on); st.S.autoMode = st.S.players.map(() => mode); } },
    // sail straight to the last treasure and land: a quick way to the win
    win() { const S = st.S; if (!S) return; S.give('last'); S.give('win'); },
    // put a friend's ship right in front of you
    friendNear(k = 0) { const S = st.S, P = S.players[0], r = S.rivals[k]; r.x = P.x + Math.cos(P.h) * 4; r.y = P.y + Math.sin(P.h) * 4; r.ai = 'roam'; r.calm = 5; },
    check: (o) => TT.check.check(Object.assign({ seas: 60, sail: 4, fights: 3, voyages: 2 }, o || {})),
    keepAwake(on = true) { st.keepAwake = on; },
    freeze(on = true) { st.frozen = on; },
    // a close-up camera: game.peek(x, y, z, lookX, lookY, lookZ); game.peek() to go back
    peek(x, y, z, lx = 0, ly = 0, lz = 0) { st.peek = x === undefined ? null : { x, y, z, lx, ly, lz }; tick(0); render(); },
    pause, resume, menu: toMenu, layout, st,
    setLevel,
  };
})();
