'use strict';
/* ════════════════════════════════════════════════════════════════
   ABYSS HUNTER  —  skill-based deep-sea shooting arcade
   Pure HTML5 Canvas + vanilla JS. No dependencies.

   NOTE ON GRAPHICS: fish are drawn procedurally for the prototype.
   To drop in ludo.ai art later, give a FISH_TYPES entry a `sprite`
   (an Image) and the renderer will use it instead of the vector body.
   ════════════════════════════════════════════════════════════════ */

// ── canvas / context ────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
let   W = 0, H = 0, DPR = 1;

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ── player identity (shared with portal) ────────────────────────
const NICK = localStorage.getItem('portal_nickname') || 'Hunter';
const K = {
  best:   `fishhunter_best_${NICK}`,
  games:  `fishhunter_games_${NICK}`,
  coins:  `fishhunter_total_coins_${NICK}`,
  bigCombo:`fishhunter_best_combo_${NICK}`,
  lb:     'fishhunter_lb',
};
const ls  = (k, d=0) => parseInt(localStorage.getItem(k) || d, 10);
const lsS = (k, v)   => localStorage.setItem(k, String(v));

// ── tuning ───────────────────────────────────────────────────────
const ROUND_TIME   = 90;     // seconds (tournament)
const START_CREDITS= 120;
const FIRE_COOLDOWN= 0.14;    // seconds between shots while holding
const MAX_WPN_LV   = 5;
const COMBO_WINDOW = 2.6;     // seconds to keep the combo alive

// ── fish catalogue ───────────────────────────────────────────────
// hp, value(points), size(radius-ish), speed(px/s), color, glow
const FISH_TYPES = {
  minnow : { hp:1,  value:5,   size:16, speed:170, color:'#39e6c4', glow:'#aef9ec', weight:38, coins:1 },
  darter : { hp:2,  value:12,  size:22, speed:135, color:'#4aa8ff', glow:'#bfe2ff', weight:28, coins:2 },
  ray    : { hp:4,  value:30,  size:34, speed:88,  color:'#b07bff', glow:'#e4d2ff', weight:18, coins:5 },
  angler : { hp:6,  value:70,  size:30, speed:110, color:'#ff7a59', glow:'#ffd2b0', weight:9,  coins:11, hunter:true },
  golden : { hp:9,  value:140, size:30, speed:160, color:'#ffce63', glow:'#fff1c2', weight:4,  coins:24, shiny:true },
  levia  : { hp:22, value:320, size:64, speed:55,  color:'#ffb13d', glow:'#ffe7a8', weight:1,  coins:60, boss:true },
};
const TYPE_KEYS = Object.keys(FISH_TYPES);
const TOTAL_WEIGHT = TYPE_KEYS.reduce((s,k)=>s+FISH_TYPES[k].weight,0);

// optional ludo.ai fish art: assets/fish-<key>.png auto-loads into each type
TYPE_KEYS.forEach(k => {
  const img = new Image();
  img.onload = () => { FISH_TYPES[k].sprite = img; };
  img.src = `assets/fish-${k}.png`;
});

function pickType(elapsedFrac){
  // late game biases toward richer targets
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const k of TYPE_KEYS){
    let w = FISH_TYPES[k].weight;
    if (elapsedFrac > 0.5 && FISH_TYPES[k].value >= 30) w *= 1.35;
    roll -= w;
    if (roll <= 0) return k;
  }
  return 'minnow';
}

// ── game state ───────────────────────────────────────────────────
let mode = 'tournament';
let running = false;
let fish = [], bullets = [], particles = [], pops = [], rings = [], bubbles = [];
let aim = { x: W/2, y: H*0.4 };
let firing = false, fireTimer = 0;
let wpnLevel = 1;
let credits = START_CREDITS;
let score = 0, timeLeft = ROUND_TIME, shake = 0, flash = 0, flashColor = '#28e0c8';
let combo = 1, comboTimer = 0, comboKills = 0;
let spawnTimer = 0, elapsed = 0;
let stats = { shots:0, hits:0, kills:0, bestCombo:1, biggest:'—', biggestVal:0, coins:0 };
const cannon = { x: W/2, y: H, len: 46 };
// cannon sprite geometry (measured from cannon.png): joint at 66% down, ratio 0.756
const CN_TH = 156;                 // drawn sprite height
const CN_TW = CN_TH * 0.756;       // drawn width (natural ratio)
const CN_JOINT = 0.663;            // joint (pivot) fraction from top
const CN_BARREL = CN_TH * CN_JOINT * 0.9; // muzzle distance from pivot

// ── phase / boot (splash → loading → menu → playing → over) ──────
let phase = 'boot';              // boot | dive | menu | playing | over
let bootT = 0;
const BOOT_DUR = 2.6;            // seconds of splash+loading
const LOAD_MSGS = [
  'Charting the depths…', 'Calibrating the cannon…',
  'Releasing the shoals…', 'Pressurising the hull…', 'Diving in…',
];
let cannonSway = 0;              // gentle barrel motion on menu/splash
let diveT = 0;                   // dive transition timer
const DIVE_DUR = 1.25;           // seconds of the plunge
let diveStreaks = [];            // fast rising bubbles during the dive

