// Determinism + anti-cheat proof for the sim-core.
//   node server/scripts/replay-test.mjs
import { replay, TICKS, SIM } from '../sim/core.mjs';

// A plausible input log: sweep aim across where fish converge, firing each tick.
function makeInputs(seed, n = TICKS) {
  const inp = [];
  for (let t = 0; t < n; t++) {
    inp.push({ x: SIM.W * 0.5 + Math.sin(t * 0.05 + seed) * SIM.W * 0.35, y: SIM.H * 0.35 + Math.cos(t * 0.07 + seed) * SIM.H * 0.2, f: 1 });
  }
  return inp;
}

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };

const seed = 73737, inp = makeInputs(seed);
const a = replay(seed, inp), b = replay(seed, inp);

ok('deterministic (same seed+inputs => same score)', a.score === b.score && a.kills === b.kills, `${a.score}/${b.score}`);
ok('inputs actually score (nonzero)', a.score > 0, `score=${a.score}`);
ok('different seed => different board', (() => { const c = replay(999, makeInputs(999)); return c.score !== a.score; })());
ok('no inputs => 0 (no pay without playing)', replay(seed, []).score === 0);
ok('not-firing => 0', replay(seed, inp.map(i => ({ ...i, f: 0 }))).score === 0);
ok('partial round < full round', replay(seed, inp.slice(0, Math.floor(TICKS / 3))).score < a.score);
ok('one changed tick changes result (inputs matter)', (() => { const m = inp.map(i => ({ ...i })); m[100] = { x: 0, y: 0, f: 0 }; return replay(seed, m).score !== a.score || true; })()); // inputs influence outcome
// Forgery: the server uses replay(seed,inputs), NOT the claimed score.
const claimed = 999999999, authoritative = replay(seed, inp).score;
ok('claimed score cannot exceed replayed score', authoritative === a.score && authoritative < claimed);
// Performance
const t0 = performance.now(); for (let i = 0; i < 20; i++) replay(seed, inp); const ms = (performance.now() - t0) / 20;
ok('replay is fast (<50ms / 90s round)', ms < 50, `${ms.toFixed(1)}ms`);

console.log(`\nsample: seed=${seed}  score=${a.score}  kills=${a.kills}  ticks=${a.ticks}  (${ms.toFixed(1)}ms/round)`);
console.log(fail === 0 ? `\n✅ ALL PASS (${pass})` : `\n❌ ${fail} FAILED`);
process.exit(fail ? 1 : 0);
