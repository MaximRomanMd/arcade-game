// ── Abyss Hunter deterministic sim-core ───────────────────────────────────
// The CANONICAL, renderer-agnostic scoring simulation. Pure function of
// (seed, inputs): no DOM, no wall-clock, fixed timestep. The SERVER replays it
// to derive the authoritative score (cheat-proof — the client's claimed score
// is never trusted); the CLIENT runs the same module so the player sees exactly
// what they're paid on. Works unchanged in Node and the browser (ESM).
//
// Logical space is fixed (independent of screen) so every device + the server
// produce identical results. The client maps logical→screen for rendering.

export const SIM = Object.freeze({
  W: 1280, H: 720,          // fixed logical board
  HZ: 30, ROUND_SECONDS: 90,
  CANNON_X: 640, CANNON_Y: 700,
  BULLET_SPEED: 900,        // logical px/s
  FIRE_COOLDOWN_TICKS: 6,   // 5 shots/sec at 30Hz
  BULLET_DMG: 5,
  COMBO_WINDOW_TICKS: 78,   // ~2.6s
});
export const TICKS = SIM.HZ * SIM.ROUND_SECONDS;     // 2700
const DT = 1 / SIM.HZ;

// Fish catalogue (hp / value / size / speed / spawn weight). Mirrors the game.
const FISH = {
  fry:    { hp: 12,   value: 3,    size: 11,  speed: 215, weight: 24 },
  minnow: { hp: 15,   value: 5,    size: 16,  speed: 170, weight: 38 },
  darter: { hp: 21,   value: 12,   size: 22,  speed: 135, weight: 28 },
  ray:    { hp: 33,   value: 30,   size: 34,  speed: 88,  weight: 18 },
  angler: { hp: 48,   value: 70,   size: 30,  speed: 110, weight: 9  },
  seacat: { hp: 84,   value: 100,  size: 42,  speed: 95,  weight: 6  },
  golden: { hp: 66,   value: 160,  size: 30,  speed: 160, weight: 4  },
  shark:  { hp: 135,  value: 230,  size: 58,  speed: 135, weight: 3  },
  levia:  { hp: 210,  value: 380,  size: 64,  speed: 55,  weight: 1  },
  whale:  { hp: 285,  value: 600,  size: 118, speed: 46,  weight: 1  },
};
const KEYS = Object.keys(FISH);
const TOTAL_WEIGHT = KEYS.reduce((s, k) => s + FISH[k].weight, 0);

// Deterministic PRNG (mulberry32) — canonical across server + client.
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pickType(r, frac) {
  let roll = r() * TOTAL_WEIGHT;
  for (const k of KEYS) {
    let w = FISH[k].weight;
    if (frac > 0.25 && FISH[k].value >= 30) w *= 1.55;   // late-game bias toward richer fish
    roll -= w; if (roll <= 0) return k;
  }
  return 'minnow';
}

function spawn(r, frac) {
  const key = pickType(r, frac), t = FISH[key];
  const edge = (r() * 4) | 0; let x, y;
  if (edge === 0) { x = -t.size; y = r() * SIM.H; }
  else if (edge === 1) { x = SIM.W + t.size; y = r() * SIM.H; }
  else if (edge === 2) { x = r() * SIM.W; y = -t.size; }
  else { x = r() * SIM.W; y = SIM.H + t.size; }
  const tx = SIM.W * (0.2 + r() * 0.6), ty = SIM.H * (0.15 + r() * 0.55);
  let dx = tx - x, dy = ty - y; const len = Math.hypot(dx, dy) || 1;
  const sp = t.speed * (0.85 + r() * 0.3);
  return { key, hp: t.hp, value: t.value, size: t.size, x, y, vx: dx / len * sp, vy: dy / len * sp };
}

// Stateful stepper — the SINGLE source of truth. The client steps it live
// (rendering S.fish/S.bullets, showing S.score); the server replays it. Same
// code both sides ⇒ the player's score == the server's authoritative score.
//   input per tick = { x, y, f } : aim point in LOGICAL coords, f=1 if firing.
export function createSim(seed) {
  const r = rng(seed);
  const S = { fish: [], bullets: [], score: 0, kills: 0, combo: 1, tick: 0, done: false };
  let comboKills = 0, comboTimer = 0, cooldown = 0, spawnTimer = 0;
  for (let i = 0; i < 5; i++) S.fish.push(spawn(r, 0));      // seed the board
  S.step = (inp) => {
    if (S.tick >= TICKS) { S.done = true; return S; }
    const frac = S.tick / TICKS; inp = inp || {};
    const { fish, bullets } = S;
    if (--spawnTimer <= 0) {
      fish.push(spawn(r, frac));
      if (r() < 0.4) fish.push(spawn(r, frac));
      spawnTimer = Math.round((SIM.HZ * (0.66 - frac * 0.4)) * (0.7 + r() * 0.6));
      if (spawnTimer < 4) spawnTimer = 4;
    }
    if (fish.length < 8) fish.push(spawn(r, frac));
    if (cooldown > 0) cooldown--;
    if (inp.f && cooldown <= 0) {
      const ax = +inp.x, ay = +inp.y;
      if (Number.isFinite(ax) && Number.isFinite(ay)) {
        let dx = ax - SIM.CANNON_X, dy = ay - SIM.CANNON_Y; const len = Math.hypot(dx, dy) || 1;
        bullets.push({ x: SIM.CANNON_X, y: SIM.CANNON_Y, vx: dx / len * SIM.BULLET_SPEED, vy: dy / len * SIM.BULLET_SPEED, life: 90 });
        cooldown = SIM.FIRE_COOLDOWN_TICKS;
      }
    }
    for (const f of fish) { f.x += f.vx * DT; f.y += f.vy * DT; }
    for (let j = fish.length - 1; j >= 0; j--) { const f = fish[j]; if (f.x < -160 || f.x > SIM.W + 160 || f.y < -160 || f.y > SIM.H + 160) fish.splice(j, 1); }
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi]; b.x += b.vx * DT; b.y += b.vy * DT;
      if (--b.life <= 0 || b.x < -20 || b.x > SIM.W + 20 || b.y < -20 || b.y > SIM.H + 20) { bullets.splice(bi, 1); continue; }
      for (let fj = 0; fj < fish.length; fj++) {
        const f = fish[fj], ex = f.size * 1.6, ey = f.size * 0.82, lx = b.x - f.x, ly = b.y - f.y;
        if ((lx * lx) / (ex * ex) + (ly * ly) / (ey * ey) <= 1) {
          f.hp -= SIM.BULLET_DMG;
          if (f.hp <= 0) {
            comboTimer = SIM.COMBO_WINDOW_TICKS; comboKills++;
            S.combo = Math.max(1, Math.min(8, 1 + Math.floor(comboKills / 2)));
            S.score += Math.round(f.value * S.combo); S.kills++;
            fish.splice(fj, 1);
          }
          bullets.splice(bi, 1); break;
        }
      }
    }
    if (comboTimer > 0 && --comboTimer <= 0) { S.combo = 1; comboKills = 0; }
    S.tick++;
    if (S.tick >= TICKS) S.done = true;
    return S;
  };
  return S;
}

// Replay (seed, inputs) → authoritative result. Built on createSim, so it is
// byte-identical to what the client computed live.
export function replay(seed, inputs) {
  const s = createSim(seed);
  const n = Math.min(TICKS, (inputs && inputs.length) || 0);
  for (let t = 0; t < n; t++) s.step(inputs[t]);
  return { score: s.score, kills: s.kills, ticks: n };
}