// optional ludo.ai splash logo (assets/logo.png) — auto-used if present
const logoImg = new Image();
logoImg.onload  = () => {
  const el = document.getElementById('boot-logo-img');
  const tx = document.getElementById('boot-logo-text');
  if (el){ el.src = logoImg.src; el.style.display = 'block'; }
  if (tx) tx.style.display = 'none';
};
logoImg.src = 'assets/logo.png';

// optional ludo.ai seabed/background image (assets/scene.png)
const sceneImg = new Image(); let sceneReady = false;
sceneImg.onload = () => { sceneReady = true; };
sceneImg.src = 'assets/scene.png';

// optional ludo.ai cannon turret (assets/cannon.png) — barrel pointing UP
const cannonImg = new Image(); let cannonReady = false;
cannonImg.onload = () => { cannonReady = true; };
cannonImg.src = 'assets/cannon.png';

// ════════════════════════════════════════════════════════════════
//  SOUND — procedural Web Audio (no files)
// ════════════════════════════════════════════════════════════════
let actx = null, masterGain = null, ambGain = null, muted = false;
function initAudio(){
  if (actx){ if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = muted ? 0 : 0.9;
    masterGain.connect(actx.destination);
    startAmbient();
  } catch(e){ actx = null; }
}
function startAmbient(){
  if (!actx) return;
  ambGain = actx.createGain(); ambGain.gain.value = 0; ambGain.connect(masterGain);
  const o1 = actx.createOscillator(), o2 = actx.createOscillator();
  o1.type = 'sine'; o2.type = 'sine'; o1.frequency.value = 56; o2.frequency.value = 84;
  const lfo = actx.createOscillator(), lfoG = actx.createGain();
  lfo.frequency.value = 0.08; lfoG.gain.value = 9; lfo.connect(lfoG); lfoG.connect(o2.frequency);
  const flt = actx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 300;
  o1.connect(flt); o2.connect(flt); flt.connect(ambGain);
  o1.start(); o2.start(); lfo.start();
  ambGain.gain.linearRampToValueAtTime(0.10, actx.currentTime + 2.5);
}
function _env(g, t0, vol, dur){
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function blip({freq=440, type='sine', dur=0.12, vol=0.25, slideTo=null}){
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, actx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo), actx.currentTime + dur);
  o.connect(g); g.connect(masterGain);
  _env(g, actx.currentTime, vol, dur);
  o.start(); o.stop(actx.currentTime + dur + 0.03);
}
function noiseBurst({dur=0.3, vol=0.35, freq=800, type='lowpass', q=1}){
  if (!actx) return;
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate*dur), actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  const n = actx.createBufferSource(); n.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain();
  n.connect(f); f.connect(g); g.connect(masterGain);
  _env(g, actx.currentTime, vol, dur);
  n.start(); n.stop(actx.currentTime + dur + 0.03);
}
function sfxShoot(){ blip({freq:680,type:'square',dur:0.08,vol:0.10,slideTo:240}); noiseBurst({dur:0.05,vol:0.04,freq:2000,type:'highpass'}); }
function sfxHit(){ blip({freq:320,type:'triangle',dur:0.05,vol:0.10,slideTo:170}); }
function sfxKill(big){ noiseBurst({dur:big?0.6:0.28,vol:big?0.5:0.3,freq:big?480:900,type:'lowpass',q:1}); blip({freq:big?150:260,type:'sine',dur:big?0.5:0.22,vol:0.16,slideTo:55}); }
function sfxCoin(){ blip({freq:1300,type:'sine',dur:0.12,vol:0.08,slideTo:2050}); }
function sfxCombo(n){ const f=480+n*80; blip({freq:f,type:'sine',dur:0.15,vol:0.12,slideTo:f*1.5}); }
function sfxDive(){ noiseBurst({dur:1.0,vol:0.4,freq:700,type:'lowpass',q:0.7}); blip({freq:420,type:'sine',dur:0.9,vol:0.13,slideTo:70}); }
function toggleMute(){
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
  const b = document.getElementById('mute-btn'); if (b) b.textContent = muted ? '🔇' : '🔊';
}

// ── helpers ──────────────────────────────────────────────────────
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:v>b?b:v;

function initBubbles(){
  bubbles = [];
  for (let i=0;i<46;i++){
    bubbles.push({ x:Math.random()*W, y:Math.random()*H,
      r:rand(1,4), spd:rand(12,40), drift:rand(-8,8), a:rand(.06,.22) });
  }
}
initBubbles();

// ── input ────────────────────────────────────────────────────────
function pointerPos(e){
  const r = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}
