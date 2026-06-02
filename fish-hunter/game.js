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
  const muzzleX = cannon.x + Math.cos(a)*cannon.len;
  const muzzleY = cannon.y + Math.sin(a)*cannon.len;
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
  combo = clamp(1 + Math.floor(comboKills/2), 1, 8);
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

// ════════════════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════════════════
function update(dt){
  elapsed += dt;
  cannon.x = W/2; cannon.y = H + 6;

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
  // depth gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#08314a'); g.addColorStop(0.45,'#04121f'); g.addColorStop(1,'#01070d');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // caustic light rays from the surface
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rays = 5;
  for (let i=0;i<rays;i++){
    const rx = (W/(rays-1))*i + Math.sin(time*0.0003 + i)*60;
    const grad = ctx.createLinearGradient(rx, 0, rx+90, H);
    grad.addColorStop(0,'rgba(80,220,220,0.10)');
    grad.addColorStop(1,'rgba(80,220,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(rx-50,0); ctx.lineTo(rx+50,0);
    ctx.lineTo(rx+150,H); ctx.lineTo(rx-10,H); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // bubbles
  ctx.save();
  for (const bu of bubbles){
    ctx.beginPath(); ctx.arc(bu.x,bu.y,bu.r,0,6.28);
    ctx.fillStyle = `rgba(170,240,240,${bu.a})`; ctx.fill();
  }
  ctx.restore();
}

function drawFish(f){
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.dir < 0) ctx.scale(-1,1);            // face travel direction
  const s = f.size;

  // ── sprite hook (ludo.ai): use bitmap if provided ──
  if (f.sprite && f.sprite.complete){
    ctx.shadowColor = f.glow; ctx.shadowBlur = 22;
    ctx.drawImage(f.sprite, -s*1.6, -s, s*3.2, s*2);
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
  const dx = aim.x - cannon.x, dy = aim.y - cannon.y;
  const a  = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(cannon.x, cannon.y);

  // aim guide
  ctx.save();
  ctx.rotate(a);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#28e0c8'; ctx.lineWidth = 2; ctx.setLineDash([6,10]);
  ctx.beginPath(); ctx.moveTo(cannon.len,0); ctx.lineTo(900,0); ctx.stroke();
  ctx.restore();

  // barrel
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

  drawBackground(time);

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
  if (running) update(dt);
  render(now);
  requestAnimationFrame(loop);
}
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
  running = true;
}

function endGame(){
  running = false; firing = false;
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
