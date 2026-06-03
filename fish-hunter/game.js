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
  fry    : { hp:1,  value:3,   size:11, speed:215, color:'#7fe0d0', glow:'#cffaf0', weight:24, coins:1, spriteFrom:'minnow' },
  darter : { hp:2,  value:12,  size:22, speed:135, color:'#4aa8ff', glow:'#bfe2ff', weight:28, coins:2 },
  ray    : { hp:4,  value:30,  size:34, speed:88,  color:'#b07bff', glow:'#e4d2ff', weight:18, coins:5 },
  angler : { hp:6,  value:70,  size:30, speed:110, color:'#ff7a59', glow:'#ffd2b0', weight:9,  coins:11, hunter:true },
  golden : { hp:9,  value:140, size:30, speed:160, color:'#ffce63', glow:'#fff1c2', weight:4,  coins:24, shiny:true },
  levia  : { hp:22, value:320, size:64, speed:55,  color:'#ffb13d', glow:'#ffe7a8', weight:1,  coins:60, boss:true },
  jackpot: { hp:24, value:1000,size:74, speed:80,  color:'#ffce63', glow:'#fff1c2', weight:0,  coins:200, jackpot:true },
};
const TYPE_KEYS = Object.keys(FISH_TYPES);
const TOTAL_WEIGHT = TYPE_KEYS.reduce((s,k)=>s+FISH_TYPES[k].weight,0);

// optional ludo.ai fish art: assets/fish-<key>.png auto-loads into each type
TYPE_KEYS.forEach(k => {
  if (FISH_TYPES[k].spriteFrom) return;
  const img = new Image();
  img.onload = () => { FISH_TYPES[k].sprite = img; };
  img.src = `assets/fish-${k}.png`;
});

