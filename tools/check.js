#!/usr/bin/env node
/* Runs the rules check in Node (no browser, no npm):  node tools/check.js [--quick]
   Loads js/sim.js and js/check.js into a sandbox with a fake `window`, runs the check, then runs it again on each
   deliberately broken game (sabotage) to prove the check can fail. Exit code 1 if anything is wrong. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/sim.js', 'js/check.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const C = ctx.TT.check;
const quick = process.argv.includes('--quick');
const o = quick ? { seas: 40, sail: 3, fights: 2, voyages: 1 } : {};
let bad = 0;

const t0 = Date.now();
const r = C.check(o);
for (const p of r.parts) {
  const info = Object.entries(p).filter(([k]) => k !== 'name' && k !== 'probs').map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${p.probs.length ? 'FAIL' : 'ok  '} ${p.name}: ${info}`);
  for (const pr of p.probs.slice(0, 5)) console.log('       ' + pr);
}
if (!r.ok) bad++;
console.log(`check ${r.ok ? 'passed' : 'FAILED'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// every sabotage must make the check fail, in the part it's about
const want = { flip: 'navigation', mirror: 'navigation', wall: 'every island reachable', dry: 'battles end' };
for (const sab of C.SABOTAGES) {
  const s = C.check(Object.assign({}, o, { sabotage: sab, seas: 20, sail: 2, fights: 2, voyages: 1 }));
  const failed = s.parts.filter((p) => p.probs.length).map((p) => p.name);
  const caught = failed.includes(want[sab]);
  if (!caught) bad++;
  const first = s.parts.find((p) => p.name === want[sab]).probs[0];
  console.log(`  sabotage ${sab.padEnd(6)} ${caught ? 'caught' : 'MISSED'} (${failed.join(', ') || 'nothing failed'})${first ? ': ' + first : ''}`);
}
process.exit(bad ? 1 : 0);