canvas.addEventListener('pointermove', e => { aim = pointerPos(e); });
canvas.addEventListener('pointerdown', e => {
  initAudio();
  aim = pointerPos(e); firing = true; fireTimer = 0; tryFire();
});
window.addEventListener('pointerup',   () => firing = false);
window.addEventListener('pointercancel',() => firing = false);
window.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=' ) setWpn(wpnLevel+1);
  if (e.key === '-' || e.key === '_' ) setWpn(wpnLevel-1);
  if (e.code === 'Space'){ firing = true; tryFire(); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') firing = false; });

document.getElementById('wpn-up').onclick   = () => setWpn(wpnLevel+1);
document.getElementById('wpn-down').onclick = () => setWpn(wpnLevel-1);

function setWpn(lv){
  wpnLevel = clamp(lv, 1, MAX_WPN_LV);
  document.getElementById('wpn-level').textContent = 'LV ' + wpnLevel;
  document.getElementById('wpn-cost').textContent  =
    `cost ${wpnLevel} / shot · ${wpnLevel} dmg`;
}

// ── firing ───────────────────────────────────────────────────────
function tryFire(){
  if (!running) return;
  const cost = wpnLevel;
  if (credits < cost) {           // not enough — drop to affordable
    if (credits < 1) return;
    setWpn(credits);
  }
  credits -= wpnLevel;
  stats.shots++;
  const dx = aim.x - cannon.x, dy = aim.y - cannon.y;
  const a  = Math.atan2(dy, dx);
  const bl = cannonReady ? CN_BARREL : cannon.len;
  const muzzleX = cannon.x + Math.cos(a)*bl;
  const muzzleY = cannon.y + Math.sin(a)*bl;
  const speed = 720 + wpnLevel*40;
  // higher levels fire a tight spread of pellets
  const pellets = wpnLevel >= 4 ? 3 : wpnLevel >= 2 ? 2 : 1;
  const spread  = pellets > 1 ? 0.06 : 0;
  for (let i=0;i<pellets;i++){
    const off = pellets>1 ? (i-(pellets-1)/2)*spread : 0;
    bullets.push({
      x:muzzleX, y:muzzleY,
      vx:Math.cos(a+off)*speed, vy:Math.sin(a+off)*speed,
      dmg: wpnLevel, r: 4+wpnLevel, life: 1.4, trail: [],
    });
  }
  // muzzle flash particles
  for (let i=0;i<6;i++){
    particles.push({ x:muzzleX, y:muzzleY,
      vx:Math.cos(a)*rand(60,180)+rand(-40,40),
      vy:Math.sin(a)*rand(60,180)+rand(-40,40),
      r:rand(1,3), life:.25, max:.25, c:'#aef9ec' });
  }
  shake = Math.min(shake + wpnLevel*0.6, 7);
  sfxShoot();
  updateHUD();
}

// ── spawning ─────────────────────────────────────────────────────
function spawnFish(forceSchool){
  const frac = mode==='tournament' ? 1-(timeLeft/ROUND_TIME) : Math.min(elapsed/90,1);
  const key  = pickType(frac);
  const t    = FISH_TYPES[key];
  const fromLeft = Math.random() < 0.5;
  const y = rand(H*0.12, H*0.78);
  const baseVx = (fromLeft?1:-1) * t.speed * rand(0.85,1.15);
  const f = {
    key, ...t, maxHp:t.hp,
    x: fromLeft ? -t.size*2 : W + t.size*2,
    y, vx: baseVx,
    amp: rand(8, 36), freq: rand(0.6,1.6), phase: Math.random()*6.28,
    baseY: y, t: 0, dir: fromLeft?1:-1, wig: Math.random()*6.28,
    hitFlash: 0,
  };
  fish.push(f);
  // schools of minnows / darters
  if (forceSchool && (key==='minnow'||key==='darter')){
    const n = key==='minnow'? 5 : 3;
    for (let i=1;i<=n;i++){
      fish.push({ ...f, x:f.x - f.dir*i*t.size*2.4,
        baseY: clamp(y + rand(-30,30), H*0.1, H*0.8),
        phase: Math.random()*6.28 });
    }
  }
}

// ── combo ────────────────────────────────────────────────────────
function addKillCombo(){
  comboTimer = COMBO_WINDOW;
  comboKills++;
  const _oldCombo = combo;
  combo = clamp(1 + Math.floor(comboKills/2), 1, 8);
  if (combo > _oldCombo) sfxCombo(combo);
  stats.bestCombo = Math.max(stats.bestCombo, combo);
  const cb = document.getElementById('combo-block');
  cb.classList.add('live');
  document.getElementById('hud-combo').textContent = 'x' + combo;
}
function decayCombo(dt){
  if (comboTimer > 0){
    comboTimer -= dt;
    if (comboTimer <= 0){
      combo = 1; comboKills = 0;
      document.getElementById('hud-combo').textContent = 'x1';
      document.getElementById('combo-block').classList.remove('live');
    }
  }
}

// ── kill / hit fx ────────────────────────────────────────────────
function hurtFish(f, dmg, bx, by){
  f.hp -= dmg; f.hitFlash = 0.12;
  stats.hits++;
  sfxHit();
  for (let i=0;i<5;i++){
    particles.push({ x:bx, y:by, vx:rand(-90,90), vy:rand(-90,90),
      r:rand(1,2.5), life:.3, max:.3, c:f.glow });
  }
  if (f.hp <= 0) killFish(f);
}

function killFish(f){
  const gained = Math.round(f.value * combo);
  score += gained;
  credits += f.coins;
  stats.kills++; stats.coins += f.coins;
  sfxKill(f.boss || f.shiny); sfxCoin();
  if (f.value > stats.biggestVal){ stats.biggestVal = f.value; stats.biggest = labelFor(f.key); }
  addKillCombo();

  // explosion particles
  const n = f.boss ? 60 : f.size > 30 ? 34 : 18;
  for (let i=0;i<n;i++){
    const a = Math.random()*6.28, sp = rand(40, f.boss?420:240);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      r:rand(1.5,4.5), life:rand(.4,.9), max:.9,
      c: Math.random()<0.5 ? f.color : f.glow });
  }
  // gold coin sparkle burst
  for (let i=0;i<Math.min(f.coins,18);i++){
    const a=Math.random()*6.28, sp=rand(60,200);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60,
      r:rand(1.5,3), life:rand(.5,1), max:1, c:'#ffce63', grav:280 });
  }
  // shockwave ring
  rings.push({ x:f.x, y:f.y, r:f.size, max:f.size*(f.boss?6:3.4), life:.5, c:f.glow });
  // score popup
  pops.push({ x:f.x, y:f.y, txt:'+'+gained, life:.9, max:.9,
    c: combo>1 ? '#ffce63' : '#aef9ec', big:f.boss||f.shiny });
  // screen impact
  shake = Math.min(shake + (f.boss?16:f.size>30?7:3), 22);
  if (f.boss || f.shiny){ flash = 0.35; flashColor = f.glow; }

  fish.splice(fish.indexOf(f), 1);
  updateHUD();
}