function pickType(elapsedFrac){
  // late game biases toward richer targets
  let roll = srand() * TOTAL_WEIGHT;
  for (const k of TYPE_KEYS){
    let w = FISH_TYPES[k].weight;
    if (elapsedFrac > 0.25 && FISH_TYPES[k].value >= 30) w *= 1.55;
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
let creditsShown = START_CREDITS;
let score = 0, timeLeft = ROUND_TIME, shake = 0, flash = 0, flashColor = '#28e0c8';
let combo = 1, comboTimer = 0, comboKills = 0;
let spawnTimer = 0, elapsed = 0;
let hitStop = 0;
let coinsFx = [];
let waves = [];
let zoomPunch = 0, zx = 0, zy = 0;
let powerups = [], puTimer = 7;
let jackpotTimer = 32;
let freezeT = 0, doubleT = 0, multiT = 0;
const POWERUPS = {
  freeze: { icon:'F',  color:'#7fd4ff', label:'FREEZE' },
  frenzy: { icon:'x2', color:'#ffce63', label:'FRENZY' },
  multi:  { icon:'M',  color:'#28e0c8', label:'MULTI'  },
  bomb:   { icon:'B',  color:'#ff5d6c', label:'BOMB'   },
};
const PU_KEYS = ['freeze','frenzy','multi','bomb'];
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
const DIVE_DUR = 2.3;           // seconds of the plunge
let diveStreaks = [];
let descent = 0;
let bgFish = [];
let lurker = null, lurkerTimer = 16;            // fast rising bubbles during the dive

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
cannonImg.onload = () => { cannonReady = true; makeTintedCannons(); };
cannonImg.src = 'assets/cannon.png';

// ===== CANNON SKINS =====
const SKINS = [
  { id:0, name:'STANDARD', file:'assets/cannon.png',   bullet:'#7ff0dd', cost:0,    tint:null },
  { id:1, name:'GOLD',     file:'assets/cannon-2.png', bullet:'#ffce63', cost:250,  tint:'#ffce63' },
  { id:2, name:'CRIMSON',  file:'assets/cannon-3.png', bullet:'#ff5d6c', cost:500,  tint:'#ff5d6c' },
  { id:3, name:'VIOLET',   file:'assets/cannon-4.png', bullet:'#b07bff', cost:850,  tint:'#b07bff' },
  { id:4, name:'EMERALD',  file:'assets/cannon-5.png', bullet:'#39e6c4', cost:1200, tint:'#39e6c4' },
];
let skinId = parseInt(localStorage.getItem('fishhunter_skin')||'0',10) || 0;
SKINS.forEach(sk => { sk.img=null; sk.tintImg=null; if(sk.id===0) return; const im=new Image(); im.onload=()=>{ sk.img=im; }; im.src=sk.file; });
function makeTintedCannons(){
  if (!cannonReady) return;
  for (const sk of SKINS){
    if (!sk.tint){ sk.tintImg = cannonImg; continue; }
    const oc=document.createElement('canvas'); oc.width=cannonImg.naturalWidth; oc.height=cannonImg.naturalHeight;
    const x=oc.getContext('2d');
    x.drawImage(cannonImg,0,0);
    x.globalCompositeOperation='color'; x.fillStyle=sk.tint; x.fillRect(0,0,oc.width,oc.height);
    x.globalCompositeOperation='destination-in'; x.drawImage(cannonImg,0,0);
    sk.tintImg = oc;
  }
}
function currentCannonImg(){ const sk=SKINS[skinId]||SKINS[0]; if (sk.img&&sk.img.complete&&sk.img.naturalWidth) return sk.img; if (sk.tintImg) return sk.tintImg; return cannonReady?cannonImg:null; }
function currentBulletColor(){ return (SKINS[skinId]||SKINS[0]).bullet; }
function shopOwned(){ try{ return new Set(JSON.parse(localStorage.getItem('fishhunter_skins_owned')||'[0]')); }catch(e){ return new Set([0]); } }
function shopAvail(){ return Math.max(0, ls(K.coins) - ls('fishhunter_spent')); }
function renderShop(){
  const grid=document.getElementById('shop-grid'); if(!grid) return;
  const wEl=document.getElementById('shop-wallet'); if(wEl) wEl.textContent=formatNum(shopAvail());
  const owned=shopOwned(); grid.innerHTML='';
  SKINS.forEach(sk=>{
    const cell=document.createElement('div'); cell.className='shop-cell'+(sk.id===skinId?' sel':'');
    const cv=document.createElement('canvas'); cv.width=cv.height=72; cv.className='shop-prev'; const xx=cv.getContext('2d');
    const img=(sk.img&&sk.img.complete&&sk.img.naturalWidth)?sk.img:(sk.tintImg||(cannonReady?cannonImg:null));
    if(img){ const r=(img.width/img.height)||0.75; let w,h; if(r>1){w=66;h=66/r;}else{h=66;w=66*r;} xx.drawImage(img,(72-w)/2,(72-h)/2,w,h); }
    cell.appendChild(cv);
    const nm=document.createElement('div'); nm.className='shop-nm'; nm.style.color=sk.tint||'#28e0c8'; nm.textContent=sk.name; cell.appendChild(nm);
    const btn=document.createElement('button'); btn.className='shop-btn';
    if(sk.id===skinId){ btn.textContent='SELECTED'; btn.disabled=true; }
    else if(owned.has(sk.id)){ btn.textContent='SELECT'; btn.onclick=()=>{ skinId=sk.id; localStorage.setItem('fishhunter_skin',String(sk.id)); renderShop(); }; }
    else if(shopAvail()>=sk.cost){ btn.textContent='BUY '+sk.cost; btn.onclick=()=>{ localStorage.setItem('fishhunter_spent',String(ls('fishhunter_spent')+sk.cost)); owned.add(sk.id); localStorage.setItem('fishhunter_skins_owned',JSON.stringify([...owned])); skinId=sk.id; localStorage.setItem('fishhunter_skin',String(sk.id)); try{initAudio();sfxJackpot();}catch(e){} renderShop(); }; }
    else { btn.textContent='LOCKED '+sk.cost; btn.disabled=true; btn.classList.add('locked'); }
    cell.appendChild(btn); grid.appendChild(cell);
  });
}

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
function sfxPower(){ blip({freq:520,type:'sine',dur:0.5,vol:0.16,slideTo:1300}); blip({freq:800,type:'triangle',dur:0.4,vol:0.1,slideTo:1700}); }
function sfxJackpot(){ [523,659,784,1046,1318].forEach((fr,i)=>setTimeout(()=>blip({freq:fr,type:'sine',dur:0.45,vol:0.16,slideTo:fr*1.4}), i*90)); noiseBurst({dur:0.5,vol:0.18,freq:1200,type:'highpass'}); }
function toggleMute(){
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
  const b = document.getElementById('mute-btn'); if (b) b.textContent = muted ? '🔇' : '🔊';
}

// ── helpers ──────────────────────────────────────────────────────
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const formatNum = n => Number(n).toLocaleString('en-US');
function _lerp(a,b,t){return a+(b-a)*t;}
function _mix(c1,c2,t){return 'rgb('+Math.round(_lerp(c1[0],c2[0],t))+','+Math.round(_lerp(c1[1],c2[1],t))+','+Math.round(_lerp(c1[2],c2[2],t))+')';}

// seeded RNG (mulberry32) — same seed => identical fish for everyone (FAIR rounds)
let _rngS = 1;
function setSeed(s){ _rngS = (s >>> 0) || 1; }
function srand(){
  _rngS |= 0; _rngS = (_rngS + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngS ^ (_rngS >>> 15), 1 | _rngS);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const srange = (a,b) => a + srand()*(b-a);
function dailySeed(){ const d = new Date(); return d.getUTCFullYear()*10000 + (d.getUTCMonth()+1)*100 + d.getUTCDate(); }
function weekId(){ return Math.floor(Date.now()/(7*86400000)); }
let matchSeed = 0;   // the seed used by the current run (shown to player)

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
  let pellets = wpnLevel >= 4 ? 3 : wpnLevel >= 2 ? 2 : 1;
  if (multiT > 0) pellets = Math.max(pellets, 5);
  const spread  = pellets > 1 ? (multiT>0?0.12:0.06) : 0;
  for (let i=0;i<pellets;i++){
    const off = pellets>1 ? (i-(pellets-1)/2)*spread : 0;
    bullets.push({
      x:muzzleX, y:muzzleY,
      vx:Math.cos(a+off)*speed, vy:Math.sin(a+off)*speed,
      dmg: wpnLevel, r: 4+wpnLevel, life: 1.4, trail: [], color: currentBulletColor(),
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
  const m = t.size*2.2, edge = (srand()*4)|0;
  let x,y;
  if (edge===0){ x=-m; y=srange(H*0.05,H*0.95); }
  else if (edge===1){ x=W+m; y=srange(H*0.05,H*0.95); }
  else if (edge===2){ x=srange(W*0.05,W*0.95); y=-m; }
  else { x=srange(W*0.05,W*0.95); y=H+m; }
  const aimX=srange(W*0.2,W*0.8), aimY=srange(H*0.2,H*0.8);
  let dx=aimX-x, dy=aimY-y; const len=Math.hypot(dx,dy)||1;
  const sp = t.speed * srange(0.85,1.15);
  const vx=dx/len*sp, vy=dy/len*sp;
  const f = { key, ...t, maxHp:t.hp, size: t.size*srange(0.82,1.22), x, y, vx, vy, baseY:y,
    freq:srange(0.6,1.6), phase:srand()*6.28, t:0, wig:srand()*6.28, hitFlash:0 };
  fish.push(f);
  if (forceSchool && (key==='minnow'||key==='darter'||key==='fry')){
    const n = key==='fry'?8:key==='minnow'?5:3, ux=vx/sp, uy=vy/sp;
    for (let i=1;i<=n;i++){
      fish.push({ ...f, x:x-ux*i*t.size*2.4, y:y-uy*i*t.size*2.4, phase:srand()*6.28, wig:srand()*6.28 });
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
  f.hp -= dmg; f.hitFlash = 0.18;
  stats.hits++;
  sfxHit();
  for (let i=0;i<9;i++){ const a=Math.random()*6.28, sp=rand(70,240);
    particles.push({ x:bx, y:by, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:rand(1,2.8), life:rand(.18,.38), max:.38, c: Math.random()<0.45?'#ffffff':f.glow }); }
  particles.push({ x:bx, y:by, vx:0, vy:0, r:f.size*0.45, life:.1, max:.1, c:'#ffffff' });
  if (f.hp <= 0) killFish(f);
}

function killFish(f){
  const mult = doubleT > 0 ? 2 : 1;
  const gained = Math.round(f.value * combo) * mult;
  score += gained;
  credits += f.coins * mult;
  stats.kills++; stats.coins += f.coins;
  sfxKill(f.boss || f.shiny); sfxCoin();
  if (f.value > stats.biggestVal){ stats.biggestVal = f.value; stats.biggest = labelFor(f.key); }
  addKillCombo();

  // explosion particles
  const n = f.boss ? 38 : f.value>=70 ? 24 : f.value>=30 ? 16 : 9;
  for (let i=0;i<n;i++){
    const a = Math.random()*6.28, sp = rand(40, f.boss?420:240);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      r:rand(1.5,4.5), life:rand(.4,.9), max:.9,
      c: Math.random()<0.5 ? f.color : f.glow });
  }
  // gold coin sparkle burst
  for (let i=0;i<Math.min(f.coins,6);i++){
    const a=Math.random()*6.28, sp=rand(60,200);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60,
      r:rand(1.5,3), life:rand(.5,1), max:1, c:'#ffce63', grav:280 });
  }
  // shockwave ring
  rings.push({ x:f.x, y:f.y, r:f.size, max:f.size*(f.boss?6:3.4), life:.5, c:f.glow });
  // score popup
  pops.push({ x:f.x, y:f.y, txt:'+'+gained, life:.9, max:.9,
    c: combo>1 ? '#ffce63' : '#aef9ec', big:f.boss||f.shiny||f.value>=70 });
  // extra juice: core flash, shards, second shockwave
  const big = f.boss || f.value >= 30;
  particles.push({ x:f.x, y:f.y, vx:0, vy:0, r:f.size*(f.boss?2.6:1.6), life:.18, max:.18, c:'#ffffff' });
  for (let i=0;i<(f.boss?16:big?8:4);i++){
    const a=Math.random()*6.28, sp=rand(160, f.boss?620:360);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      r:rand(1,2.4), life:rand(.25,.5), max:.5, c:f.glow, grav:120 });
  }
  rings.push({ x:f.x, y:f.y, r:f.size*0.4, max:f.size*(f.boss?9:5), life:.7, c:'#ffffff' });
  shake = Math.min(shake + (f.boss?18:f.value>=70?11:f.value>=30?7:3), 24);
  if (big){ flash = f.boss?0.55:0.38; flashColor = f.glow; hitStop = f.boss?0.09:0.05; }
  spawnCoinFx(f.x, f.y, Math.min(f.coins, f.boss?16:6));
  for (let i=0;i<4;i++){ const a=Math.random()*6.28, dd=rand(10,f.size*1.8);
    particles.push({ x:f.x+Math.cos(a)*dd, y:f.y+Math.sin(a)*dd, vx:0,vy:0, r:rand(2,4), life:rand(.3,.6), max:.6, c:'#fff7d0', star:true }); }
  waves.push({x:f.x,y:f.y,r:f.size*0.4,max:f.size*3 + f.value*2.2,life:big?.6:.42,maxLife:big?.6:.42});
  if (f.boss){ zoomPunch = 0.28; zx = f.x; zy = f.y; }
  if (f.jackpot) jackpotWin();

  fish.splice(fish.indexOf(f), 1);
  updateHUD();
}

const coinImg = new Image(); let coinReady=false;
coinImg.onload=()=>{ coinReady=true; }; coinImg.src='assets/coin.png';
function drawCoin(x,y,r,spin){
  const sx = Math.max(0.14, Math.abs(Math.cos(spin)));
  ctx.save(); ctx.translate(x,y); ctx.scale(sx,1);
  if (coinReady){ ctx.drawImage(coinImg, -r, -r, r*2, r*2); ctx.restore(); return; }
  const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.15,0,0,r);
  g.addColorStop(0,'#fff0bf'); g.addColorStop(0.5,'#ffce63'); g.addColorStop(1,'#dd9418');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,6.28); ctx.fill();
  ctx.strokeStyle='#b8801a'; ctx.lineWidth=r*0.13; ctx.beginPath(); ctx.arc(0,0,r*0.9,0,6.28); ctx.stroke();
  ctx.fillStyle='#9a6b12';
  ctx.beginPath(); ctx.ellipse(r*0.06,0,r*0.4,r*0.22,0,0,6.28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-r*0.32,0); ctx.lineTo(-r*0.6,-r*0.2); ctx.lineTo(-r*0.6,r*0.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r*0.08,-r*0.16); ctx.quadraticCurveTo(r*0.28,-r*0.42,r*0.36,-r*0.14); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#5a3d08'; ctx.beginPath(); ctx.arc(r*0.32,-r*0.05,r*0.05,0,6.28); ctx.fill();
  ctx.restore();
}
function spawnCoinFx(x,y,n){
  for (let i=0;i<n;i++)
    coinsFx.push({ x:x+rand(-16,16), y:y+rand(-16,16), vx:rand(-150,150), vy:rand(-340,-160),
      state:'fall', t:0, spin:Math.random()*6.28, spinV:rand(6,11)*(Math.random()<0.5?1:-1),
      r:rand(15,20), groundY:H-rand(24,90), delay:i*0.04, tx:0, ty:0 });
}
function updateFx(dt){
  updateBgLife(dt);
  creditsShown += (credits - creditsShown) * Math.min(1, dt*3.5);
  if (Math.abs(credits - creditsShown) < 1) creditsShown = credits;
  { const _e=document.getElementById('hud-credits'); if(_e) _e.textContent = Math.max(0,Math.round(creditsShown)); }
  for (const c of coinsFx){
    if (c.delay>0){ c.delay-=dt; continue; }
    c.t += dt; c.spin += c.spinV*dt;
    if (c.state==='fall'){
      c.vy += 1100*dt; c.x += c.vx*dt; c.y += c.vy*dt; c.vx *= 0.985;
      if (c.y >= c.groundY){ c.y=c.groundY; c.vy*=-0.32; c.vx*=0.55; c.spinV*=0.72;
        if (Math.abs(c.vy)<70){ c.state='rest'; c.t=0; } }
    } else if (c.state==='rest'){
      if (c.t > 0.45){
        const el=document.getElementById('hud-credits');
        if (el){ const r=el.getBoundingClientRect(); c.tx=r.left+r.width/2; c.ty=r.top+r.height/2; }
        else { c.tx=W*0.13; c.ty=46; }
        c.state='fly'; c.t=0;
      }
    } else {
      const pull=Math.min(1, dt*(3.5 + c.t*11));
      c.x += (c.tx-c.x)*pull; c.y += (c.ty-c.y)*pull; c.r *= (1 - dt*1.1);
      if (Math.hypot(c.tx-c.x, c.ty-c.y) < 22 || c.r < 5){ c._done=true; coinPop(); }
    }
  }
  coinsFx = coinsFx.filter(c => !c._done);
  for (const w of waves) w.life -= dt;
  waves = waves.filter(w => w.life > 0);
  if (zoomPunch > 0) zoomPunch = Math.max(0, zoomPunch - dt*1.4);
  if (shake > 0) shake = Math.max(0, shake - dt*40);
  if (flash > 0) flash = Math.max(0, flash - dt*1.4);
}
function coinPop(){
  const el = document.getElementById('hud-credits');
  if (el){ el.classList.remove('coin-pop'); void el.offsetWidth; el.classList.add('coin-pop'); }
}

