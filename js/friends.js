/* TT Pirates: the CPU friends, 🦊 Foxy and 🐸 Froggy (from TT Sea Battle, which took them from TT Bowling). The kit has
   no animals but the bear, so this adds two roster entries built on the kit's bear head: Foxy with pointy dark-tipped
   ears, a white chin and a bushy tail; Froggy all green with big eyes on top and a wide smile. Kit.people.build is
   wrapped so anything with look.fox or look.frog gets them, the menu portraits too. Here they captain the two rival
   ships you splash. Move this into the kit if more games want them. */
(function () {
  'use strict';
  const T = THREE;
  const add = (entry) => { if (!Kit.roster.get(entry.id)) Kit.roster.list.push(entry); };
  add({
    id: 'foxy', name: 'FOXY', tag: '#ff8a1f', cpu: true, emoji: '🦊', signature: ['wave'], buddyScale: 0.85,
    look: { head: 'bear', fox: true, skin: '#f07a2a', muzzle: '#fff4e6', shirt: 'hoodie', top: '#3fbf8a', print: 'star', bottom: '#2b3a63', shorts: true, shoes: '#ffd400' },
  });
  add({
    id: 'froggy', name: 'FROGGY', tag: '#57d16a', cpu: true, emoji: '🐸', signature: ['jump'], buddyScale: 0.78,
    look: { head: 'bear', frog: true, skin: '#57c94a', muzzle: '#b8f0a0', shirt: 'tee', top: '#ffd400', print: 'bolt', bottom: '#3d6ad6', shorts: true, shoes: '#ff3d7f' },
  });

  const build = Kit.people.build;
  Kit.people.build = function (look) {
    const p = build(look);
    if (!look || (!look.fox && !look.frog)) return p;
    const std = Kit.gfx.std;
    const fur = std(look.skin, { roughness: 0.7 }), white = std('#fff4e6', { roughness: 0.7 }), dark = std('#2a1a12', { roughness: 0.7 });
    // hide the bear's round ears (the boxes sitting on top of the head)
    p.head.children.forEach((m) => { if (m.position.y > 0.25) m.visible = false; });
    if (look.fox) {
      for (const sx of [-1, 1]) {
        const ear = new T.Mesh(new T.ConeGeometry(0.12, 0.3, 4), fur);
        ear.position.set(sx * 0.18, 0.36, 0.02);
        ear.rotation.set(0, Math.PI / 4, sx * -0.18);
        p.head.add(ear);
        const tip = new T.Mesh(new T.ConeGeometry(0.06, 0.12, 4), dark);
        tip.position.set(sx * 0.2, 0.47, 0.02);
        tip.rotation.set(0, Math.PI / 4, sx * -0.18);
        p.head.add(tip);
      }
      const chin = new T.Mesh(new T.BoxGeometry(0.36, 0.12, 0.06), white);
      chin.position.set(0, -0.2, -0.23);
      p.head.add(chin);
      // the tail: three puffy segments curling up behind, the last one white
      const tail = new T.Group();
      tail.position.set(0, 0.08, 0.22);
      p.hips.add(tail);
      [[0, 0, 0.12, 0.13, fur], [0, 0.12, 0.3, 0.15, fur], [0, 0.3, 0.42, 0.12, white]].forEach(([x, y, z, r, m]) => {
        const s = new T.Mesh(new T.SphereGeometry(r, 10, 8), m);
        s.position.set(x, y, z);
        s.scale.set(1, 1, 1.4);
        tail.add(s);
      });
      tail.rotation.x = -0.3;
    } else {
      // a frog: the bear's own eyes and nose go, big eyes sit on top, and a wide smile
      p.head.children.forEach((m) => { if (m.position.z < -0.24 && m.position.y > -0.08) m.visible = false; });
      const eyeW = std('#ffffff', { roughness: 0.3 }), pupil = std('#14121f', { roughness: 0.3 });
      for (const sx of [-1, 1]) {
        const bulb = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), fur);
        bulb.position.set(sx * 0.15, 0.27, -0.08);
        p.head.add(bulb);
        const eye = new T.Mesh(new T.SphereGeometry(0.085, 12, 10), eyeW);
        eye.position.set(sx * 0.15, 0.29, -0.15);
        p.head.add(eye);
        const pu = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), pupil);
        pu.position.set(sx * 0.15, 0.3, -0.225);
        p.head.add(pu);
      }
      const smile = new T.Mesh(new T.BoxGeometry(0.34, 0.03, 0.03), std('#2a5a20'));
      smile.position.set(0, -0.08, -0.315);
      p.head.add(smile);
      for (const sx of [-1, 1]) {
        const cheek = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.02), std('#ff9db0'));
        cheek.position.set(sx * 0.2, -0.02, -0.25);
        p.head.add(cheek);
      }
    }
    return p;
  };
})();