function labelFor(k){
  return { minnow:'Minnow', darter:'Darter', ray:'Manta Ray',
    angler:'Angler', golden:'Golden Koi', levia:'Leviathan' }[k] || k;
}

// ── HUD ──────────────────────────────────────────────────────────
function updateHUD(){
  document.getElementById('hud-score').textContent   = score;
  document.getElementById('hud-credits').textContent = Math.max(0,Math.floor(credits));
  document.getElementById('hud-time').textContent    =
    mode==='tournament' ? Math.ceil(timeLeft) : '∞';
}

// ── ambient (decorative) fish for splash + menu ──────────────────
function spawnAmbient(){
  const calm = ['minnow','darter','ray','golden'];
  const key  = calm[(Math.random()*calm.length)|0];
  const t    = FISH_TYPES[key];
  const fromLeft = Math.random() < 0.5;
  const y = rand(H*0.14, H*0.82);
  fish.push({ key, ...t, maxHp:t.hp, ambient:true,
    x: fromLeft ? -t.size*2 : W + t.size*2, y, baseY:y,
    vx:(fromLeft?1:-1)*t.speed*rand(0.4,0.7),
    amp:rand(10,30), freq:rand(0.5,1.2), phase:Math.random()*6.28,
    t:0, dir:fromLeft?1:-1, wig:Math.random()*6.28, hitFlash:0 });
}
function seedAmbient(){ fish = []; for(let i=0;i<9;i++){ spawnAmbient(); fish[i].x = rand(0,W); } }

function updateAmbient(dt){
  cannon.x = W/2; cannon.y = H - 40;
  cannonSway += dt;
  for (const f of fish){
    f.t += dt; f.wig += dt*6;
    f.x += f.vx*dt;
    f.y = f.baseY + Math.sin(f.t*f.freq*3 + f.phase)*f.amp;
    if (f.x < -f.size*3 || f.x > W+f.size*3) f._gone = true;
  }
  fish = fish.filter(f => !f._gone);
  while (fish.length < 9) spawnAmbient();
  for (const bu of bubbles){
    bu.y -= bu.spd*dt; bu.x += bu.drift*dt;
    if (bu.y < -10){ bu.y = H+10; bu.x = Math.random()*W; }
  }
  for (const p of particles){ p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; }
  particles = particles.filter(p => p.life > 0);
}

// ── boot: splash + loading, then reveal menu ─────────────────────
function updateBoot(dt){
  bootT += dt;
  const p = clamp(bootT / BOOT_DUR, 0, 1);
  const eased = p*p*(3-2*p);
  const fill = document.getElementById('loading-fill');
  const pct  = document.getElementById('loading-pct');
  const msg  = document.getElementById('loading-msg');
  if (fill) fill.style.width = (eased*100).toFixed(0) + '%';
  if (pct)  pct.textContent  = Math.round(eased*100) + '%';
  if (msg)  msg.textContent  = LOAD_MSGS[Math.min(LOAD_MSGS.length-1, Math.floor(p*LOAD_MSGS.length))];
  updateAmbient(dt);
  if (p >= 1) startDive();
}

// ── dive: the plunge from splash down into the sea ───────────────
function startDive(){
  if (phase !== 'boot') return;
  phase = 'dive'; diveT = 0;
  document.getElementById('overlay-boot').classList.add('dive'); // title flies up
  flash = 0.7; flashColor = '#aef9ec';                            // splash flash
  // a curtain of fast rising bubbles
  diveStreaks = [];
  for (let i=0;i<70;i++){
    diveStreaks.push({ x:Math.random()*W, y:H+Math.random()*H,
      r:rand(2,7), spd:rand(380,820), wob:rand(-30,30) });
  }
  shake = 10;
}
function updateDive(dt){
  diveT += dt;
  updateAmbient(dt);
  for (const s of diveStreaks){
    s.y -= s.spd*dt; s.x += s.wob*dt;
  }
  diveStreaks = diveStreaks.filter(s => s.y > -20);
  if (diveT >= DIVE_DUR) revealMenu();
}