function spawnJackpot(){
  const t = FISH_TYPES.jackpot;
  const fromLeft = srand() < 0.5;
  const y = srange(H*0.2, H*0.55);
  fish.push({ key:'jackpot', ...t, maxHp:t.hp, jackpot:true,
    x: fromLeft?-t.size*2:W+t.size*2, y, baseY:y, vx:(fromLeft?1:-1)*t.speed,
    amp:srange(14,28), freq:srange(0.4,0.8), phase:srand()*6.28, t:0, dir:fromLeft?1:-1, wig:srand()*6.28, hitFlash:0 });
}
function jackpotWin(){
  flash = 0.85; flashColor = '#ffce63'; shake = 16; hitStop = 0.12;
  spawnCoinFx(W/2, H*0.4, 40);
  for (let i=0;i<70;i++){ const a=Math.random()*6.28, sp=rand(80,520);
    particles.push({ x:W/2, y:H*0.4, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:rand(2,5), life:rand(.7,1.5), max:1.5, c: Math.random()<0.5?'#ffce63':'#fff1c2', grav:200 }); }
  rings.push({ x:W/2, y:H*0.4, r:20, max:Math.max(W,H), life:.7, c:'#ffce63' });
  pops.push({ x:W/2, y:H*0.42, txt:'JACKPOT!', life:2.2, max:2.2, c:'#ffce63', big:true, huge:true });
  sfxJackpot();
}

