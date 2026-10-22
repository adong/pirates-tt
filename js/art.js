/* TT Pirates: everything you see, built from boxes, cylinders and canvas paintings (no image or model files).
   The sea (with its map squares, rope of floats and N E S W buoys), the islands, rocks, the toy pirate ships with their
   captains and water cannons, coins, treasure chests, and the effects: droplets, rings, word bursts, confetti.
   World units match js/sim.js: sim x -> world x, sim y -> world z, and the sea is centred on the origin. */
(function () {
  'use strict';
  const T = THREE;
  const TT = (window.TT = window.TT || {});
  const G = Kit.gfx;
  const M = TT.sim;
  const SQ = M.SQ;
  const lerp = (a, b, k) => a + (b - a) * k;

  // ship colours: hull, trim, sail stripe, flag emoji on the sail
  const SHIPS = {
    teddy: { hull: '#3f86e8', trim: '#ffd400', stripe: '#3f86e8', mark: '🏀', band: '#3f86e8' },
    tommy: { hull: '#ff8a1f', trim: '#7fdcbd', stripe: '#ff8a1f', mark: '✌️', band: '#ff8a1f' },
    foxy: { hull: '#e0503a', trim: '#fff4e6', stripe: '#e0503a', mark: '🦊', band: '#e0503a' },
    froggy: { hull: '#3fae5a', trim: '#ffd400', stripe: '#3fae5a', mark: '🐸', band: '#3fae5a' },
  };

  const geo = {
    coin: new T.CylinderGeometry(0.3, 0.3, 0.08, 20).rotateX(Math.PI / 2),
    shot: new T.SphereGeometry(0.22, 14, 10),
    drop: new T.SphereGeometry(0.1, 8, 6),
    ring: new T.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2),
    plane: new T.PlaneGeometry(1, 1),
  };
  const mat = {
    coin: G.std('#ffd23a', { metalness: 0.25, roughness: 0.35, emissive: '#b07800', emissiveIntensity: 0.55 }),
    shot: new T.MeshStandardMaterial({ color: '#8fe3ff', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.88, emissive: '#2a8ad0', emissiveIntensity: 0.35 }),
    wood: G.std('#a8713f'),
    dark: G.std('#2a1d18'),
    black: G.std('#1d1b22', { roughness: 0.6 }),
    white: G.std('#ffffff'),
    gold: G.std('#ffcf3a', { metalness: 0.5, roughness: 0.35, emissive: '#6a4a00', emissiveIntensity: 0.3 }),
    red: G.std('#e5322d'),
  };

  // ------------------------------------------------------------------ painted textures

  function badgeTexture(emoji, ring) {
    const [c, g] = G.makeCanvas(160, 160);
    g.fillStyle = '#14121f';
    g.beginPath(); g.arc(80, 80, 76, 0, Math.PI * 2); g.fill();
    g.fillStyle = ring;
    g.beginPath(); g.arc(80, 80, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.arc(80, 80, 58, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `78px ${G.EMOJI_FONT}`;
    g.fillText(emoji, 80, 86);
    return G.toTexture(c);
  }

  function sailTexture(k) {
    const s = SHIPS[k];
    const [c, g] = G.makeCanvas(256, 224);
    g.fillStyle = '#fff8ea';
    g.fillRect(0, 0, 256, 224);
    g.fillStyle = s.stripe;
    for (const y of [0, 72, 152]) g.fillRect(0, y + 10, 256, 18);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 2, 224);
    g.fillStyle = '#fff8ea';
    g.beginPath(); g.arc(128, 116, 62, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = s.stripe; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `82px ${G.EMOJI_FONT}`;
    g.fillText(s.mark, 128, 122);
    return G.toTexture(c);
  }

  // the pirate flag: a friendly smiling skull and crossed bones (drawn here, no emoji needed)
  let flagTex = null;
  function flagTexture() {
    if (flagTex) return flagTex;
    const [c, g] = G.makeCanvas(128, 88);
    g.fillStyle = '#1d1b22'; g.fillRect(0, 0, 128, 88);
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 66); g.lineTo(88, 22); g.moveTo(40, 22); g.lineTo(88, 66); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(64, 38, 19, 0, Math.PI * 2); g.fill();
    g.fillRect(54, 46, 20, 14);
    g.fillStyle = '#1d1b22';
    g.beginPath(); g.arc(57, 37, 5, 0, Math.PI * 2); g.arc(71, 37, 5, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#1d1b22';
    g.beginPath(); g.arc(64, 45, 6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    return (flagTex = G.toTexture(c));
  }

  // The sea's own map squares: soft turquoise with wave squiggles and dashed lines between the squares, so kids can
  // count "2 squares NORTH" right on the water.
  function seaTexture(n) {
    const px = 96, [c, g] = G.makeCanvas(n * px, n * px);
    const gr = g.createLinearGradient(0, 0, 0, n * px);
    gr.addColorStop(0, '#2fb4de'); gr.addColorStop(1, '#27a3d4');
    g.fillStyle = gr; g.fillRect(0, 0, n * px, n * px);
    const R = M.rng(n * 17);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < n * n * 2.2; i++) {
      const x = R() * n * px, y = R() * n * px;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 9, y - 7, x + 18, y); g.quadraticCurveTo(x + 27, y + 7, x + 36, y); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.setLineDash([10, 10]);
    for (let i = 1; i < n; i++) {
      g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, n * px); g.stroke();
      g.beginPath(); g.moveTo(0, i * px); g.lineTo(n * px, i * px); g.stroke();
    }
    return G.toTexture(c);
  }

  function letterTexture(text) {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#14121f'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd400'; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#14121f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${/[一-鿿]/.test(text) ? 64 : 70}px ${G.FONT}`;
    g.fillText(text, 64, 70);
    return G.toTexture(c);
  }

  // N E S W as they read in the current language (inline pairs: single letters must never go in the dictionary,
  // or the W A S D keycaps would turn into 西 too)
  const letter = (l) => Kit.lang.t(l, { N: '北', E: '东', S: '南', W: '西' }[l]);

  const spriteOf = (tex, size, o = {}) => {
    const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false }, o)));
    s.scale.set(size, size, 1);
    return s;
  };

  // ------------------------------------------------------------------ the sea

  function makeSea(scene, sea) {
    const group = new T.Group();
    scene.add(group);
    const half = sea.size / 2;
    const pos = (x, y, h = 0) => new T.Vector3(x - half, h, y - half);

    const ocean = new T.Mesh(new T.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), G.std('#1f78c4', { roughness: 0.55 }));
    ocean.position.y = -0.05;
    ocean.receiveShadow = true;
    group.add(ocean);
    const play = new T.Mesh(new T.PlaneGeometry(sea.size, sea.size).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: seaTexture(sea.n), roughness: 0.45 }));
    play.receiveShadow = true;
    group.add(play);
    // moving wave sparkles on top
    const [wc, wg] = G.makeCanvas(256, 256);
    wg.strokeStyle = 'rgba(255,255,255,0.55)'; wg.lineWidth = 4; wg.lineCap = 'round';
    const R = M.rng(5);
    for (let i = 0; i < 18; i++) {
      const x = R() * 256, y = R() * 256;
      wg.beginPath(); wg.moveTo(x, y); wg.quadraticCurveTo(x + 10, y - 8, x + 20, y); wg.stroke();
    }
    const waveTex = G.toTexture(wc, true);
    waveTex.repeat.set(sea.size / 7, sea.size / 7);
    const waves = new T.Mesh(new T.PlaneGeometry(sea.size + 40, sea.size + 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: waveTex, transparent: true, opacity: 0.5, depthWrite: false }));
    waveTex.repeat.set((sea.size + 40) / 7, (sea.size + 40) / 7);
    waves.position.y = 0.03;
    group.add(waves);

    // the rope of red and white floats round the edge
    const floats = [];
    const per = Math.round(sea.size / 1.1);
    for (let side = 0; side < 4; side++) for (let i = 0; i < per; i++) {
      const k = i / per * sea.size;
      const [x, y] = [[k, 0], [sea.size, k], [sea.size - k, sea.size], [0, sea.size - k]][side];
      floats.push(pos(x, y, 0.08));
    }
    const fGeo = new T.SphereGeometry(0.2, 10, 8);
    const inst = [new T.InstancedMesh(fGeo, G.std('#ff4b4b'), Math.ceil(floats.length / 2)), new T.InstancedMesh(fGeo, G.std('#ffffff'), Math.ceil(floats.length / 2))];
    const dummy = new T.Object3D();
    const counts = [0, 0];
    floats.forEach((p, i) => { const m = inst[i % 2]; dummy.position.copy(p); dummy.updateMatrix(); m.setMatrixAt(counts[i % 2]++, dummy.matrix); });
    inst.forEach((m, i) => { m.count = counts[i]; group.add(m); });

    // N E S W buoys, just outside the middle of each edge
    const buoys = [];
    [['N', half, -1.9], ['E', sea.size + 1.9, half], ['S', half, sea.size + 1.9], ['W', -1.9, half]].forEach(([l, x, y]) => {
      const b = new T.Group();
      b.position.copy(pos(x, y));
      const body = new T.Mesh(new T.CylinderGeometry(0.45, 0.6, 0.8, 16), G.std('#ffd400'));
      body.position.y = 0.2;
      b.add(body);
      const band = new T.Mesh(new T.CylinderGeometry(0.47, 0.5, 0.18, 16), G.std('#14121f'));
      band.position.y = 0.35;
      b.add(band);
      const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.2, 6), mat.dark);
      pole.position.y = 1.1;
      b.add(pole);
      const sp = spriteOf(letterTexture(letter(l)), 1.5);
      sp.position.y = 2.2;
      b.add(sp);
      b.userData = { letter: l, sp, ph: buoys.length };
      group.add(b);
      buoys.push(b);
    });
    function relabel() { for (const b of buoys) { b.userData.sp.material.map = letterTexture(letter(b.userData.letter)); b.userData.sp.material.needsUpdate = true; } }

    // islands
    const isl = new Map();
    for (const I of sea.islands) {
      const g = new T.Group();
      g.position.copy(pos(I.x, I.y));
      group.add(g);
      const sand = G.mesh(new T.CylinderGeometry(1.35, 1.62, 0.55, 28), G.std(I.sand), 0, 0, 0, g);
      sand.receiveShadow = true;
      const foam = new T.Mesh(new T.RingGeometry(1.55, 1.95, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
      foam.position.y = 0.04;
      g.add(foam);
      const grass = G.mesh(new T.CylinderGeometry(0.92, 1.1, 0.24, 20), G.std(I.top), -0.1, 0.36, 0.12, g);
      grass.receiveShadow = true;
      // a palm tree
      const palm = new T.Group();
      palm.position.set(-0.55, 0.45, 0.35);
      g.add(palm);
      let py = 0, px = 0;
      for (let k = 0; k < 5; k++) {
        const seg = G.mesh(new T.CylinderGeometry(0.07, 0.09, 0.32, 7), G.std(k % 2 ? '#8a5a2b' : '#9c6a36'), px, py + 0.16, 0, palm);
        seg.rotation.z = -0.12;
        py += 0.3; px += 0.04;
      }
      const leafMat = G.std('#2fb24a');
      for (let k = 0; k < 6; k++) {
        const leaf = G.mesh(new T.BoxGeometry(0.7, 0.04, 0.2).translate(0.35, 0, 0), leafMat, px, py + 0.05, 0, palm);
        leaf.rotation.set(0, (k / 6) * Math.PI * 2, -0.35);
      }
      G.mesh(new T.SphereGeometry(0.08, 8, 6), G.std('#6a4a20'), px + 0.08, py - 0.05, 0.05, palm);
      // the island's own thing
      if (I.id === 'volcano') {
        G.mesh(new T.ConeGeometry(0.55, 0.9, 14), G.std('#7a5a48'), 0.1, 0.9, -0.62, g);
        G.mesh(new T.CylinderGeometry(0.14, 0.2, 0.1, 12), G.std('#ff7a1a', { emissive: '#ff4a00', emissiveIntensity: 0.6 }), 0.1, 1.34, -0.62, g);
      } else if (I.id === 'castle') {
        G.mesh(new T.BoxGeometry(0.56, 0.56, 0.5), G.std('#c9ccd6'), 0.1, 0.72, -0.65, g);
        for (const [cx, cz] of [[-0.12, -0.85], [0.32, -0.85], [-0.12, -0.45], [0.32, -0.45]]) G.mesh(new T.BoxGeometry(0.13, 0.16, 0.13), G.std('#c9ccd6'), cx, 1.08, cz, g);
      } else if (I.id === 'shell' || I.id === 'turtle' || I.id === 'star' || I.id === 'crab') {
        const col = { shell: '#ff8fb8', turtle: '#2f8a46', star: '#ffd400', crab: '#e8452c' }[I.id];
        const dome = G.mesh(new T.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), G.std(col), 0.15, 0.46, -0.6, g);
        dome.scale.set(1, 0.7, 1);
      } else if (I.id === 'banana') {
        for (let k = 0; k < 3; k++) {
          const b = G.mesh(new T.TorusGeometry(0.2, 0.05, 6, 12, Math.PI * 0.8), G.std('#ffdc3a'), 0.05 + k * 0.08, 0.52, -0.6, g);
          b.rotation.set(Math.PI / 2, 0, k * 0.4);
        }
      }
      // its sign: a pole and the round badge you see on the treasure map
      G.mesh(new T.CylinderGeometry(0.04, 0.04, 1.6, 6), mat.dark, 0.85, 1.1, 0.55, g);
      const badge = spriteOf(badgeTexture(I.emoji, I.top), 1.15);
      badge.position.set(0.85, 2.25, 0.55);
      badge.renderOrder = 3;
      g.add(badge);
      // the X that marks the spot
      const x = new T.Group();
      for (const s of [-1, 1]) { const b = G.mesh(new T.BoxGeometry(0.8, 0.05, 0.16), mat.red, 0, 0, 0, x, false); b.rotation.y = s * Math.PI / 4; }
      x.position.set(0.25, 0.5, 0.05);
      x.visible = false;
      g.add(x);
      // the treasure chest, hidden until it's dug up
      const chest = new T.Group();
      chest.position.set(0.25, 0.48, 0.05);
      chest.visible = false;
      g.add(chest);
      G.mesh(new T.BoxGeometry(0.62, 0.36, 0.42), G.std('#8a4f24'), 0, 0.18, 0, chest);
      for (const bx of [-0.2, 0.2]) G.mesh(new T.BoxGeometry(0.06, 0.38, 0.44), mat.gold, bx, 0.18, 0, chest);
      const lid = new T.Group();
      lid.position.set(0, 0.36, 0.21);
      chest.add(lid);
      G.mesh(new T.BoxGeometry(0.62, 0.14, 0.42).translate(0, 0.07, -0.21), G.std('#a0602e'), 0, 0, 0, lid);
      for (let k = 0; k < 7; k++) G.mesh(new T.SphereGeometry(0.07, 8, 6), mat.gold, -0.22 + (k % 4) * 0.14, 0.38, -0.08 + Math.floor(k / 4) * 0.14, chest);
      // EASY's beacon: a soft golden beam over the treasure island
      const beam = new T.Mesh(new T.CylinderGeometry(0.75, 1.2, 9, 20, 1, true), new T.MeshBasicMaterial({ map: beamTexture(), transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, opacity: 0.6 }));
      beam.position.y = 4.5;
      beam.visible = false;
      g.add(beam);
      isl.set(I.id, { I, g, foam, x, chest, lid, beam, badge, open: 0 });
    }

    // rocks
    const rockMat = G.std('#8d93a3', { flatShading: true, roughness: 0.9 });
    for (const r of sea.rocks) {
      const g = new T.Group();
      g.position.copy(pos(r.x, r.y));
      group.add(g);
      const RR = M.rng(r.cx * 31 + r.cy * 7 + 3);
      for (let k = 0; k < 3; k++) {
        const s = 0.45 + RR() * 0.35;
        const m = G.mesh(new T.DodecahedronGeometry(s, 0), rockMat, (RR() - 0.5) * 0.9, s * 0.35, (RR() - 0.5) * 0.9, g);
        m.rotation.set(RR() * 3, RR() * 3, RR() * 3);
      }
      const foam = new T.Mesh(new T.RingGeometry(1.0, 1.3, 30).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
      foam.position.y = 0.04;
      g.add(foam);
    }

    function tick(t, dt) {
      waveTex.offset.set((t * 0.012) % 1, (t * 0.02) % 1);
      for (const v of isl.values()) {
        v.foam.scale.setScalar(1 + Math.sin(t * 2 + v.I.cx) * 0.04);
        if (v.beam.visible) { v.beam.material.opacity = 0.45 + Math.sin(t * 3) * 0.15; v.beam.rotation.y = t * 0.5; }
        if (v.chest.visible) {
          v.open = Math.min(1, v.open + dt * 1.8);
          v.lid.rotation.x = -1.9 * v.open;
          v.chest.position.y = 0.48 + (v.rise != null ? Math.max(0, 1 - v.rise) * -0.5 : 0);
          if (v.rise != null) v.rise = Math.min(1, v.rise + dt * 1.5);
        }
      }
      for (const b of buoys) b.position.y = Math.sin(t * 1.6 + b.userData.ph) * 0.06;
    }
    // what shows on the islands: the X (hint), the beam (EASY), the chests already found
    function show(S) {
      const tgt = S.target();
      const hint = S.hint();
      for (const v of isl.values()) {
        const isT = tgt && v.I === tgt;
        v.x.visible = !!isT && hint >= 2;
        v.beam.visible = !!isT && S.L.clue === 'arrow';
        if (v.I.found && !v.chest.visible) { v.chest.visible = true; v.open = 0; v.rise = 0; }
        if (!v.I.found && v.chest.visible) v.chest.visible = false;
      }
    }
    function dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o.geometry && !Object.values(geo).includes(o.geometry)) o.geometry.dispose(); });
    }
    return { group, pos, isl, tick, show, relabel, dispose, half };
  }

  let beamTex = null;
  function beamTexture() {
    if (beamTex) return beamTex;
    const [c, g] = G.makeCanvas(8, 128);
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,220,80,0)');
    gr.addColorStop(0.6, 'rgba(255,220,80,0.5)');
    gr.addColorStop(1, 'rgba(255,240,150,0.9)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 8, 128);
    return (beamTex = G.toTexture(c));
  }

  // ------------------------------------------------------------------ ships

  function hullShape(w, len, bow) {
    const s = new T.Shape();
    s.moveTo(-w * 0.8, -len / 2);
    s.quadraticCurveTo(-w, -len / 2, -w, -len / 2 + 0.25);
    s.quadraticCurveTo(-w * 1.05, len * 0.15, 0, len / 2 + bow);
    s.quadraticCurveTo(w * 1.05, len * 0.15, w, -len / 2 + 0.25);
    s.quadraticCurveTo(w, -len / 2, w * 0.8, -len / 2);
    s.lineTo(-w * 0.8, -len / 2);
    return s;
  }
  // a shape extruded upward; its +y becomes the ship's front (-z)
  function extrude(shape, depth, bevel) {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // A pirate hat (a bicorne) for a captain's head, with a little white skull dot and a band in his colour.
  function pirateHat(head, band) {
    const hat = new T.Group();
    hat.position.set(0, 0.27, 0.02);
    head.add(hat);
    const crown = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.74, 18, 1, false, 0, Math.PI), mat.black);
    crown.rotation.z = Math.PI / 2; // the half-cylinder lies across the head, round side up
    hat.add(crown);
    const b = new T.Mesh(new T.BoxGeometry(0.76, 0.06, 0.08), G.std(band));
    b.position.set(0, 0.04, -0.01);
    hat.add(b);
    const skull = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), mat.white);
    skull.position.set(0, 0.14, -0.06);
    hat.add(skull);
    return hat;
  }

  function makeShip(kind) {
    const S = SHIPS[kind];
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const len = 2.0, w = 0.62;
    const low = new T.Mesh(extrude(hullShape(w, len, 0.35), 0.28, 0.05), G.std('#fff8ea'));
    low.position.y = -0.18;
    low.castShadow = true;
    body.add(low);
    const up = new T.Mesh(extrude(hullShape(w * 1.04, len * 1.02, 0.38), 0.26, 0.04), G.std(S.hull, { roughness: 0.55 }));
    up.position.y = 0.1;
    up.castShadow = true;
    body.add(up);
    const deck = new T.Mesh(extrude(hullShape(w * 0.84, len * 0.88, 0.25), 0.04), mat.wood);
    deck.position.y = 0.38;
    deck.receiveShadow = true;
    body.add(deck);
    const rim = new T.Mesh(extrude(hullShape(w * 1.08, len * 1.05, 0.4), 0.05), G.std(S.trim));
    rim.position.y = 0.36;
    body.add(rim);
    // portholes
    for (const sx of [-1, 1]) for (const z of [-0.3, 0.25]) {
      const p = G.mesh(new T.CylinderGeometry(0.07, 0.07, 0.04, 10), mat.white, sx * (w * 1.04 + 0.02), 0.22, z, body, false);
      p.rotation.z = Math.PI / 2;
    }
    // mast, sail, flag
    G.mesh(new T.CylinderGeometry(0.05, 0.065, 2.1, 8), mat.wood, 0, 1.4, -0.05, body);
    G.mesh(new T.CylinderGeometry(0.03, 0.03, 1.45, 6), mat.wood, 0, 2.05, -0.05, body).rotation.z = Math.PI / 2;
    const sail = new T.Mesh(new T.PlaneGeometry(1.35, 1.12, 6, 3), new T.MeshStandardMaterial({ map: sailTexture(kind), side: T.DoubleSide, roughness: 0.8 }));
    sail.position.set(0, 1.45, -0.1);
    sail.castShadow = true;
    body.add(sail);
    // the sail bellies out a little
    const sp = sail.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, -0.18 * (1 - (x / 0.675) ** 2) * (1 - 0.3 * (y / 0.56) ** 2)); }
    sail.geometry.computeVertexNormals();
    const flag = new T.Mesh(new T.PlaneGeometry(0.5, 0.34, 4, 1), new T.MeshBasicMaterial({ map: flagTexture(), side: T.DoubleSide }));
    flag.geometry.translate(0.25, 0, 0);
    flag.position.set(0.03, 2.35, -0.05);
    body.add(flag);
    // the water cannon at the bow: an orange barrel on a blue water tank
    const cannon = new T.Group();
    cannon.position.set(0, 0.55, -0.85);
    body.add(cannon);
    G.mesh(new T.SphereGeometry(0.2, 12, 10), G.std('#2a9df4', { roughness: 0.3 }), 0, 0.02, 0.2, cannon);
    const barrel = G.mesh(new T.CylinderGeometry(0.08, 0.11, 0.62, 12), G.std('#ff7a1a', { roughness: 0.4 }), 0, 0.06, -0.15, cannon);
    barrel.rotation.x = Math.PI / 2 - 0.15;
    G.mesh(new T.TorusGeometry(0.09, 0.03, 6, 12), G.std('#ffd400'), 0, 0.1, -0.45, cannon);
    // the captain
    const who = Kit.roster.get(kind);
    const person = Kit.people.build(who.look);
    person.root.scale.setScalar(0.42);
    person.root.position.set(0, 0.42, 0.52);
    body.add(person.root);
    person.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    pirateHat(person.head, S.band);
    // the soak meter (drops) floats above the ship
    const [mc, mg] = G.makeCanvas(256, 64);
    const meterTex = G.toTexture(mc);
    const meter = new T.Sprite(new T.SpriteMaterial({ map: meterTex, transparent: true, depthWrite: false, depthTest: false }));
    meter.scale.set(1.9, 0.48, 1);
    meter.position.y = 3.05;
    meter.renderOrder = 9;
    root.add(meter);
    let meterKey = '';
    function setSoak(soak, hits, dry) {
      const key = `${Math.ceil(soak)}/${hits}/${dry}`;
      if (key === meterKey) return;
      meterKey = key;
      mg.clearRect(0, 0, 256, 64);
      if (dry) {
        mg.font = `44px ${G.EMOJI_FONT}`; mg.textAlign = 'center'; mg.textBaseline = 'middle';
        mg.fillText('😎☀️', 128, 34);
      } else {
        const wdt = Math.min(44, 230 / hits);
        const x0 = 128 - (wdt * hits) / 2;
        for (let i = 0; i < hits; i++) {
          const on = i < Math.ceil(soak - 1e-6);
          const cx = x0 + wdt * (i + 0.5);
          mg.fillStyle = '#14121f';
          drop(mg, cx, 34, wdt * 0.5);
          mg.fillStyle = on ? '#2a9df4' : 'rgba(255,255,255,0.85)';
          drop(mg, cx, 34, wdt * 0.5 - 4);
        }
      }
      meterTex.needsUpdate = true;
    }
    function drop(g, x, y, r) {
      g.beginPath();
      g.moveTo(x, y - r * 1.4);
      g.quadraticCurveTo(x + r, y - r * 0.2, x + r * 0.85, y + r * 0.35);
      g.arc(x, y + r * 0.35, r * 0.85, 0, Math.PI);
      g.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.4);
      g.fill();
    }
    setSoak(0, 3, false);
    return { kind, root, body, sail, flag, cannon, person, meter, setSoak, phase: Math.random() * 6, buddy: null, mode: 'stand', modeT: 0 };
  }

  // the brother who pops onto your deck (at his buddyScale)
  function addBuddy(ship, kind) {
    const who = Kit.roster.get(kind);
    const p = Kit.people.build(who.look);
    const s = 0.42 * (who.buddyScale || 0.8);
    p.root.scale.setScalar(s);
    p.root.position.set(0.32, 0.42, 0.72);
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    pirateHat(p.head, SHIPS[kind].band);
    ship.body.add(p.root);
    return { p, kind, s };
  }

  // ------------------------------------------------------------------ coins, shots

  function makeCoin() {
    const m = new T.Mesh(geo.coin, mat.coin);
    m.castShadow = true;
    return m;
  }
  function makeShot(big) {
    const m = new T.Mesh(geo.shot, mat.shot);
    if (big) m.scale.setScalar(1.6);
    return m;
  }

  // ------------------------------------------------------------------ effects

  function wordTexture(text, color) {
    const [c, g] = G.makeCanvas(512, 160);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${/[一-鿿]/.test(text) ? 84 : 76}px ${G.FONT}`;
    g.lineJoin = 'round';
    g.lineWidth = 18;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 256, 84);
    g.fillStyle = color;
    g.fillText(text, 256, 84);
    return G.toTexture(c);
  }

  function makeFx(scene) {
    const list = [];
    const dotTex = G.dotTexture();
    const dropMats = ['#ffffff', '#bff0ff', '#7fd8ff'].map((c) => new T.SpriteMaterial({ map: dotTex, color: c, transparent: true, depthWrite: false }));
    function add(obj, o) {
      scene.add(obj);
      list.push(Object.assign({ obj, t: 0, life: 1, vx: 0, vy: 0, vz: 0, g: 0, spin: 0, grow: 0, fade: 0.3, size: obj.scale.x }, o));
    }
    function droplets(p, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const s = new T.Sprite(dropMats[i % 3].clone());
        const sz = (o.size || 0.28) * (0.6 + Math.random() * 0.8);
        s.scale.set(sz, sz, 1);
        s.position.set(p.x, (p.y || 0) + 0.2, p.z);
        const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
        add(s, { life: 0.6 + Math.random() * 0.5, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up || 4) * (0.6 + Math.random() * 0.7), g: 12, fade: 0.25 });
      }
    }
    function ring(p, r0, r1, life, color = '#ffffff', op = 0.8) {
      const m = new T.Mesh(geo.ring, new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide }));
      m.position.set(p.x, 0.06, p.z);
      m.scale.setScalar(r0);
      add(m, { life, ring: [r0, r1], op, fade: life });
    }
    function splash(p, big) {
      droplets(p, big ? 18 : 9, { speed: big ? 3.5 : 2.2, up: big ? 6 : 4, size: big ? 0.34 : 0.26 });
      ring(p, 0.3, big ? 1.8 : 1.1, 0.55);
    }
    function word(text, p, color = '#8fe3ff', size = 2.2) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: wordTexture(Kit.lang.t(text), color), transparent: true, depthWrite: false, depthTest: false }));
      s.scale.set(size, size * 0.3125, 1);
      s.renderOrder = 10;
      s.position.set(p.x, (p.y || 0) + 2.6, p.z);
      add(s, { life: 1.1, vy: 1.2, pop: size, fade: 0.35 });
    }
    function emoji(e, p, o = {}) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), transparent: true, depthWrite: false, depthTest: o.depthTest !== false }));
      const size = o.size || 0.7;
      s.scale.set(size, size, 1);
      s.renderOrder = 8;
      s.position.set(p.x, p.y || 0.5, p.z);
      add(s, Object.assign({ life: 1, fade: 0.3 }, o));
      return s;
    }
    function sparkle(p, n = 10, color = '#fff3a0') {
      const m = new T.SpriteMaterial({ map: dotTex, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      for (let i = 0; i < n; i++) {
        const s = new T.Sprite(m.clone());
        s.scale.set(0.35, 0.35, 1);
        s.position.set(p.x + (Math.random() - 0.5) * 1.4, (p.y || 0.5) + Math.random() * 1.2, p.z + (Math.random() - 0.5) * 1.4);
        add(s, { life: 0.6 + Math.random() * 0.5, vy: 1 + Math.random() * 1.5, fade: 0.4 });
      }
    }
    const confMats = ['#ff3d7f', '#ffd400', '#18d4ff', '#7ed957', '#9b6bff', '#ff8a1f'].map((c) => new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
    function confetti(p, n = 40) {
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(geo.plane, confMats[i % confMats.length]);
        m.scale.set(0.16, 0.24, 1);
        m.position.set(p.x + (Math.random() - 0.5) * 3, (p.y || 0) + 4 + Math.random() * 2, p.z + (Math.random() - 0.5) * 3);
        m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
        add(m, { life: 2.6, vx: (Math.random() - 0.5) * 5, vz: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 4, g: 5, drag: 1.8, spin: 6 + Math.random() * 6, fade: 0.5 });
      }
    }
    // the BIG SPLASH: a wall of water racing outward, a tall column, spray everywhere
    function bigSplash(p, r) {
      ring(p, 0.5, r, 0.9, '#bff0ff', 0.9);
      ring(p, 0.5, r * 0.75, 1.1, '#ffffff', 0.7);
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        const q = { x: p.x + Math.cos(a) * 1.2, z: p.z + Math.sin(a) * 1.2 };
        const s = new T.Sprite(dropMats[k % 3].clone());
        s.scale.set(0.5, 0.5, 1);
        s.position.set(q.x, 0.4, q.z);
        add(s, { life: 0.95, vx: Math.cos(a) * r * 1.05, vz: Math.sin(a) * r * 1.05, vy: 5, g: 10, fade: 0.3 });
      }
      droplets({ x: p.x, z: p.z }, 30, { speed: 2, up: 11, size: 0.45 });
      const col = new T.Mesh(new T.CylinderGeometry(0.5, 1.0, 1, 16, 1, true), new T.MeshBasicMaterial({ color: '#bff0ff', transparent: true, opacity: 0.75, depthWrite: false }));
      col.position.set(p.x, 0, p.z);
      add(col, { life: 1.0, column: true, fade: 0.5 });
    }
    function update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        f.t += dt;
        const o = f.obj;
        if (f.t >= f.life) { scene.remove(o); if (o.material && o.material !== mat.shot) o.material.dispose(); if (f.column) o.geometry.dispose(); list.splice(i, 1); continue; }
        f.vy -= f.g * dt;
        if (f.drag) { const k = Math.exp(-f.drag * dt); f.vx *= k; f.vz *= k; f.vy = Math.max(f.vy, -1.6); }
        o.position.x += f.vx * dt;
        o.position.y += f.vy * dt;
        o.position.z += f.vz * dt;
        if (f.spin) { o.rotation.x += f.spin * dt; o.rotation.y += f.spin * 0.7 * dt; }
        if (f.rot) o.material.rotation += f.rot * dt;
        const k = f.t / f.life;
        if (f.ring) o.scale.setScalar(lerp(f.ring[0], f.ring[1], 1 - (1 - k) ** 2));
        if (f.column) { const h = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 5; o.scale.set(1 + k, Math.max(0.01, h), 1 + k); o.position.y = h / 2; }
        if (f.pop) { const s = f.pop * (k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15))); o.scale.set(s, s * 0.3125, 1); }
        const left = f.life - f.t;
        const op = left < f.fade ? left / f.fade : 1;
        if (o.material) o.material.opacity = (f.op || 1) * op * (f.ring ? 1 - k * 0.5 : 1);
      }
    }
    function clear() { for (const f of list) scene.remove(f.obj); list.length = 0; }
    return { droplets, ring, splash, word, emoji, sparkle, confetti, bigSplash, update, clear, live: () => list.length };
  }

  TT.art = { letter, SHIPS, makeSea, makeShip, addBuddy, makeCoin, makeShot, makeFx, spriteOf, badgeTexture };
})();
