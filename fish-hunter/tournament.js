// Deterministic tournament play (API mode). Runs the SHARED sim-core stepper
// live on the game canvas, records the per-tick input log, and renders with the
// existing art. Because the server replays the same module, the score the player
// sees == the authoritative score they're paid on (cheat-proof).
import { createSim, SIM, TICKS } from './sim-core.mjs';

const DT = 1 / SIM.HZ;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const mkImg = (src) => { const i = new Image(); i.src = src; return i; };
const scene = mkImg('assets/scene.png?v=2');
const cannonImg = mkImg('assets/cannon.png');
const SPRITE = { fry: 'minnow', minnow: 'minnow', darter: 'darter', ray: 'ray', angler: 'angler', seacat: 'seacat', golden: 'golden', shark: 'shark', levia: 'levia', whale: 'whale' };
const fishImg = {}; for (const k of new Set(Object.values(SPRITE))) fishImg[k] = mkImg('assets/fish-' + k + '.png');

let active = false, sim = null, inputs = null, acc = 0, last = 0, roundId = null, onEnd = null, curSeed = null;
let aim = { x: SIM.W / 2, y: SIM.H * 0.4 }, firing = false;

const toLogical = (e) => { const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) / r.width * SIM.W, y: (t.clientY - r.top) / r.height * SIM.H }; };
const onMove = (e) => { aim = toLogical(e); };
const onDown = (e) => { e.preventDefault(); aim = toLogical(e); firing = true; };
const onUp = () => { firing = false; };

function start(seed, opts = {}) {
  sim = createSim(seed); curSeed = seed; inputs = []; acc = 0; last = performance.now(); firing = false;
  roundId = opts.roundId; onEnd = opts.onEnd; active = true;
  window.__tournamentActive = true;
  window.__tour = { get score() { return sim ? sim.score : 0; }, get inputs() { return inputs; }, get roundId() { return roundId; }, get sim() { return sim; }, get seed() { return curSeed; } };
  document.body.classList.add('playing');
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  requestAnimationFrame(loop);
}
window.startTournament = start;

function finish() {
  active = false; window.__tournamentActive = false;
  canvas.removeEventListener('pointermove', onMove);
  canvas.removeEventListener('pointerdown', onDown);
  window.removeEventListener('pointerup', onUp);
  document.body.classList.remove('playing');
  if (onEnd) onEnd(sim.score, inputs);
}

function loop(now) {
  if (!active) return;
  const dt = Math.min((now - last) / 1000, 0.25); last = now; acc += dt;
  while (acc >= DT && !sim.done) { const inp = { x: aim.x, y: aim.y, f: firing ? 1 : 0 }; inputs.push(inp); sim.step(inp); acc -= DT; }
  render();
  if (sim.done) return finish();
  requestAnimationFrame(loop);
}

function render() {
  const W = window.innerWidth, H = window.innerHeight, sx = W / SIM.W, sy = H / SIM.H;
  if (scene.complete && scene.naturalWidth) ctx.drawImage(scene, 0, 0, W, H);
  else { ctx.fillStyle = '#06222e'; ctx.fillRect(0, 0, W, H); }
  for (const f of sim.fish) {
    const im = fishImg[SPRITE[f.key]], w = f.size * 2.6 * sx, h = f.size * 2.6 * sy;
    ctx.save(); ctx.translate(f.x * sx, f.y * sy); if (f.vx < 0) ctx.scale(-1, 1);
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    else { ctx.fillStyle = '#39e6c4'; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#aef9ec';
  for (const b of sim.bullets) { ctx.beginPath(); ctx.arc(b.x * sx, b.y * sy, 6, 0, 6.28); ctx.fill(); }
  ctx.restore();
  const ang = Math.atan2(aim.y - SIM.CANNON_Y, aim.x - SIM.CANNON_X);
  ctx.save(); ctx.translate(SIM.CANNON_X * sx, SIM.CANNON_Y * sy); ctx.rotate(ang + Math.PI / 2);
  if (cannonImg.complete && cannonImg.naturalWidth) { const cw = 64 * sx, ch = 100 * sy; ctx.drawImage(cannonImg, -cw / 2, -ch * 0.66, cw, ch); }
  ctx.restore();
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('hud-score', sim.score.toLocaleString()); set('hud-time', Math.ceil((TICKS - sim.tick) / SIM.HZ)); set('hud-combo', 'x' + sim.combo);
  const cb = document.getElementById('combo-block'); if (cb) cb.classList.toggle('live', sim.combo > 1);
}