function spawnPowerup(){
  const key = PU_KEYS[(srand()*PU_KEYS.length)|0];
  const fromLeft = srand() < 0.5;
  const y = srange(H*0.18, H*0.62);
  powerups.push({ key, x: fromLeft?-30:W+30, y, baseY:y, vx:(fromLeft?1:-1)*srange(48,78), t:0, phase:srand()*6.28, r:19 });
}
function activatePowerup(pu){
  const cfg = POWERUPS[pu.key];
  if (pu.key==='freeze') freezeT = 4.5;
  else if (pu.key==='frenzy') doubleT = 7;
  else if (pu.key==='multi') multiT = 7;
  else if (pu.key==='bomb'){ for (const f of [...fish]) hurtFish(f, 999, f.x, f.y); shake = 22; }
  flash = Math.max(flash, 0.45); flashColor = cfg.color;
  rings.push({ x:pu.x, y:pu.y, r:10, max:Math.max(W,H), life:.5, c:cfg.color });
  pops.push({ x:pu.x, y:pu.y, txt:cfg.label+'!', life:1.2, max:1.2, c:cfg.color, big:true });
  sfxPower();
  const i = powerups.indexOf(pu); if (i>=0) powerups.splice(i,1);
}

function labelFor(k){
  return { minnow:'Minnow', darter:'Darter', ray:'Manta Ray',
    angler:'Angler', golden:'Golden Koi', levia:'Leviathan' }[k] || k;
}

// ── HUD ──────────────────────────────────────────────────────────
function updateHUD(){
  document.getElementById('hud-score').textContent   = score;
  document.getElementById('hud-credits').textContent = Math.max(0,Math.round(creditsShown));
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
  shake = 0;
}
function updateDive(dt){
  diveT += dt;
  { const p = clamp(diveT/DIVE_DUR,0,1); descent = p<0.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2; }
  updateAmbient(dt);
  for (const s of diveStreaks){
    s.y -= s.spd*dt; s.x += s.wob*dt;
  }
  diveStreaks = diveStreaks.filter(s => s.y > -20);
  if (diveT >= DIVE_DUR) revealMenu();
}

// populate the lobby menu: logo, daily challenge, your stats, leaderboard
function todayStr(){ const d=new Date(); return d.getUTCFullYear()+'-'+(d.getUTCMonth()+1)+'-'+d.getUTCDate(); }
function dailyState(){ const last=localStorage.getItem('fishhunter_last_claim')||''; const streak=parseInt(localStorage.getItem('fishhunter_streak')||'0',10); return {claimed:last===todayStr(), last, streak}; }
function pendingStreak(st){ const y=new Date(Date.now()-86400000); const ys=y.getUTCFullYear()+'-'+(y.getUTCMonth()+1)+'-'+y.getUTCDate(); return st.last===ys ? st.streak+1 : 1; }
function claimDaily(){ const st=dailyState(); if(st.claimed) return; const streak=pendingStreak(st); const reward=Math.min(500,50+(streak-1)*25);
  lsS(K.coins, ls(K.coins)+reward); localStorage.setItem('fishhunter_last_claim', todayStr()); localStorage.setItem('fishhunter_streak', String(streak));
  initAudio(); sfxJackpot(); renderDaily();
  const el=document.getElementById('soon-msg'); if(el){ el.textContent='+'+reward+' credits!  Day '+streak+' streak'; el.classList.add('show'); clearTimeout(claimDaily._t); claimDaily._t=setTimeout(()=>el.classList.remove('show'),2600); } }
function renderDaily(){ const box=document.getElementById('daily-reward'); if(!box) return; const st=dailyState();
  if(st.claimed){ box.innerHTML='<div class="dr-done">Daily claimed - Day '+st.streak+' streak. Back tomorrow!</div>'; }
  else { const streak=pendingStreak(st); const reward=Math.min(500,50+(streak-1)*25);
    box.innerHTML='<button class="dr-claim" id="dr-claim">CLAIM DAILY  +'+reward+'  (Day '+streak+')</button>';
    const b=document.getElementById('dr-claim'); if(b) b.onclick=claimDaily; } }
function celebrate(){ const card=document.querySelector('#overlay-end .ov-card'); if(!card) return;
  let wrap=card.querySelector('.confetti-wrap'); if(!wrap){ wrap=document.createElement('div'); wrap.className='confetti-wrap'; card.appendChild(wrap); } wrap.innerHTML='';
  const cols=['#ffce63','#28e0c8','#ff7a59','#b07bff','#ffffff'];
  for(let i=0;i<44;i++){ const c=document.createElement('div'); c.className='confetti'; c.style.left=(Math.random()*100)+'%'; c.style.background=cols[(Math.random()*cols.length)|0]; c.style.animationDuration=(1.4+Math.random()*1.6)+'s'; c.style.animationDelay=(Math.random()*0.5)+'s'; wrap.appendChild(c); }
  setTimeout(()=>{ if(wrap) wrap.innerHTML=''; }, 4000); }

function renderMenu(){
  if (logoImg.complete && logoImg.naturalWidth > 0){
    const li = document.getElementById('menu-logo-img');
    const lt = document.getElementById('menu-logo-text');
    if (li){ li.src = logoImg.src; li.style.display = 'block'; }
    if (lt) lt.style.display = 'none';
  }
  const md = document.getElementById('menu-daily');
  if (md) md.textContent = `DAILY CHALLENGE #${dailySeed()}  -  same fish for all`;
  renderDaily();
  const ml = document.getElementById('menu-lb');
  if (ml){
    const wk = weekId();
    let wl = []; try { wl = JSON.parse(localStorage.getItem('fishhunter_lb_weekly') || '[]'); } catch(e){}
    wl = wl.filter(e => e.wk === wk).sort((a,b)=>b.score-a.score);
    ml.innerHTML = wl.length
      ? wl.slice(0,8).map((e,i) =>
          `<div class="lb-row${e.name===NICK?' me':''}"><span class="lb-rk">${i+1}</span><span class="lb-nm">${e.name}</span><span class="lb-sc">${formatNum(e.score)}</span></div>`
        ).join('')
      : '<div class="lb-empty">No scores yet this week - be the first!</div>';
  }
}