function revealMenu(){
  phase = 'menu';
  const boot = document.getElementById('overlay-boot');
  boot.classList.add('fade');
  diveStreaks = [];
  document.getElementById('start-best').textContent = ls(K.best);
  document.getElementById('overlay-start').classList.remove('hidden');
  setTimeout(() => { boot.classList.add('hidden'); boot.classList.remove('dive','fade'); }, 650);
}

// ════════════════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════════════════
function update(dt){
  elapsed += dt;
  cannon.x = W/2; cannon.y = H - 40;

  if (mode==='tournament'){
    timeLeft -= dt;
    if (timeLeft <= 0){ timeLeft = 0; return endGame(); }
  }

  // auto-fire while holding
  if (firing){
    fireTimer -= dt;
    if (fireTimer <= 0){ tryFire(); fireTimer = FIRE_COOLDOWN; }
  }

  // spawn cadence ramps up over time
  spawnTimer -= dt;
  const frac = mode==='tournament' ? 1-(timeLeft/ROUND_TIME) : Math.min(elapsed/90,1);
  const interval = clamp(1.05 - frac*0.6, 0.42, 1.05);
  if (spawnTimer <= 0){
    spawnFish(Math.random() < 0.4);
    spawnTimer = interval * rand(0.7,1.3);
  }
  if (fish.length < 4) spawnFish(Math.random()<0.5); // keep the sea alive

  decayCombo(dt);

  // fish motion
  for (const f of fish){
    f.t += dt; f.wig += dt*8;
    f.x += f.vx * dt;
    f.y = f.baseY + Math.sin(f.t*f.freq*3 + f.phase) * f.amp;
    if (f.hitFlash > 0) f.hitFlash -= dt;
    if (f.x < -f.size*3 || f.x > W + f.size*3) f._gone = true;
  }
  fish = fish.filter(f => !f._gone);

  // bullets
  for (const b of bullets){
    b.trail.push({x:b.x,y:b.y}); if (b.trail.length>7) b.trail.shift();
    b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
    if (b.x<-20||b.x>W+20||b.y<-20||b.y>H+20) b.life = 0;
    // collision
    for (const f of fish){
      const dx=f.x-b.x, dy=f.y-b.y;
      if (dx*dx+dy*dy < (f.size+b.r)*(f.size+b.r)){
        hurtFish(f, b.dmg, b.x, b.y);
        b.life = 0; break;
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0);

  // particles
  for (const p of particles){
    p.life -= dt;
    if (p.grav) p.vy += p.grav*dt;
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vx *= 0.96; p.vy *= 0.96;
  }
  particles = particles.filter(p => p.life > 0);

  // rings / pops
  for (const r of rings){ r.life -= dt; r.r += (r.max-r.r)*dt*6; }
  rings = rings.filter(r => r.life > 0);
  for (const p of pops){ p.life -= dt; p.y -= 38*dt; }
  pops = pops.filter(p => p.life > 0);

  // bubbles
  for (const bu of bubbles){
    bu.y -= bu.spd*dt; bu.x += bu.drift*dt;
    if (bu.y < -10){ bu.y = H+10; bu.x = Math.random()*W; }
  }

  if (shake > 0) shake = Math.max(0, shake - dt*40);
  if (flash > 0) flash = Math.max(0, flash - dt*1.4);
}

// ════════════════════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════════════════════
function drawBackground(time){
  const ts = time*0.001;

  // optional ludo.ai scene art (assets/scene.png) drawn 'cover'
  if (sceneReady){
    const ir = sceneImg.width/sceneImg.height, cr = W/H;
    let dw,dh; if (cr>ir){ dw=W; dh=W/ir; } else { dh=H; dw=H*ir; }
    ctx.drawImage(sceneImg, (W-dw)/2, (H-dh)/2, dw, dh);
    const ov = ctx.createLinearGradient(0,0,0,H);
    ov.addColorStop(0,'rgba(4,18,31,.35)'); ov.addColorStop(1,'rgba(1,7,13,.78)');
    ctx.fillStyle = ov; ctx.fillRect(0,0,W,H);
  } else {
    // depth gradient
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#0a3a55'); g.addColorStop(0.4,'#06182a');
    g.addColorStop(0.78,'#04101c'); g.addColorStop(1,'#010609');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // surface glow
    const sg = ctx.createLinearGradient(0,0,0,H*0.3);
    sg.addColorStop(0,'rgba(90,230,225,0.14)'); sg.addColorStop(1,'rgba(90,230,225,0)');
    ctx.fillStyle = sg; ctx.fillRect(0,0,W,H*0.3);
  }

  // god rays from the surface
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rays = 6;
  for (let i=0;i<rays;i++){
    const rx = (W/(rays-1))*i + Math.sin(ts*0.3 + i*1.7)*70;
    const wob = Math.sin(ts*0.5 + i)*0.25 + 0.75;
    const grad = ctx.createLinearGradient(rx, 0, rx+120, H);
    grad.addColorStop(0,`rgba(120,235,225,${0.09*wob})`);
    grad.addColorStop(0.6,`rgba(80,200,210,${0.03*wob})`);
    grad.addColorStop(1,'rgba(80,220,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(rx-46,0); ctx.lineTo(rx+46,0);
    ctx.lineTo(rx+170,H); ctx.lineTo(rx-20,H); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // drifting particulate (stateless, derived from time)
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (let i=0;i<60;i++){
    const seed = i*12.9898;
    const px = ((Math.sin(seed)*43758.5+ts*6*(0.3+(i%5)*0.1)) % 1 + 1) % 1 * W;
    const py = ((Math.cos(seed)*23421.6 - ts*4*(0.2+(i%4)*0.1)) % 1 + 1) % 1 * H;
    const pr = 0.5 + (i%3)*0.6;
    ctx.fillStyle = `rgba(150,225,225,${0.05+(i%4)*0.015})`;
    ctx.beginPath(); ctx.arc(px,py,pr,0,6.28); ctx.fill();
  }
  ctx.restore();

  // seabed silhouette + swaying kelp
  if (!sceneReady){
    ctx.save();
    ctx.fillStyle = '#020a10';
    ctx.beginPath();
    ctx.moveTo(0,H);
    for (let x=0;x<=W;x+=40) ctx.lineTo(x, H-26 - Math.sin(x*0.01+ts*0.2)*10 - 14);
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,90,80,.5)'; ctx.lineWidth = 6; ctx.lineCap='round';
    for (let k=0;k<7;k++){
      const kx = (W/7)*k + 30;
      ctx.beginPath(); ctx.moveTo(kx, H);
      const h1 = 70+ (k%3)*30;
      ctx.quadraticCurveTo(kx + Math.sin(ts*0.8+k)*20, H-h1*0.6,
                           kx + Math.sin(ts*0.8+k)*34, H-h1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // bubbles
  ctx.save();
  for (const bu of bubbles){
    ctx.beginPath(); ctx.arc(bu.x,bu.y,bu.r,0,6.28);
    ctx.fillStyle = `rgba(170,240,240,${bu.a})`; ctx.fill();
    ctx.beginPath(); ctx.arc(bu.x-bu.r*0.3,bu.y-bu.r*0.3,bu.r*0.35,0,6.28);
    ctx.fillStyle = `rgba(255,255,255,${bu.a*0.8})`; ctx.fill();
  }
  ctx.restore();
}

function drawFish(f){
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.dir < 0) ctx.scale(-1,1);            // face travel direction
  const s = f.size;

  // ── sprite hook (ludo.ai): use bitmap if provided ──
  const spr = FISH_TYPES[f.key] && FISH_TYPES[f.key].sprite;
  if (spr && spr.complete){
    ctx.shadowColor = f.glow; ctx.shadowBlur = f.shiny||f.boss ? 26 : 16;
    ctx.drawImage(spr, -s*1.9, -s*1.2, s*3.8, s*2.4);
    ctx.shadowBlur = 0;
    // hit flash — quick white pulse over the fish
    if (f.hitFlash > 0){
      ctx.globalAlpha = Math.min(0.7, f.hitFlash*5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, 0, s*1.35, s*0.9, 0, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // hp bar for tougher fish
    if (f.maxHp > 3 && f.hp < f.maxHp){
      const wbar = s*1.9, hpf = f.hp/f.maxHp;
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(-wbar/2, -s*1.5, wbar, 5);
      ctx.fillStyle = hpf>0.5?'#39e6c4':hpf>0.25?'#ffce63':'#ff5d6c';
      ctx.fillRect(-wbar/2, -s*1.5, wbar*hpf, 5);
    }
    ctx.restore(); return;
  }

  const tail = Math.sin(f.wig)*0.5;
  ctx.shadowColor = f.glow;
  ctx.shadowBlur  = f.shiny||f.boss ? 30 : 16;

  // tail
  ctx.beginPath();
  ctx.moveTo(-s*0.85, 0);
  ctx.lineTo(-s*1.6, -s*0.65 + tail*s*0.4);
  ctx.lineTo(-s*1.35, 0);
  ctx.lineTo(-s*1.6,  s*0.65 + tail*s*0.4);
  ctx.closePath();
  ctx.fillStyle = f.color; ctx.fill();

  // body
  const bg = ctx.createLinearGradient(0,-s,0,s);
  bg.addColorStop(0, f.glow); bg.addColorStop(0.5, f.color); bg.addColorStop(1, f.color);
  ctx.beginPath();
  ctx.ellipse(0, 0, s*1.05, s*0.62, 0, 0, 6.28);
  ctx.fillStyle = bg; ctx.fill();

  // top fin
  ctx.beginPath();
  ctx.moveTo(-s*0.2,-s*0.5);
  ctx.quadraticCurveTo(0,-s*1.05, s*0.4,-s*0.45);
  ctx.closePath(); ctx.fillStyle = f.color; ctx.fill();

  // hit flash overlay
  if (f.hitFlash > 0){
    ctx.beginPath(); ctx.ellipse(0,0,s*1.1,s*0.66,0,0,6.28);
    ctx.fillStyle = `rgba(255,255,255,${f.hitFlash*5})`; ctx.fill();
  }

  ctx.shadowBlur = 0;
  // eye
  ctx.beginPath(); ctx.arc(s*0.55, -s*0.12, s*0.16, 0, 6.28);
  ctx.fillStyle = '#03161a'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*0.6, -s*0.16, s*0.06, 0, 6.28);
  ctx.fillStyle = '#fff'; ctx.fill();

  // angler lure
  if (f.hunter){
    ctx.beginPath(); ctx.moveTo(s*0.8,-s*0.35);
    ctx.quadraticCurveTo(s*1.5,-s*1.1, s*1.35,-s*1.3); ctx.strokeStyle=f.color;
    ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.arc(s*1.35,-s*1.35,s*0.18,0,6.28);
    ctx.fillStyle='#fff1c2'; ctx.shadowColor='#fff1c2'; ctx.shadowBlur=18; ctx.fill();
  }

  // hp pips for tougher fish
  if (f.maxHp > 3 && f.hp < f.maxHp){
    ctx.shadowBlur=0;
    const wbar = s*1.6, hpf = f.hp/f.maxHp;
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(-wbar/2, -s*1.05, wbar, 4);
    ctx.fillStyle = hpf>0.5?'#39e6c4':hpf>0.25?'#ffce63':'#ff5d6c';
    ctx.fillRect(-wbar/2, -s*1.05, wbar*hpf, 4);
  }
  ctx.restore();
}

function drawCannon(){
  let a;
  if (phase === 'playing'){
    a = Math.atan2(aim.y - cannon.y, aim.x - cannon.x);
  } else {
    a = -Math.PI/2 + Math.sin(cannonSway*0.6)*0.5;   // gentle sweep on menu
  }
  const bl = cannonReady ? CN_BARREL : cannon.len;
  const mx = cannon.x + Math.cos(a)*bl, my = cannon.y + Math.sin(a)*bl;

  // aim guide — from the muzzle, along the exact shot direction
  if (phase === 'playing'){
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#28e0c8'; ctx.lineWidth = 2; ctx.setLineDash([6,10]);
    ctx.beginPath(); ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.cos(a)*900, my + Math.sin(a)*900); ctx.stroke();
    ctx.restore();
  }

  // ── ludo.ai cannon sprite: barrel (up in image) rotated to aim ──
  if (cannonReady){
    ctx.save();
    ctx.translate(cannon.x, cannon.y);           // pivot = joint
    ctx.rotate(a + Math.PI/2);                    // barrel points exactly along the shot
    ctx.shadowColor = '#28e0c8'; ctx.shadowBlur = 14;
    ctx.drawImage(cannonImg, -CN_TW/2, -CN_JOINT*CN_TH, CN_TW, CN_TH);
    ctx.restore();
    return;
  }

  // vector barrel (fallback)
  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.rotate(a);
  ctx.shadowColor = '#28e0c8'; ctx.shadowBlur = 18;
  const bg = ctx.createLinearGradient(0,-9,0,9);
  bg.addColorStop(0,'#2bf0d6'); bg.addColorStop(1,'#0b6f66');
  ctx.fillStyle = bg;
  roundRect(0,-9, cannon.len, 18, 8); ctx.fill();
  ctx.restore();

  // base dome
  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.shadowColor='#28e0c8'; ctx.shadowBlur=24;
  const dg = ctx.createRadialGradient(0,0,4,0,0,40);
  dg.addColorStop(0,'#1be0c8'); dg.addColorStop(1,'#073c44');
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.arc(0,0,30,Math.PI,0); ctx.fill();
  ctx.restore();
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function render(time){
  ctx.save();
  // screen shake
  if (shake > 0) ctx.translate(rand(-shake,shake), rand(-shake,shake));

  // dive plunge: zoom punch toward the depths
  if (phase === 'dive'){
    const dp = clamp(diveT/DIVE_DUR,0,1);
    const z  = 1 + (1-(1-dp)*(1-dp))*0.22;
    ctx.translate(W/2, H*0.62); ctx.scale(z,z); ctx.translate(-W/2,-H*0.62);
  }

  drawBackground(time);

  // dive bubble curtain
  if (phase === 'dive' && diveStreaks.length){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for (const s of diveStreaks){
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#bdfaf0';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r*0.6, s.r*1.8, 0, 0, 6.28); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // rings (shockwaves)
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (const r of rings){
    ctx.globalAlpha = clamp(r.life*1.6,0,1);
    ctx.strokeStyle = r.c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,6.28); ctx.stroke();
  }
  ctx.restore();

  fish.forEach(drawFish);

  // bullets
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (const b of bullets){
    for (let i=0;i<b.trail.length;i++){
      const tpt=b.trail[i], al=i/b.trail.length*0.5;
      ctx.globalAlpha=al; ctx.fillStyle='#aef9ec';
      ctx.beginPath(); ctx.arc(tpt.x,tpt.y,b.r*0.7,0,6.28); ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.shadowColor='#aef9ec'; ctx.shadowBlur=14;
    const bgr=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,b.r*1.6);
    bgr.addColorStop(0,'#ffffff'); bgr.addColorStop(0.5,'#7ff0dd'); bgr.addColorStop(1,'rgba(40,224,200,0)');
    ctx.fillStyle=bgr;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r*1.6,0,6.28); ctx.fill();
  }
  ctx.restore();

  // particles
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (const p of particles){
    ctx.globalAlpha = clamp(p.life/p.max,0,1);
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill();
  }
  ctx.restore();

  drawCannon();

  // score popups
  for (const p of pops){
    ctx.globalAlpha = clamp(p.life/p.max,0,1);
    ctx.fillStyle = p.c; ctx.textAlign='center';
    ctx.font = `900 ${p.big?30:20}px ${'Segoe UI,system-ui,sans-serif'}`;
    ctx.shadowColor=p.c; ctx.shadowBlur=12;
    ctx.fillText(p.txt, p.x, p.y);
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;

  ctx.restore();

  // vignette + impact flash (screen-space, no shake)
  const vg = ctx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.85);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  if (flash > 0){
    ctx.globalAlpha = flash*0.5; ctx.fillStyle = flashColor;
    ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1;
  }
}

// ── loop ─────────────────────────────────────────────────────────
let last = performance.now();
function loop(now){
  const dt = Math.min((now-last)/1000, 0.05);
  last = now;
  if (phase === 'boot')        updateBoot(dt);
  else if (phase === 'dive')   updateDive(dt);
  else if (phase === 'playing' && running) update(dt);
  else                         updateAmbient(dt);   // menu / over
  render(now);
  requestAnimationFrame(loop);
}
seedAmbient();
requestAnimationFrame(loop);

// ── start / end ──────────────────────────────────────────────────
function startGame(){
  fish=[]; bullets=[]; particles=[]; pops=[]; rings=[];
  score=0; credits=START_CREDITS; timeLeft=ROUND_TIME;
  combo=1; comboKills=0; comboTimer=0; spawnTimer=0; elapsed=0;
  shake=0; flash=0; wpnLevel=1; firing=false;
  stats = { shots:0, hits:0, kills:0, bestCombo:1, biggest:'—', biggestVal:0, coins:0 };
  setWpn(1); updateHUD();
  document.getElementById('hud-combo').textContent='x1';
  document.getElementById('combo-block').classList.remove('live');
  document.getElementById('overlay-start').classList.add('hidden');
  document.getElementById('overlay-end').classList.add('hidden');
  for (let i=0;i<5;i++) spawnFish(false);
  phase = 'playing';
  running = true;
  document.body.classList.add('playing');
  initAudio();
}

// quit current run (esp. Free Hunt / training) back to the menu
function exitToMenu(){
  running = false; firing = false; phase = 'menu';
  document.body.classList.remove('playing');
  fish = []; bullets = []; particles = []; pops = []; rings = [];
  seedAmbient();
  document.getElementById('start-best').textContent = ls(K.best);
  document.getElementById('overlay-end').classList.add('hidden');
  document.getElementById('overlay-start').classList.remove('hidden');
}

function endGame(){
  running = false; firing = false; phase = 'over';
  document.body.classList.remove('playing');
  // persist
  const prevBest = ls(K.best);
  const isPB = score > prevBest;
  if (isPB) lsS(K.best, score);
  lsS(K.games, ls(K.games)+1);
  lsS(K.coins, ls(K.coins)+stats.coins);
  if (stats.bestCombo > ls(K.bigCombo)) lsS(K.bigCombo, stats.bestCombo);
  if (mode==='tournament') saveLeaderboard(score);

  // fill end screen
  document.getElementById('end-score').textContent  = score;
  document.getElementById('end-biggest').textContent = stats.biggest;
  const pbEl = document.getElementById('end-pb');
  pbEl.innerHTML = isPB
    ? '<span class="end-pb-hit">★ NEW PERSONAL BEST ★</span>'
    : `Personal best: <strong>${Math.max(prevBest,score)}</strong>`;
  const acc = stats.shots ? Math.round(stats.hits/stats.shots*100) : 0;
  document.getElementById('end-stats').innerHTML = `
    <div class="es"><b>${stats.kills}</b><span>CATCHES</span></div>
    <div class="es"><b>${acc}%</b><span>ACCURACY</span></div>
    <div class="es"><b>x${stats.bestCombo}</b><span>BEST COMBO</span></div>
    <div class="es"><b>${stats.coins}</b><span>CREDITS</span></div>`;
  document.getElementById('overlay-end').classList.remove('hidden');
}

function saveLeaderboard(sc){
  let lb = [];
  try { lb = JSON.parse(localStorage.getItem(K.lb) || '[]'); } catch(e){ lb=[]; }
  lb.push({ name:NICK, score:sc });
  lb.sort((a,b)=>b.score-a.score);
  lb = lb.slice(0,10);
  localStorage.setItem(K.lb, JSON.stringify(lb));
}

// ── overlay wiring ───────────────────────────────────────────────
document.getElementById('start-best').textContent = ls(K.best);
document.querySelectorAll('#ov-mode .mode-btn').forEach(btn=>{
  btn.onclick = () => {
    document.querySelectorAll('#ov-mode .mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); mode = btn.dataset.mode;
  };
});
document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-again').onclick = () => {
  document.getElementById('start-best').textContent = ls(K.best);
  startGame();
};
document.getElementById('exit-btn').onclick = exitToMenu;
document.getElementById('mute-btn').onclick = toggleMute;