function revealMenu(){
  phase = 'menu'; shake = 0; flash = 0; zoomPunch = 0; descent = 1;
  const boot = document.getElementById('overlay-boot');
  boot.classList.add('fade');
  diveStreaks = [];
  renderMenu();
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
  const interval = clamp(0.66 - frac*0.4, 0.26, 0.66);
  if (spawnTimer <= 0){
    spawnFish(srand() < 0.45);
    if (srand() < 0.4) spawnFish(srand() < 0.3);
    spawnTimer = interval * srange(0.7,1.3);
  }
  if (fish.length < 8) spawnFish(srand()<0.5); // keep the sea busy
  puTimer -= dt;
  if (puTimer <= 0){ spawnPowerup(); puTimer = srange(9, 15); }
  for (const pu of powerups){ pu.t += dt; pu.x += pu.vx*dt; pu.y = pu.baseY + Math.sin(pu.t*1.5 + pu.phase)*14;
    if (pu.x < -50 || pu.x > W+50) pu._gone = true; }
  powerups = powerups.filter(pu => !pu._gone);
  jackpotTimer -= dt;
  if (jackpotTimer <= 0){ spawnJackpot(); jackpotTimer = srange(40, 70); }
  if (freezeT>0) freezeT -= dt; if (doubleT>0) doubleT -= dt; if (multiT>0) multiT -= dt;

  decayCombo(dt);

  // fish motion -- straight-line travel in any direction
  const tscale = freezeT > 0 ? 0.12 : 1;
  for (const f of fish){
    f.t += dt*tscale; f.wig += dt*8*tscale;
    f.x += f.vx * dt * tscale;
    f.y += (f.vy||0) * dt * tscale;
    if (f.hitFlash > 0) f.hitFlash -= dt;
    const mg = f.size*3;
    if (f.x<-mg || f.x>W+mg || f.y<-mg || f.y>H+mg) f._gone = true;
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
    if (b.life>0) for (const pu of powerups){
      const dx=pu.x-b.x, dy=pu.y-b.y;
      if (dx*dx+dy*dy < (pu.r+b.r+6)*(pu.r+b.r+6)){ activatePowerup(pu); b.life=0; break; }
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

  // shake & flash decay handled in updateFx (runs every phase)
}

// ════════════════════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════════════════════
function spawnBgFish(){
  const fromLeft = Math.random()<0.5; const y = rand(H*0.18, H*0.85);
  bgFish.push({ x: fromLeft?-40:W+40, baseY:y, y, vx:(fromLeft?1:-1)*rand(14,28), size:rand(14,30),
    dir:fromLeft?1:-1, phase:Math.random()*6.28, t:0, amp:rand(4,12), freq:rand(.6,1.2), a:rand(0.07,0.16) });
}
function spawnLurker(){
  const fromLeft = Math.random()<0.5;
  lurker = { x: fromLeft? W*0.2 : W*0.8, y: rand(H*0.5, H*0.78), vx:(fromLeft?1:-1)*rand(12,22),
    dir:fromLeft?1:-1, size:rand(150,215), t:0, dur:rand(8,12) };
}
function updateBgLife(dt){
  if (descent < 0.99) return;
  for (const f of bgFish){ f.t+=dt; f.x+=f.vx*dt; f.y = f.baseY + Math.sin(f.t*f.freq+f.phase)*f.amp; }
  bgFish = bgFish.filter(f => f.x>-70 && f.x<W+70);
  while (bgFish.length < 5) spawnBgFish();
  if (lurker){ lurker.t+=dt; lurker.x+=lurker.vx*dt; if (lurker.t>lurker.dur) lurker=null; }
  else { lurkerTimer-=dt; if (lurkerTimer<=0){ spawnLurker(); lurkerTimer = rand(26,46); } }
}
function drawBgLife(){
  if (descent < 0.99) return;
  for (const f of bgFish){
    ctx.save(); ctx.translate(f.x, f.y); if (f.dir<0) ctx.scale(-1,1);
    ctx.globalAlpha = f.a; ctx.fillStyle = '#00060c';
    ctx.beginPath(); ctx.ellipse(0,0,f.size,f.size*0.42,0,0,6.28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-f.size*0.8,0); ctx.lineTo(-f.size*1.5,-f.size*0.42); ctx.lineTo(-f.size*1.5,f.size*0.42); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (lurker){
    const L=lurker;
    const vis = Math.min(clamp(L.t/1.6,0,1), clamp((L.dur-L.t)/1.6,0,1));
    const breathe = 0.5+0.5*Math.sin(L.t*1.1);
    ctx.save(); ctx.translate(L.x, L.y); if (L.dir<0) ctx.scale(-1,1);
    ctx.globalAlpha = 0.22*vis;
    const bgg = ctx.createRadialGradient(0,0,L.size*0.25,0,0,L.size*1.5);
    bgg.addColorStop(0,'rgba(0,2,6,1)'); bgg.addColorStop(1,'rgba(0,2,6,0)');
    ctx.fillStyle = bgg; ctx.beginPath(); ctx.ellipse(0,0,L.size*1.4,L.size*0.72,0,0,6.28); ctx.fill();
    ctx.globalAlpha = 0.32*vis; ctx.fillStyle='rgba(0,3,9,1)';
    ctx.beginPath(); ctx.ellipse(0,0,L.size,L.size*0.5,0,0,6.28); ctx.fill();
    ctx.globalAlpha = (0.78+0.22*breathe)*vis;
    ctx.shadowColor='#ff1818'; ctx.shadowBlur=26; ctx.fillStyle='#ff3030';
    const er = L.size*0.05 + breathe*2;
    ctx.beginPath(); ctx.arc(L.size*0.5, -L.size*0.1, er, 0,6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(L.size*0.5 + er*3.2, -L.size*0.05, er, 0,6.28); ctx.fill();
    ctx.restore();
  }
}

function drawBackground(time){
  const ts = time*0.001;
  const d = descent;

  if (sceneReady && d > 0.85){
    const ir = sceneImg.width/sceneImg.height, cr = W/H;
    let dw,dh; if (cr>ir){ dw=W; dh=W/ir; } else { dh=H; dw=H*ir; }
    ctx.drawImage(sceneImg, (W-dw)/2, (H-dh)/2, dw, dh);
    const ov = ctx.createLinearGradient(0,0,0,H);
    ov.addColorStop(0,'rgba(4,18,31,.35)'); ov.addColorStop(1,'rgba(1,7,13,.78)');
    ctx.fillStyle = ov; ctx.fillRect(0,0,W,H);
  } else {
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,   _mix([56,188,216],[10,58,85], d));
    g.addColorStop(0.5, _mix([26,140,170],[6,24,42],  d));
    g.addColorStop(1,   _mix([8,60,86],  [1,7,13],   d));
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  }

  const surfaceY = H*0.18 - d*H*1.7;
  if (surfaceY > -180){
    const fade = Math.max(0, 1 - d*1.3);
    const sg = ctx.createLinearGradient(0, surfaceY-220, 0, surfaceY+30);
    sg.addColorStop(0, `rgba(195,247,255,${0.6*fade})`);
    sg.addColorStop(1, 'rgba(150,230,245,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, surfaceY-220, W, 250);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle = `rgba(212,249,255,${0.75*fade})`; ctx.lineWidth=3;
    ctx.beginPath();
    for (let x=0;x<=W;x+=18){ const yy=surfaceY+Math.sin(x*0.018+ts*1.6)*7; x===0?ctx.moveTo(x,yy):ctx.lineTo(x,yy); }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.4*fade})`; ctx.lineWidth=1.5;
    ctx.beginPath();
    for (let x=0;x<=W;x+=18){ const yy=surfaceY+9+Math.sin(x*0.02+ts*1.3+1)*5; x===0?ctx.moveTo(x,yy):ctx.lineTo(x,yy); }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save(); ctx.globalCompositeOperation='lighter';
  const rayBoost = 0.5 + (1-d)*1.2;
  const rays = 6;
  for (let i=0;i<rays;i++){
    const rx = (W/(rays-1))*i + Math.sin(ts*0.3 + i*1.7)*70;
    const wob = Math.sin(ts*0.5 + i)*0.25 + 0.75;
    const grad = ctx.createLinearGradient(rx, 0, rx+120, H);
    grad.addColorStop(0,`rgba(150,240,235,${0.10*wob*rayBoost})`);
    grad.addColorStop(0.6,`rgba(90,210,220,${0.03*wob*rayBoost})`);
    grad.addColorStop(1,'rgba(80,220,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(rx-46,0); ctx.lineTo(rx+46,0); ctx.lineTo(rx+170,H); ctx.lineTo(rx-20,H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

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

  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (let i=0;i<16;i++){
    const sd=i*7.13;
    const bx=((Math.sin(sd)*9301+ts*7*(0.2+(i%3)*0.05))%1+1)%1*W;
    const by=((Math.cos(sd)*4929 - ts*4*(0.15+(i%4)*0.05))%1+1)%1*H;
    const pulse=0.4+0.6*Math.abs(Math.sin(ts*1.5+i));
    ctx.fillStyle='rgba(120,255,220,'+(0.22*pulse*d).toFixed(3)+')';
    ctx.beginPath(); ctx.arc(bx,by,1.5+pulse,0,6.28); ctx.fill();
  }
  ctx.restore();

  if (!sceneReady && d > 0.5){
    const ka = Math.min(1,(d-0.5)/0.5);
    ctx.save(); ctx.globalAlpha = ka;
    ctx.fillStyle = 'rgba(3,16,26,0.7)';
    ctx.beginPath(); ctx.moveTo(0,H);
    for (let x=0;x<=W;x+=60) ctx.lineTo(x, H-72 - Math.sin(x*0.006 + ts*0.12)*26);
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#020a10';
    ctx.beginPath(); ctx.moveTo(0,H);
    for (let x=0;x<=W;x+=40) ctx.lineTo(x, H-26 - Math.sin(x*0.01+ts*0.2)*10 - 14);
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(24,110,95,.55)'; ctx.lineCap='round';
    const KN = 12;
    for (let k=0;k<KN;k++){
      const kx = (W/KN)*k + 24, h1 = 80 + (k%4)*34, sway = Math.sin(ts*0.8 + k)*22;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(kx, H);
      ctx.quadraticCurveTo(kx + sway*0.5, H-h1*0.55, kx + sway, H-h1); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(kx + sway, H-h1);
      ctx.quadraticCurveTo(kx + sway + Math.sin(ts+k)*12, H-h1-18, kx + sway + Math.sin(ts+k)*4, H-h1-30);
      ctx.stroke();
    }
    const _cc=['#c0397a','#7a3fd0','#e0683a','#2bb0a0','#d04a8a','#3a78d0'], _CN=9;
    for (let k=0;k<_CN;k++){
      const cx=(W/_CN)*k + ((k*61)%46) + 16, cy=H-16-(k%3)*7, sway2=Math.sin(ts*0.6+k)*3;
      ctx.fillStyle=_cc[k%_cc.length]; ctx.globalAlpha=ka*0.8;
      for (let b=0;b<4;b++){ const bx=cx+(b-1.5)*9+sway2*(b-1.5)*0.3, bh=20+(b%2)*14+(k%2)*6;
        ctx.beginPath(); ctx.ellipse(bx, cy-bh*0.5, 4.5, bh*0.5, 0,0,6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(bx, cy-bh, 4.5,0,6.28); ctx.fill(); }
    }
    ctx.globalAlpha=ka;
    ctx.restore();
  }

  ctx.save();
  for (const bu of bubbles){
    ctx.beginPath(); ctx.arc(bu.x,bu.y,bu.r,0,6.28);
    ctx.fillStyle = `rgba(170,240,240,${bu.a})`; ctx.fill();
    ctx.beginPath(); ctx.arc(bu.x-bu.r*0.3,bu.y-bu.r*0.3,bu.r*0.35,0,6.28);
    ctx.fillStyle = `rgba(255,255,255,${bu.a*0.8})`; ctx.fill();
  }
  ctx.restore();
}

function drawStar(x,y,r){ ctx.save(); ctx.translate(x,y); ctx.beginPath();
  for (let i=0;i<4;i++){ const a=i*Math.PI/2; ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); ctx.lineTo(Math.cos(a+0.785)*r*0.28,Math.sin(a+0.785)*r*0.28); }
  ctx.closePath(); ctx.fill(); ctx.restore(); }

function drawFish(f){
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.vy !== undefined && (f.vx||f.vy)){ const _ang=Math.atan2(f.vy,f.vx||0.0001); ctx.rotate(_ang); if (Math.abs(_ang)>Math.PI/2) ctx.scale(1,-1); }
  else if (f.dir < 0) ctx.scale(-1,1);
  const s = f.size;

  // ── sprite hook (ludo.ai): use bitmap if provided ──
  const _sk = f.spriteFrom || f.key;
  const spr = (FISH_TYPES[_sk] && FISH_TYPES[_sk].sprite) || (f.jackpot && FISH_TYPES.golden ? FISH_TYPES.golden.sprite : null);
  if (spr && spr.complete){
    const _ox=-s*1.9, _oy=-s*1.2, _dw=s*3.8, _dh=s*2.4;
    const _N=(f.size>28?12:f.size>18?9:6), _sw=spr.naturalWidth||spr.width, _sh=spr.naturalHeight||spr.height;
    const _ss=_sw/_N, _sd=_dw/_N, _sp=f.wig;
    const _glow = f.shiny||f.boss||f.jackpot;
    if (_glow){ ctx.shadowColor = f.glow; ctx.shadowBlur = 16; }
    for (let _i=0;_i<_N;_i++){
      const _t=1-_i/(_N-1);                 // 1 at tail .. 0 at head
      const _amp=_t*_t*s*0.42;              // gentle near body, strong only at the very tail
      const _yo=Math.sin(_sp*1.5 + _t*1.6)*_amp;
      ctx.drawImage(spr, _i*_ss,0,_ss,_sh, _ox+_i*_sd-0.8, _oy+_yo, _sd+2, _dh);
    }
    if (_glow) ctx.shadowBlur = 0;
    // damage flash — fish turns red when hit
    if (f.hitFlash > 0){
      ctx.globalAlpha = Math.min(0.85, f.hitFlash*7);
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.ellipse(0, 0, s*1.4, s*0.92, 0, 0, 6.28); ctx.fill();
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
    ctx.fillStyle = `rgba(255,60,60,${f.hitFlash*5})`; ctx.fill();
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
  const _cimg = currentCannonImg();
  if (_cimg){
    ctx.save();
    ctx.translate(cannon.x, cannon.y);
    ctx.rotate(a + Math.PI/2);
    ctx.shadowColor = '#28e0c8'; ctx.shadowBlur = 14;
    ctx.drawImage(_cimg, -CN_TW/2, -CN_JOINT*CN_TH, CN_TW, CN_TH);
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

  if (zoomPunch > 0){
    const z2 = 1 + zoomPunch*0.5;
    ctx.translate(zx, zy); ctx.scale(z2,z2); ctx.translate(-zx,-zy);
  }

  drawBackground(time);
  drawBgLife();

  // cinematic descent: rising bubbles + water speed-lines + pressure vignette
  if (phase === 'dive'){
    const dp = clamp(diveT/DIVE_DUR,0,1);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for (const s of diveStreaks){
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#bdfaf0';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r*0.6, s.r*(1.8+dp*2.5), 0, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(195,247,255,${0.08+dp*0.18})`; ctx.lineWidth = 2;
    for (let i=0;i<24;i++){
      const lx = (i*53 + time*0.04) % W;
      const ly = (((i*131 - time*(0.6+dp*1.6)) % (H+220)) + (H+220)) % (H+220) - 110;
      const len = 26 + dp*150;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly+len); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    const pv = ctx.createRadialGradient(W/2,H/2,H*(0.5-dp*0.32),W/2,H/2,H*0.92);
    pv.addColorStop(0,'rgba(0,0,0,0)');
    pv.addColorStop(1,`rgba(0,8,16,${0.28+dp*0.45})`);
    ctx.fillStyle = pv; ctx.fillRect(0,0,W,H);
  }

  // rings (shockwaves)
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (const r of rings){
    ctx.globalAlpha = clamp(r.life*1.6,0,1);
    ctx.strokeStyle = r.c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,6.28); ctx.stroke();
  }
  ctx.restore();
  if (waves.length){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for (const w of waves){
      const k = 1 - w.life/w.maxLife, rad = w.r + (w.max - w.r)*k, a = w.life/w.maxLife;
      ctx.globalAlpha = a*0.9; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(205,248,255,1)';
      ctx.beginPath(); ctx.arc(w.x,w.y,rad,0,6.28); ctx.stroke();
      ctx.globalAlpha = a*0.4; ctx.lineWidth = 15; ctx.strokeStyle = 'rgba(130,215,245,0.95)';
      ctx.beginPath(); ctx.arc(w.x,w.y,rad*0.92,0,6.28); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  fish.forEach(drawFish);

  for (const f of fish){ if (!f.jackpot) continue;
    const tt = performance.now()*0.004;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha = 0.4+0.3*Math.sin(tt); ctx.strokeStyle='#ffce63'; ctx.lineWidth=3; ctx.shadowColor='#ffce63'; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.arc(f.x,f.y,f.size*1.5+Math.sin(tt)*6,0,6.28); ctx.stroke();
    for (let k=0;k<6;k++){ const a=tt+k*1.05, rx=f.x+Math.cos(a)*f.size*1.7, ry=f.y+Math.sin(a)*f.size*1.7;
      ctx.globalAlpha=0.85; ctx.fillStyle='#fff1c2'; ctx.beginPath(); ctx.arc(rx,ry,2.6,0,6.28); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha=0.95; ctx.fillStyle='#ffce63'; ctx.font='800 15px Segoe UI,sans-serif';
    ctx.textAlign='center'; ctx.shadowColor='#ffce63'; ctx.shadowBlur=10; ctx.fillText('JACKPOT', f.x, f.y - f.size*1.75); ctx.restore();
  }

  for (const pu of powerups){
    const cfg = POWERUPS[pu.key];
    ctx.save(); ctx.shadowColor = cfg.color; ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(pu.x,pu.y,2,pu.x,pu.y,pu.r);
    g.addColorStop(0,'#ffffff'); g.addColorStop(0.4,cfg.color); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pu.x,pu.y,pu.r,0,6.28); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle='#03161a'; ctx.font='800 15px Segoe UI,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(cfg.icon, pu.x, pu.y+1);
    ctx.textBaseline='alphabetic'; ctx.restore();
  }

  // bullets
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (const b of bullets){
    for (let i=0;i<b.trail.length;i++){
      const tpt=b.trail[i], al=i/b.trail.length*0.5;
      ctx.globalAlpha=al; ctx.fillStyle=b.color||'#aef9ec';
      ctx.beginPath(); ctx.arc(tpt.x,tpt.y,b.r*0.7,0,6.28); ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.shadowColor=b.color||'#aef9ec'; ctx.shadowBlur=14;
    const bgr=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,b.r*1.6);
    bgr.addColorStop(0,'#ffffff'); bgr.addColorStop(0.5,b.color||'#7ff0dd'); bgr.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bgr;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r*1.6,0,6.28); ctx.fill();
  }
  ctx.restore();

  // particles
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (const p of particles){
    ctx.globalAlpha = clamp(p.life/p.max,0,1);
    ctx.fillStyle = p.c;
    if (p.star){ ctx.shadowColor=p.c; ctx.shadowBlur=8; drawStar(p.x,p.y,p.r*2.4); ctx.shadowBlur=0; }
    else { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill(); }
  }
  ctx.restore();

  drawCannon();

  // score popups
  for (const p of pops){
    ctx.globalAlpha = clamp(p.life/p.max,0,1);
    ctx.fillStyle = p.c; ctx.textAlign='center';
    ctx.font = `900 ${p.huge?64:p.big?30:20}px ${'Segoe UI,system-ui,sans-serif'}`;
    ctx.shadowColor=p.c; ctx.shadowBlur=12;
    ctx.fillText(p.txt, p.x, p.y);
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;

  ctx.restore();

  // vignette + impact flash (screen-space, no shake)
  const vg = ctx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.85);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1, phase==='playing' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

  if (phase==='playing' && combo >= 3){
    const pulse = 0.5 + 0.5*Math.sin(performance.now()*0.006);
    const col = combo>=6 ? '255,206,99' : '40,224,200';
    const cg = ctx.createRadialGradient(W/2,H/2,H*0.42,W/2,H/2,H*0.95);
    cg.addColorStop(0,'rgba(0,0,0,0)');
    cg.addColorStop(1,`rgba(${col},${(0.10+combo*0.02)*(0.6+0.4*pulse)})`);
    ctx.fillStyle=cg; ctx.fillRect(0,0,W,H);
  }

  if (flash > 0){
    ctx.globalAlpha = flash*0.5; ctx.fillStyle = flashColor;
    ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1;
  }
  if (coinsFx.length){
    for (const c of coinsFx){ if (c.delay>0) continue; drawCoin(c.x, c.y, c.r, c.spin); }
  }
  if (freezeT > 0){
    ctx.save(); ctx.globalAlpha = Math.min(0.22, freezeT*0.08);
    const fg = ctx.createLinearGradient(0,0,0,H);
    fg.addColorStop(0,'rgba(160,225,255,0.6)'); fg.addColorStop(1,'rgba(120,200,255,0.1)');
    ctx.fillStyle = fg; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  if (phase==='playing'){
    const act = [];
    if (freezeT>0) act.push(['FREEZE','#7fd4ff',freezeT,4.5]);
    if (doubleT>0) act.push(['FRENZY x2','#ffce63',doubleT,7]);
    if (multiT>0)  act.push(['MULTI-SHOT','#28e0c8',multiT,7]);
    let ax = W/2 - act.length*56;
    for (const a of act){
      ctx.save();
      ctx.fillStyle='rgba(8,30,46,0.82)'; ctx.strokeStyle=a[1]; ctx.lineWidth=1.5;
      roundRect(ax, 12, 104, 28, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle=a[1]; ctx.font='800 11px Segoe UI,sans-serif'; ctx.textAlign='left';
      ctx.fillText(a[0], ax+9, 27);
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(ax+9, 31, 86, 3);
      ctx.fillStyle=a[1]; ctx.fillRect(ax+9, 31, 86*Math.min(1,a[2]/a[3]), 3);
      ctx.restore();
      ax += 112;
    }
  }
}

// ── loop ─────────────────────────────────────────────────────────
let last = performance.now();
function loop(now){
  const dt = Math.min((now-last)/1000, 0.05);
  last = now;
  if (phase === 'boot')        updateBoot(dt);
  else if (phase === 'dive')   updateDive(dt);
  else if (phase === 'playing' && running){ if (hitStop > 0) hitStop -= dt; else update(dt); }
  else                         updateAmbient(dt);   // menu / over
  updateFx(dt);
  render(now);
  requestAnimationFrame(loop);
}
seedAmbient();
requestAnimationFrame(loop);

// ── start / end ──────────────────────────────────────────────────
function startGame(){
  fish=[]; bullets=[]; particles=[]; pops=[]; rings=[];
  score=0; credits=START_CREDITS; creditsShown=START_CREDITS; timeLeft=ROUND_TIME;
  combo=1; comboKills=0; comboTimer=0; spawnTimer=0; elapsed=0;
  shake=0; flash=0; wpnLevel=1; firing=false;
  stats = { shots:0, hits:0, kills:0, bestCombo:1, biggest:'—', biggestVal:0, coins:0 };
  setWpn(1); updateHUD();
  document.getElementById('hud-combo').textContent='x1';
  document.getElementById('combo-block').classList.remove('live');
  document.getElementById('overlay-start').classList.add('hidden');
  document.getElementById('overlay-end').classList.add('hidden');
  matchSeed = mode==='tournament' ? dailySeed() : ((Math.random()*1e9)|0);
  setSeed(matchSeed);
  for (let i=0;i<5;i++) spawnFish(false);
  descent = 1;
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
  renderMenu();
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

  // daily challenge label + local leaderboard
  const dEl = document.getElementById('end-daily');
  dEl.textContent = mode==='tournament'
    ? `Daily Challenge #${matchSeed} - same fish for everyone`
    : 'Free Hunt - practice run (not ranked)';
  const lbEl = document.getElementById('end-lb');
  let lb = []; try { lb = JSON.parse(localStorage.getItem(K.lb) || '[]'); } catch(e){}
  if (mode==='tournament' && lb.length){
    lbEl.innerHTML = '<div class="lb-title">TOP HUNTERS</div>' + lb.slice(0,5).map((e,i) => {
      const me = (e.name===NICK && e.score===score);
      return `<div class="lb-row${me?' me':''}"><span class="lb-rk">${['1','2','3'][i]||(i+1)}</span><span class="lb-nm">${e.name}${me?' (you)':''}</span><span class="lb-sc">${formatNum(e.score)}</span></div>`;
    }).join('');
  } else lbEl.innerHTML = '';

  { const _c=document.querySelector('#overlay-end .ov-card'); if(_c) _c.classList.toggle('record', isPB); }
  if (isPB) celebrate();
  document.getElementById('overlay-end').classList.remove('hidden');
}

function saveLeaderboard(sc){
  let lb = [];
  try { lb = JSON.parse(localStorage.getItem(K.lb) || '[]'); } catch(e){ lb=[]; }
  lb.push({ name:NICK, score:sc });
  lb.sort((a,b)=>b.score-a.score); lb = lb.slice(0,10);
  localStorage.setItem(K.lb, JSON.stringify(lb));
  const wk = weekId();
  let wl = []; try { wl = JSON.parse(localStorage.getItem('fishhunter_lb_weekly') || '[]'); } catch(e){ wl=[]; }
  wl.push({ name:NICK, score:sc, wk });
  wl = wl.filter(e => e.wk === wk).sort((a,b)=>b.score-a.score).slice(0,10);
  localStorage.setItem('fishhunter_lb_weekly', JSON.stringify(wl));
}

// overlay wiring
document.querySelectorAll('#ov-mode .mode-btn').forEach(btn=>{
  btn.onclick = () => {
    document.querySelectorAll('#ov-mode .mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); mode = btn.dataset.mode;
  };
});
document.getElementById('btn-start').onclick = startGame;
const _sm = document.getElementById('soon-msg');
function showSoon(w){ if(_sm){ _sm.textContent = w + ' - coming soon'; _sm.classList.add('show'); clearTimeout(showSoon._t); showSoon._t=setTimeout(()=>_sm.classList.remove('show'),1900); } }
{ const b=document.getElementById('btn-multi'); if(b) b.onclick=()=>showSoon('Multiplayer'); }
{ const b=document.getElementById('btn-shop'); if(b) b.onclick=()=>{ const o=document.getElementById('overlay-shop'); if(o){ o.classList.remove('hidden'); renderShop(); } }; }
{ const b=document.getElementById('shop-close'); if(b) b.onclick=()=>{ const o=document.getElementById('overlay-shop'); if(o) o.classList.add('hidden'); }; }
document.getElementById('btn-again').onclick = () => { startGame(); };
document.getElementById('exit-btn').onclick = exitToMenu;
document.getElementById('mute-btn').onclick = toggleMute;
function makeCoinIcon(){
  const c=document.createElement('canvas'); c.width=c.height=44; const x=c.getContext('2d');
  x.translate(22,22); const r=19;
  const g=x.createRadialGradient(-r*0.3,-r*0.3,r*0.15,0,0,r);
  g.addColorStop(0,'#fff0bf'); g.addColorStop(0.5,'#ffce63'); g.addColorStop(1,'#dd9418');
  x.fillStyle=g; x.beginPath(); x.arc(0,0,r,0,6.28); x.fill();
  x.strokeStyle='#b8801a'; x.lineWidth=r*0.13; x.beginPath(); x.arc(0,0,r*0.9,0,6.28); x.stroke();
  x.fillStyle='#9a6b12';
  x.beginPath(); x.ellipse(r*0.06,0,r*0.4,r*0.22,0,0,6.28); x.fill();
  x.beginPath(); x.moveTo(-r*0.32,0); x.lineTo(-r*0.6,-r*0.2); x.lineTo(-r*0.6,r*0.2); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(r*0.08,-r*0.16); x.quadraticCurveTo(r*0.28,-r*0.42,r*0.36,-r*0.14); x.closePath(); x.fill();
  x.fillStyle='#5a3d08'; x.beginPath(); x.arc(r*0.32,-r*0.05,r*0.05,0,6.28); x.fill();
  const url=c.toDataURL();
  document.querySelectorAll('.coin-ico').forEach(e=>{ e.style.background='url('+url+') center/contain no-repeat'; });
}
try { makeCoinIcon(); } catch(e){}
coinImg.addEventListener('load', ()=>{ document.querySelectorAll('.coin-ico').forEach(e=>{ e.style.background='url('+coinImg.src+') center/contain no-repeat'; }); });
