'use strict';

// ══════════════════════════════════════════════════════════════════
//  BLOB EVOLUTION  –  6 Elemental Forms · Ultra Forms · Events
// ══════════════════════════════════════════════════════════════════

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const WORLD     = 3000;
const CELL_SIZE = 200;

// ── FORMS (Tier 1 + Tier 2 Ultra) ────────────────────────────────
const FORMS = {
  neutru:     { name:'NEUTRU',      emoji:'⚪', color:'#aaaaaa', color2:'#eeeeee',
                ability:null,            cooldown:0,      abilityDur:0,
                crystalColor:'#888888',  crystalColor2:'#cccccc',   tier:1 },
  flacarau:   { name:'FLACARAU',    emoji:'🔥', color:'#ff4500', color2:'#ffaa00',
                ability:'fireTrail',     cooldown:5000,   abilityDur:3000,
                crystalColor:'#ff4500',  crystalColor2:'#ff8800',   tier:1 },
  glaciar:    { name:'GLACIAR',     emoji:'❄️',  color:'#00cfff', color2:'#e0f8ff',
                ability:'freezePulse',   cooldown:8000,   abilityDur:2000,
                crystalColor:'#00cfff',  crystalColor2:'#a0f0ff',   tier:1 },
  fulgerul:   { name:'FULGERUL',    emoji:'⚡', color:'#ffe500', color2:'#dd00ff',
                ability:'teleport',      cooldown:5000,   abilityDur:400,
                crystalColor:'#ffe500',  crystalColor2:'#ffaa00',   tier:1 },
  umbra:      { name:'UMBRA',       emoji:'🌑', color:'#6600cc', color2:'#1a0033',
                ability:'invisible',     cooldown:12000,  abilityDur:4000,
                crystalColor:'#6600aa',  crystalColor2:'#aa00ff',   tier:1 },
  lumina:     { name:'LUMINA',      emoji:'✨', color:'#ffffff', color2:'#ffffa0',
                ability:'attract',       cooldown:10000,  abilityDur:3000,
                crystalColor:'#ffff88',  crystalColor2:'#ffffff',   tier:1 },
  // ── TIER 2 ──────────────────────────────────────────────────────
  inferno:    { name:'INFERNO',     emoji:'🌋', color:'#ff1100', color2:'#ffff00',
                ability:'explosion',     cooldown:12000,  abilityDur:800,
                crystalColor:'#ff1100',  crystalColor2:'#ffff00',   tier:2, base:'flacarau' },
  blizzard:   { name:'BLIZZARD',    emoji:'🌨', color:'#00aaff', color2:'#ffffff',
                ability:'megaFreeze',    cooldown:15000,  abilityDur:2000,
                crystalColor:'#00aaff',  crystalColor2:'#ffffff',   tier:2, base:'glaciar' },
  thundergod: { name:'THUNDER GOD', emoji:'🌩', color:'#ffff00', color2:'#00ffff',
                ability:'chainLightning',cooldown:8000,   abilityDur:600,
                crystalColor:'#ffff00',  crystalColor2:'#00ffff',   tier:2, base:'fulgerul' },
  voidform:   { name:'VOID',        emoji:'🕳', color:'#220033', color2:'#8800cc',
                ability:'blackHole',     cooldown:20000,  abilityDur:8000,
                crystalColor:'#110022',  crystalColor2:'#6600cc',   tier:2, base:'umbra' },
  radiance:   { name:'RADIANCE',    emoji:'☀️',  color:'#ffee00', color2:'#ffffff',
                ability:'blindAll',      cooldown:18000,  abilityDur:3000,
                crystalColor:'#ffee00',  crystalColor2:'#ffffff',   tier:2, base:'lumina' },
};

const ULTRA_MAP  = { flacarau:'inferno', glaciar:'blizzard', fulgerul:'thundergod', umbra:'voidform', lumina:'radiance' };
const FORM_KEYS  = ['neutru','flacarau','glaciar','fulgerul','umbra','lumina'];
const EVOLVE_THRESHOLD = 50;

const WEAKNESS = { flacarau:'lumina', glaciar:'flacarau', fulgerul:'glaciar', umbra:'fulgerul',  lumina:'umbra',  neutru:null };
const STRENGTH = { flacarau:'glaciar',glaciar:'fulgerul', fulgerul:'umbra',   umbra:'lumina',    lumina:'flacarau',neutru:null };

function baseForm(f) { const fd=FORMS[f]; return (fd&&fd.tier===2&&fd.base)?fd.base:f; }

// ── QUEST POOL ────────────────────────────────────────────────────
const QUEST_POOL = [
  { id:'eat5',         desc:'Eat 5 blobs',          trackKey:'blobs_eaten',    target:5,   reward:{coins:15, xp:40}  },
  { id:'eat15',        desc:'Eat 15 blobs',          trackKey:'blobs_eaten',    target:15,  reward:{coins:30, xp:80}  },
  { id:'reach500',     desc:'Reach 500 mass',        trackKey:'max_mass',       target:500, reward:{coins:20, xp:60}  },
  { id:'reach1000',    desc:'Reach 1000 mass',       trackKey:'max_mass',       target:1000,reward:{coins:40, xp:100} },
  { id:'crystals50',   desc:'Eat 50 crystals',       trackKey:'crystals_eaten', target:50,  reward:{coins:10, xp:30}  },
  { id:'crystals100',  desc:'Eat 100 crystals',      trackKey:'crystals_eaten', target:100, reward:{coins:25, xp:70}  },
  { id:'survive3',     desc:'Survive 3 minutes',     trackKey:'time_alive',     target:180, reward:{coins:20, xp:50}  },
  { id:'survive5',     desc:'Survive 5 minutes',     trackKey:'time_alive',     target:300, reward:{coins:50, xp:120} },
  { id:'kill_boss',    desc:'Defeat the Boss',        trackKey:'bosses_killed',  target:1,   reward:{coins:100,xp:200} },
  { id:'ultra_evo',    desc:'Reach Ultra form',       trackKey:'ultra_evolved',  target:1,   reward:{coins:60, xp:150} },
];

// ── IN-GAME ACHIEVEMENTS ──────────────────────────────────────────
const BLOB_ACHS = [
  { id:'boss_slayer',     name:'BOSS SLAYER',     desc:'Kill the Elemental Boss',    xp:200, emoji:'👹' },
  { id:'ultra_evolved',   name:'ULTRA EVOLVED',   desc:'Reach an Ultra form',        xp:300, emoji:'⚡' },
  { id:'vortex_survivor', name:'VORTEX SURVIVOR', desc:'Survive the Vortex center',  xp:150, emoji:'🌀' },
  { id:'meteor_magnet',   name:'METEOR MAGNET',   desc:'Absorb a meteor (100+ mass)',xp:100, emoji:'☄️'  },
  { id:'element_master',  name:'ELEMENT MASTER',  desc:'Unlock all 6 elements',      xp:500, emoji:'🌟' },
  { id:'untouchable',     name:'UNTOUCHABLE',     desc:'Survive 10 minutes',         xp:250, emoji:'🛡'  },
  { id:'prestige_1',      name:'PRESTIGE I',      desc:'Reach Prestige 1',           xp:400, emoji:'⭐' },
];

// ── BOT NAMES ─────────────────────────────────────────────────────
const BOT_NAMES = [
  'Fire_Kael','Ice_Zara','Storm_Rex','Shadow_Nyx','Light_Sol',
  'Flame_Dusk','Frost_Vera','Thunder_Ax','Void_Kira','Dawn_Lux',
  'Blaze_Rho','Chill_Sky','Bolt_Zyx','Dark_Mira','Glow_Sun',
  'Ember_Fox','Glacius','Strykos','Umbrix','Photon'
];

// ── SOUND HELPER ─────────────────────────────────────────────────
function snd(name) { try { if(typeof ArcadeSound!=='undefined') ArcadeSound.play(name); } catch(e){} }

// ── SPATIAL GRID ──────────────────────────────────────────────────
const grid = {};
function gKey(x,y) { return `${Math.floor(x/CELL_SIZE)},${Math.floor(y/CELL_SIZE)}`; }
function gInsert(o) { const k=gKey(o.x,o.y); (grid[k]=grid[k]||[]).push(o); o._gk=k; }
function gRemove(o) { const k=o._gk,arr=grid[k]; if(!arr)return; const i=arr.indexOf(o); if(i>=0)arr.splice(i,1); }
function gMove(o,nx,ny) { const nk=gKey(nx,ny); if(nk!==o._gk){gRemove(o);o.x=nx;o.y=ny;gInsert(o);}else{o.x=nx;o.y=ny;} }
function gQuery(cx,cy,r) {
  const res=[],span=Math.ceil(r/CELL_SIZE)+1,ox=Math.floor(cx/CELL_SIZE),oy=Math.floor(cy/CELL_SIZE);
  for(let dx=-span;dx<=span;dx++) for(let dy=-span;dy<=span;dy++){const arr=grid[`${ox+dx},${oy+dy}`];if(arr)for(const o of arr)res.push(o);}
  return res;
}
function gClear() { for(const k in grid) delete grid[k]; }

// ── HELPERS ───────────────────────────────────────────────────────
const rnd    = (a,b) => a+Math.random()*(b-a);
const rndInt = (a,b) => Math.floor(rnd(a,b+0.9999));
const clamp  = (v,lo,hi) => v<lo?lo:v>hi?hi:v;
const dist2  = (a,b) => { const dx=a.x-b.x,dy=a.y-b.y; return dx*dx+dy*dy; };
const dist   = (a,b) => Math.sqrt(dist2(a,b));
const mToR   = m => Math.sqrt(m)*4;
const fmtT   = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

// ── MINIMAP ───────────────────────────────────────────────────────
const mmCanvas = document.getElementById('minimap');
const mmCtx    = mmCanvas ? mmCanvas.getContext('2d') : null;
const MM_SIZE  = 120;
if (mmCanvas) { mmCanvas.width=MM_SIZE; mmCanvas.height=MM_SIZE; }

// ── STATE ─────────────────────────────────────────────────────────
let player, bots, crystals, particles, frozenBlobs;
let camera;
let gameState  = 'idle';
let gameTime, totalPauseDur, pauseStart;
let bestMass, maxMass, botsEaten;
let nickname   = '';
let mouseX, mouseY;
let lastTime   = 0;

// ── NEW SYSTEMS STATE ─────────────────────────────────────────────
let boss           = null;
let bossTimer      = 180000;
let bossKillCount  = 0;

let vortex         = null;
let vortexTimer    = 300000;

let meteors        = [];
let meteorTimer    = 240000;
let meteorShowerActive = false;
let meteorShowerSpawnT = 0;
let meteorShowerCount  = 0;

let dailyQuests    = [];
let sessionQuestProgress = { blobs_eaten:0, crystals_eaten:0, bosses_killed:0, ultra_evolved:0, max_mass:0 };

let prestigeLevel  = 0;
let xpMultiplier   = 1;

let achsDone       = new Set();
let achPopupQueue  = [];
let achPopupTimer  = 0;

let floatTexts     = [];
let shakeTimer     = 0;
let shakeMag       = 0;
let blackHoles     = [];

let ultraEvoTimer  = 0;
let ultraEvoTarget = null;
let _bannerTimeout = 0;

// ── PARALLAX STARS ────────────────────────────────────────────────
const starLayers = [0,1,2].map(l=>({
  spd:0.15+l*0.25,
  stars:Array.from({length:70+l*50},()=>({x:Math.random(),y:Math.random(),r:rnd(0.2,0.5+l*0.35),b:rnd(0.25,0.9),tw:rnd(0,Math.PI*2)}))
}));

// ── INIT ──────────────────────────────────────────────────────────
function init() {
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  mouseX=canvas.width/2; mouseY=canvas.height/2;

  nickname = localStorage.getItem('portal_nickname') || localStorage.getItem('blobevo_nick') || '';
  bestMass = parseInt(localStorage.getItem('blobevo_best'))||0;
  prestigeLevel = parseInt(localStorage.getItem('blobevo_prestige'))||0;
  bossKillCount = parseInt(localStorage.getItem('blobevo_bosses_killed'))||0;
  xpMultiplier = [1,1.5,2,3][Math.min(prestigeLevel,3)];

  const inp = document.getElementById('nick-input');
  if (nickname) inp.value=nickname;
  if (bestMass>0) document.getElementById('ov-best-row').textContent=`PERSONAL BEST: ${bestMass} MASS`;

  achsDone = new Set(JSON.parse(localStorage.getItem('blobevo_achs')||'[]'));
  initDailyQuests();

  inp.addEventListener('keydown', e=>{ if(e.key==='Enter') startGame(); });
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', ()=>{
    document.getElementById('gameover').classList.add('hidden');
    startGame();
  });
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('prestige-btn').addEventListener('click', showPrestigePopup);
  document.getElementById('prestige-confirm').addEventListener('click', doPrestige);
  document.getElementById('prestige-cancel').addEventListener('click', ()=>document.getElementById('prestige-popup').classList.add('hidden'));

  canvas.addEventListener('mousemove', e=>{ mouseX=e.clientX; mouseY=e.clientY; });
  canvas.addEventListener('click', ()=>{ if(gameState==='playing') useAbility(); });
  // Touch: finger drives blob movement, double-tap = ability
  canvas.addEventListener('touchmove', e=>{
      mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY;
      e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchstart', e=>{
      mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('keydown', e=>{
    if ((e.key==='f'||e.key==='F') && gameState==='playing') useAbility();
    if ((e.key==='e'||e.key==='E') && gameState==='playing') tryUltraEvo();
    if (e.key==='Escape') {
      if (gameState==='playing') pauseGame();
      else if (gameState==='paused') resumeGame();
    }
  });
  window.addEventListener('resize', ()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; });

  // Form selector
  window._blobStartForm = 'neutru';
  const formDescs = {
    neutru:   'Neutru — balanced start, no special ability',
    flacarau: 'Flacarau 🔥 — Fire Trail: leave burning damage behind you',
    glaciar:  'Glaciar ❄️ — Freeze Pulse: slow all nearby blobs for 2 seconds',
    fulgerul: 'Fulgerul ⚡ — Teleport: instantly warp to a random location',
    umbra:    'Umbra 🌑 — Invisible: become unseen for 4 seconds',
    lumina:   'Lumina ✨ — Attract: pull nearby crystals toward you',
  };
  document.querySelectorAll('.form-sel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.form-sel-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      window._blobStartForm = btn.dataset.form;
      const descEl = document.getElementById('form-sel-desc');
      if (descEl) descEl.textContent = formDescs[btn.dataset.form] || '';
    });
    // Default select neutru
    if (btn.dataset.form === 'neutru') btn.classList.add('selected');
  });

  requestAnimationFrame(gameLoop);
}

// ── START GAME ────────────────────────────────────────────────────
function startGame() {
  const inp = document.getElementById('nick-input').value.trim();
  nickname  = inp || 'PLAYER';
  localStorage.setItem('blobevo_nick', nickname);

  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('evo-flash').classList.add('hidden');
  for (const id of ['hud','elem-bar','ws-panel','hud-lb','ability-bar','minimap','quest-panel'])
    document.getElementById(id).classList.remove('hidden');

  gClear();
  frozenBlobs = new Map();
  particles   = [];
  bots        = [];
  crystals    = [];
  blackHoles  = [];
  floatTexts  = [];
  meteors     = [];

  boss                  = null;
  vortex                = null;
  bossTimer             = 180000;
  vortexTimer           = 300000;
  meteorTimer           = 240000;
  meteorShowerActive    = false;
  meteorShowerCount     = 0;
  ultraEvoTimer         = 0;
  ultraEvoTarget        = null;
  achPopupQueue         = [];
  achPopupTimer         = 0;
  shakeTimer            = 0;

  sessionQuestProgress  = { blobs_eaten:0, crystals_eaten:0, bosses_killed:0, ultra_evolved:0, max_mass:0 };

  // Use player's chosen starting form (default: neutru)
  const chosenForm = window._blobStartForm || 'neutru';
  player = mkBlob(WORLD/2, WORLD/2, 10, chosenForm, true);

  for (let i=0;i<20;i++) {
    const form = i===0?'neutru':FORM_KEYS[rndInt(0,5)];
    const b = mkBlob(rnd(100,WORLD-100), rnd(100,WORLD-100), rnd(8,24), form, false);
    b.name=BOT_NAMES[i]; b.speed=rnd(2.0,3.2); b.ep=rnd(0,25);
    b.isAI=i>=10; b.state='wander'; b.stTimer=rnd(2000,7000);
    b.wTgt={x:rnd(100,WORLD-100),y:rnd(100,WORLD-100)};
    bots.push(b);
  }

  for (let i=0;i<300;i++) spawnCrystal('normal');
  for (let i=0;i< 50;i++) spawnCrystal('rare');
  for (let i=0;i< 20;i++) spawnCrystal('chaos');

  camera        = {x:WORLD/2,y:WORLD/2,zoom:1.0};
  gameState     = 'playing';
  gameTime      = Date.now();
  pauseStart    = 0;
  totalPauseDur = 0;
  botsEaten     = 0;
  maxMass       = player.mass;

  updateQuestPanel();
}

function mkBlob(x,y,mass,form,isPlayer) {
  return {
    x,y,mass,form,
    speed: isPlayer?3.5:2.8,
    ep:0, abCD:0, abTimer:0,
    invisible:false, trailPts:[],
    isPlayer:!!isPlayer, isBot:!isPlayer,
    name:isPlayer?nickname:'?',
    dead:false, _trailDmgT:0
  };
}

// ── CRYSTALS ──────────────────────────────────────────────────────
function spawnCrystal(type) {
  return spawnCrystalAt(rnd(60,WORLD-60), rnd(60,WORLD-60), type);
}
function spawnCrystalAt(x,y,type) {
  const fk=FORM_KEYS[rndInt(0,5)], f=FORMS[fk];
  const rare=type==='rare', chaos=type==='chaos';
  const c = {
    x:clamp(x,60,WORLD-60), y:clamp(y,60,WORLD-60),
    type, form:chaos?null:fk,
    size:chaos?10:rare?8:5, mass:chaos?3:rare?5:2,
    color:chaos?'#ff00ff':f.crystalColor, color2:chaos?'#00ffff':f.crystalColor2,
    angle:rnd(0,Math.PI*2), rotSpd:rnd(-0.04,0.04), pulse:rnd(0,Math.PI*2),
    isCrystal:true, eaten:false, attractedUntil:0
  };
  gInsert(c); crystals.push(c); return c;
}
function removeCrystal(c) {
  if(c.eaten) return; c.eaten=true; gRemove(c);
  const i=crystals.indexOf(c); if(i>=0) crystals.splice(i,1);
  const t=c.type;
  setTimeout(()=>{ if(gameState==='playing') spawnCrystal(t); }, rnd(3000,9000));
}

// ── ABILITIES ─────────────────────────────────────────────────────
function useAbility() {
  if(!player||player.dead) return;
  if(ultraEvoTimer>0) return;
  const f=FORMS[player.form];
  if(!f.ability||player.abCD>0) return;
  player.abCD=f.cooldown; player.abTimer=f.abilityDur;
  execAbility(player, f.ability);
}

function execAbility(blob, ability) {
  switch(ability) {
    case 'fireTrail':     /* passive */ break;
    case 'freezePulse':   doFreeze(blob);         break;
    case 'teleport':      doTeleport(blob);        break;
    case 'invisible':     blob.invisible=true;     break;
    case 'attract':       doAttract(blob);         break;
    case 'explosion':     doExplosion(blob);       break;
    case 'megaFreeze':    doMegaFreeze(blob);      break;
    case 'chainLightning':doChainLightning(blob);  break;
    case 'blackHole':     doBlackHole(blob);       break;
    case 'blindAll':      doBlindAll(blob);        break;
  }
}

function doFreeze(blob) {
  const R=200, targets=blob.isPlayer?bots:[...bots.filter(b=>b!==blob),player];
  for(const t of targets){ if(!t||t.dead||dist(blob,t)>=R) continue; frozenBlobs.set(t,Date.now()+2000); spawnN(t.x,t.y,'ice',6); }
  for(let i=0;i<20;i++){const a=(i/20)*Math.PI*2; particles.push({x:blob.x+Math.cos(a)*R,y:blob.y+Math.sin(a)*R,vx:Math.cos(a)*0.8,vy:Math.sin(a)*0.8,life:1,maxLife:1,size:5,color:'#00cfff',type:'pulse'});}
}
function doTeleport(blob) {
  let tx,ty;
  if(blob.isPlayer){
    const dx=mouseX-canvas.width/2,dy=mouseY-canvas.height/2,d=Math.sqrt(dx*dx+dy*dy)||1,r=Math.min(300,d);
    tx=clamp(blob.x+dx/d*r,50,WORLD-50); ty=clamp(blob.y+dy/d*r,50,WORLD-50);
  } else {
    const tgt=blob._aiTgt||{x:rnd(100,WORLD-100),y:rnd(100,WORLD-100)};
    const dx=tgt.x-blob.x,dy=tgt.y-blob.y,d=Math.sqrt(dx*dx+dy*dy)||1,r=Math.min(300,d);
    tx=clamp(blob.x+dx/d*r,50,WORLD-50); ty=clamp(blob.y+dy/d*r,50,WORLD-50);
  }
  spawnN(blob.x,blob.y,'electric',10); blob.x=tx; blob.y=ty; spawnN(tx,ty,'electric',10);
}
function doAttract(blob) {
  const R=400,now=Date.now();
  for(const c of gQuery(blob.x,blob.y,R)) if(c.isCrystal&&!c.eaten&&dist(blob,c)<R) c.attractedUntil=now+3000;
}
function doExplosion(blob) {
  const R=300;
  const targets=blob.isPlayer?[...bots]:[...bots.filter(b=>b!==blob),player];
  for(const t of targets){
    if(!t||t.dead||dist(blob,t)>R) continue;
    const dmg=t.mass*0.30; t.mass=Math.max(5,t.mass-dmg);
    if(t.isPlayer){ addFloat(t.x,t.y,`-${Math.floor(dmg)}`,'#ff4500'); triggerShake(10,400); }
    spawnN(t.x,t.y,'fire',12);
  }
  for(let i=0;i<30;i++){const a=(i/30)*Math.PI*2; particles.push({x:blob.x+Math.cos(a)*R,y:blob.y+Math.sin(a)*R,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,life:1.5,maxLife:1.5,size:8,color:'#ff4500',type:'fire'});}
  triggerShake(12,500); showGameFlash('rgba(255,100,0,0.35)',400);
  if(blob.isPlayer) addFloat(blob.x,blob.y,'💥 EXPLOSION!','#ff6600');
}
function doMegaFreeze(blob) {
  const now=Date.now();
  const targets=blob.isPlayer?[...bots]:[...bots.filter(b=>b!==blob),player];
  for(const t of targets){ if(!t||t.dead) continue; frozenBlobs.set(t,now+2000); spawnN(t.x,t.y,'ice',8); }
  spawnN(blob.x,blob.y,'ice',25); triggerShake(5,300);
  showBanner('❄️ MEGA FREEZE!',2500);
}
function doChainLightning(blob) {
  const allBlobs=(blob.isPlayer?[...bots]:[...bots.filter(b=>b!==blob),player].filter(b=>b&&!b.dead));
  allBlobs.sort((a,b)=>dist(blob,a)-dist(blob,b));
  const targets=allBlobs.slice(0,5);
  for(const t of targets){
    if(dist(blob,t)>500) continue;
    const dmg=t.mass*0.15; t.mass=Math.max(5,t.mass-dmg);
    if(t.isPlayer){ addFloat(t.x,t.y,`-${Math.floor(dmg)}`,'#ffe500'); triggerShake(5,200); }
    spawnN(t.x,t.y,'electric',10);
  }
  blob._chainTargets={targets,timer:400};
}
function doBlackHole(blob) {
  let tx,ty;
  if(blob.isPlayer){
    const dx=mouseX-canvas.width/2, dy=mouseY-canvas.height/2;
    tx=clamp(blob.x+dx/camera.zoom,50,WORLD-50); ty=clamp(blob.y+dy/camera.zoom,50,WORLD-50);
  } else { tx=clamp(blob.x+rnd(-200,200),50,WORLD-50); ty=clamp(blob.y+rnd(-200,200),50,WORLD-50); }
  blackHoles.push({x:tx,y:ty,radius:250,duration:3000,owner:blob});
  blob.invisible=true;
}
function doBlindAll(blob) {
  showGameFlash('rgba(255,255,255,0.85)',500); triggerShake(8,400);
  const now=Date.now();
  for(const c of crystals) c.attractedUntil=now+3000;
  for(const b of bots){ if(b.dead) continue; b._blinded=now+3000; b.wTgt={x:rnd(100,WORLD-100),y:rnd(100,WORLD-100)}; }
  spawnN(blob.x,blob.y,'light',25);
  if(blob.isPlayer) addFloat(blob.x,blob.y,'☀️ RADIANCE!','#ffff00');
}

// ── PARTICLES ─────────────────────────────────────────────────────
const PCFG = {
  fire:    {cols:['#ff4500','#ff8c00'],sz:[3,7],  lf:[0.7,1.2],rise:true},
  ice:     {cols:['#00cfff','#a0f0ff'],sz:[3,6],  lf:[0.6,1.1],rise:false},
  electric:{cols:['#ffe500','#cc00ff'],sz:[2,5],  lf:[0.3,0.7],rise:false},
  shadow:  {cols:['#6600cc','#aa00ff'],sz:[3,6],  lf:[0.5,1.0],rise:false},
  light:   {cols:['#ffffff','#ffffa0'],sz:[2,5],  lf:[0.4,0.8],rise:false},
  evolve:  {cols:['#ffd700','#ff6b00'],sz:[5,12], lf:[0.9,1.5],rise:false},
  death:   {cols:['#ef4444','#ff8800'],sz:[4,10], lf:[1.0,1.8],rise:false},
};
function mkPart(x,y,type) {
  const c=PCFG[type]||PCFG.fire,a=rnd(0,Math.PI*2),spd=rnd(0.8,3.2);
  const col=c.cols[rndInt(0,c.cols.length-1)],sz=rnd(c.sz[0],c.sz[1]),lf=rnd(c.lf[0],c.lf[1]);
  return {x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-(c.rise?1.2:0),life:lf,maxLife:lf,size:sz,color:col,type};
}
function spawnN(x,y,type,n) { for(let i=0;i<n;i++) particles.push(mkPart(x,y,type)); }
function fPType(form) {
  return {flacarau:'fire',glaciar:'ice',fulgerul:'electric',umbra:'shadow',lumina:'light',neutru:'light',
          inferno:'fire',blizzard:'ice',thundergod:'electric',voidform:'shadow',radiance:'light'}[form]||'death';
}

// ── GAME LOOP ─────────────────────────────────────────────────────
function gameLoop(ts) {
  if(!lastTime) lastTime=ts;
  const dt=Math.min(50,ts-lastTime); lastTime=ts;
  if(gameState==='playing')     { update(dt); render(); renderMinimap(); updateHUD(); }
  else if(gameState==='paused') { render(); renderMinimap(); }
  else if(gameState==='dead')   { updateParticles(dt); render(); }
  else                           { renderBg(); }
  requestAnimationFrame(gameLoop);
}

// ── UPDATE ────────────────────────────────────────────────────────
function update(dt) {
  updatePlayer(dt);
  for(let i=bots.length-1;i>=0;i--) updateBot(bots[i],dt);
  updateBoss(dt);
  updateVortex(dt);
  updateMeteors(dt);
  updateBlackHoles(dt);
  updateCrystals(dt);
  updateParticles(dt);
  updateCamera(dt);
  updateFloatTexts(dt);
  updateShake(dt);
  updateAchPopup(dt);
  checkPrestige();
  checkTimeQuests();
  checkCollisions();
  if(ultraEvoTimer>0) { ultraEvoTimer-=dt; if(ultraEvoTimer<=0) finishUltraEvo(); }
}

function blobSpeed(blob) {
  let s=(blob.speed||3.0)*Math.max(0.35,1-(blob.mass-10)/600);
  const bf=baseForm(blob.form);
  if(WEAKNESS[bf]){
    const wf=WEAKNESS[bf];
    const others=blob.isPlayer?bots:[player,...bots.filter(b=>b!==blob)];
    for(const o of others) if(o&&!o.dead&&baseForm(o.form)===wf&&dist(blob,o)<250){s*=0.8;break;}
  }
  if(frozenBlobs.has(blob)&&Date.now()<frozenBlobs.get(blob)){
    if(blob.form!=='blizzard') return 0; // blizzard immune
  }
  return s;
}

function updatePlayer(dt) {
  if(!player||player.dead) return;
  if(player.abCD>0)    player.abCD-=dt;
  if(player.abTimer>0){ player.abTimer-=dt; if(player.abTimer<=0) player.invisible=false; }
  if(ultraEvoTimer>0) return; // can't move during ultra evo anim

  const spd=blobSpeed(player);
  if(spd>0){
    const dx=mouseX-canvas.width/2, dy=mouseY-canvas.height/2, d=Math.sqrt(dx*dx+dy*dy);
    if(d>12){
      player.x=clamp(player.x+dx/d*spd,50,WORLD-50);
      player.y=clamp(player.y+dy/d*spd,50,WORLD-50);
      const now=Date.now();
      if((player.form==='flacarau'&&player.abTimer>0)||player.form==='inferno'){
        player.trailPts.unshift({x:player.x,y:player.y,exp:now+3000});
        if(Math.random()<0.5) particles.push(mkPart(player.x,player.y,'fire'));
      }
    }
  }
  const now2=Date.now();
  player.trailPts=player.trailPts.filter(p=>p.exp>now2);
  if(player.form==='umbra'||player.form==='voidform') if(Math.random()<0.25) particles.push(mkPart(player.x,player.y,'shadow'));
  if(player.form==='lumina'||player.form==='radiance') if(Math.random()<0.15) particles.push(mkPart(player.x,player.y,'light'));

  if(player.mass>maxMass){
    maxMass=player.mass;
    sessionQuestProgress.max_mass=maxMass;
    for(const q of dailyQuests) if(!q.done&&q.trackKey==='max_mass'&&maxMass>=q.target){ q.progress=q.target; completeQuest(q); }
  }
  eatCrystalsNear(player);
}

function updateBot(bot,dt) {
  if(bot.dead) return;
  const now=Date.now();
  if(frozenBlobs.has(bot)&&now>=frozenBlobs.get(bot)) frozenBlobs.delete(bot);
  const frozen=frozenBlobs.has(bot)&&now<frozenBlobs.get(bot);
  if(bot._blinded&&now>bot._blinded) bot._blinded=0;

  if(bot.abCD>0) bot.abCD-=dt;
  if(bot.abTimer>0){ bot.abTimer-=dt; if(bot.abTimer<=0) bot.invisible=false; }
  bot.trailPts=bot.trailPts.filter(p=>p.exp>now);
  if((bot.form==='umbra'||bot.form==='voidform')&&Math.random()<0.08) particles.push(mkPart(bot.x,bot.y,'shadow'));

  if(!frozen){
    if(bot._blinded) updateBotRandom(bot,dt);
    else if(bot.isAI) updateBotAI(bot,dt);
    else               updateBotRandom(bot,dt);
  }
  if((bot.ep||0)>=EVOLVE_THRESHOLD&&bot.form!=='neutru'&&!FORMS[bot.form].tier){
    bot.form=FORM_KEYS[rndInt(1,5)]; bot.ep=0; spawnN(bot.x,bot.y,'evolve',10);
  }
  eatCrystalsNear(bot);
}

function updateBotRandom(bot,dt) {
  bot.stTimer-=dt;
  if(bot.stTimer<=0){bot.wTgt={x:rnd(100,WORLD-100),y:rnd(100,WORLD-100)};bot.stTimer=rnd(3000,8000);}
  moveTo(bot,bot.wTgt);
  if(bot.abCD<=0&&bot.form!=='neutru'&&Math.random()<0.0008*dt) botAbility(bot);
}
function updateBotAI(bot,dt) {
  bot.stTimer-=dt;
  if(bot.stTimer>0&&bot.state){execState(bot);return;}
  bot.stTimer=rnd(1200,3500);
  const bf=baseForm(bot.form), weak=WEAKNESS[bf], strong=STRENGTH[bf];
  let threat=null;
  if(weak){const all=[player,...bots.filter(b=>b!==bot)];for(const o of all) if(o&&!o.dead&&baseForm(o.form)===weak&&dist(bot,o)<320){threat=o;break;}}
  if(threat){bot.state='flee';bot._aiTgt=threat;}
  else if(strong&&player&&!player.dead&&baseForm(player.form)===strong&&dist(bot,player)<420){bot.state='attack';bot._aiTgt=player;}
  else if(bot.mass>(player?player.mass*1.15:999)&&player&&!player.dead&&dist(bot,player)<380){bot.state='attack';bot._aiTgt=player;}
  else{bot.state='hunt';bot._aiTgt=findNearestCrystal(bot);}
  execState(bot);
}
function execState(bot){
  switch(bot.state){
    case 'flee':
      if(!bot._aiTgt){bot.state='hunt';return;}
      moveTo(bot,{x:clamp(bot.x*2-bot._aiTgt.x,50,WORLD-50),y:clamp(bot.y*2-bot._aiTgt.y,50,WORLD-50)}); break;
    case 'attack':
      if(!bot._aiTgt||bot._aiTgt.dead){bot.state='hunt';return;}
      moveTo(bot,bot._aiTgt);
      if(bot.abCD<=0&&dist(bot,bot._aiTgt)<220) botAbility(bot); break;
    case 'hunt':
      if(!bot._aiTgt||bot._aiTgt.eaten) bot._aiTgt=findNearestCrystal(bot);
      moveTo(bot,bot._aiTgt||bot.wTgt||{x:WORLD/2,y:WORLD/2}); break;
    default: moveTo(bot,bot.wTgt||{x:WORLD/2,y:WORLD/2});
  }
}
function moveTo(bot,tgt){
  if(!tgt) return;
  const dx=tgt.x-bot.x,dy=tgt.y-bot.y,d=Math.sqrt(dx*dx+dy*dy);
  if(d<4) return;
  const spd=blobSpeed(bot); if(!spd) return;
  bot.x=clamp(bot.x+dx/d*spd,50,WORLD-50); bot.y=clamp(bot.y+dy/d*spd,50,WORLD-50);
  if((bot.form==='flacarau'&&bot.abTimer>0)||bot.form==='inferno'){
    bot.trailPts.unshift({x:bot.x,y:bot.y,exp:Date.now()+3000});
    if(Math.random()<0.25) particles.push(mkPart(bot.x,bot.y,'fire'));
  }
}
function findNearestCrystal(blob){
  let best=null,bd=Infinity;
  for(const c of gQuery(blob.x,blob.y,700)) if(c.isCrystal&&!c.eaten){const d=dist2(blob,c);if(d<bd){bd=d;best=c;}}
  return best;
}
function botAbility(bot){
  const f=FORMS[bot.form]; if(!f.ability||bot.abCD>0) return;
  bot.abCD=f.cooldown; bot.abTimer=f.abilityDur; execAbility(bot,f.ability);
}

// ── BOSS SYSTEM ───────────────────────────────────────────────────
function updateBoss(dt) {
  if(boss===null){
    bossTimer-=dt;
    if(bossTimer<=0){spawnBoss();bossTimer=180000;}
    return;
  }
  // Enrage handled by HP (see hitBoss)
  // Move toward nearest blob
  let target=null,bd=Infinity;
  for(const b of [player,...bots]) if(b&&!b.dead){const d=dist2(boss,b);if(d<bd){bd=d;target=b;}}
  if(target){const dx=target.x-boss.x,dy=target.y-boss.y,d=Math.sqrt(dx*dx+dy*dy)||1; boss.x=clamp(boss.x+dx/d*boss.speed,50,WORLD-50); boss.y=clamp(boss.y+dy/d*boss.speed,50,WORLD-50);}
  if(boss.abCD>0) boss.abCD-=dt; else if(target&&dist(boss,target)<300){botAbility(boss);boss.abCD=8000;}
  updateBossHPBar();
}
function spawnBoss(){
  const form=FORM_KEYS[rndInt(1,5)];
  boss={ x:rnd(200,WORLD-200), y:rnd(200,WORLD-200), mass:500, hp:3, maxHp:3, form, enraged:false, speed:2.8, abCD:0, abTimer:0, trailPts:[], ep:0, invisible:false, dead:false, name:'BOSS', isBot:true, _lastHit:0 };
  showBanner(`👹 BOSS ${FORMS[form].name.toUpperCase()} APPEARED!`,4000);
  showGameFlash('rgba(239,68,68,0.3)',600);
  triggerShake(10,500);
  snd('boss');
  updateBossHPBar();
}
function hitBoss(attacker){
  const now=Date.now();
  if(now-boss._lastHit<600) return;
  boss._lastHit=now; boss.hp--; boss.mass=Math.max(200,boss.mass*0.85);
  snd('enemy_hit');
  spawnN(boss.x,boss.y,fPType(boss.form),10); triggerShake(6,300);
  if(attacker.isPlayer){ player.mass+=30; player.ep=(player.ep||0)+20; addFloat(player.x,player.y,'+30','#4ade80'); }
  if(boss.hp===1&&!boss.enraged){ boss.enraged=true; boss.mass=Math.max(boss.mass,1000); boss.speed=4.5; showBanner('💢 BOSS ENRAGED!',3000); triggerShake(12,500); snd('boss_warning'); }
  updateBossHPBar();
  if(boss.hp<=0) killBoss(attacker);
}
function killBoss(killer){
  spawnN(boss.x,boss.y,'evolve',30); spawnN(boss.x,boss.y,fPType(boss.form),20);
  triggerShake(18,700); showBanner('💀 BOSS DEFEATED!',4000); showGameFlash('rgba(255,200,0,0.35)',500); snd('jackpot');
  for(let i=0;i<20;i++){ const a=(i/20)*Math.PI*2,r=rnd(30,130); spawnCrystalAt(boss.x+Math.cos(a)*r,boss.y+Math.sin(a)*r,'rare'); }
  if(killer.isPlayer){
    player.mass+=200; addFloat(player.x,player.y,'+200 MASS!','#ffd700');
    incrementQuest('bosses_killed',1); checkAch('boss_slayer');
    bossKillCount++; localStorage.setItem('blobevo_bosses_killed',bossKillCount);
  } else { killer.mass+=200; }
  for(const b of [player,...bots]){
    if(!b||b.dead||b===killer) continue;
    if(dist(b,boss)<400){ b.mass+=50; if(b.isPlayer) addFloat(player.x,player.y,'+50 ASSIST!','#06b6d4'); }
  }
  boss=null;
  document.getElementById('boss-hpbar').classList.add('hidden');
}
function updateBossHPBar(){
  const el=document.getElementById('boss-hpbar');
  if(!boss){el.classList.add('hidden');return;}
  el.classList.remove('hidden');
  document.getElementById('boss-form-icon').textContent=FORMS[boss.form].emoji;
  document.getElementById('boss-hp-name').textContent=`BOSS ${FORMS[boss.form].name}${boss.enraged?' 🔥ENRAGED':''}`;
  document.getElementById('boss-hp-fill').style.width=(boss.hp/boss.maxHp*100)+'%';
  document.getElementById('boss-hp-fill').style.background=boss.enraged?'linear-gradient(90deg,#ff0000,#ff6600)':'linear-gradient(90deg,#ef4444,#fbbf24)';
  document.getElementById('boss-hp-hits').textContent='❤️'.repeat(boss.hp)+'🖤'.repeat(boss.maxHp-boss.hp);
}

// ── VORTEX SYSTEM ─────────────────────────────────────────────────
function updateVortex(dt){
  if(!vortex){ vortexTimer-=dt; if(vortexTimer<=0){spawnVortex();vortexTimer=300000;} return; }
  vortex.timer-=dt;
  if(vortex.phase==='warning'){
    if(vortex.timer<=0){vortex.phase='active';vortex.timer=30000;showBanner('🌀 VORTEX ACTIVE!',2500);}
    return;
  }
  // Active: pull all blobs
  const all=[player,...bots].filter(b=>b&&!b.dead);
  for(const b of all){
    const dx=vortex.x-b.x,dy=vortex.y-b.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    if(d<vortex.radius){
      const pull=Math.max(0.3,3.0/Math.sqrt(b.mass));
      b.x=clamp(b.x+dx/d*pull,50,WORLD-50); b.y=clamp(b.y+dy/d*pull,50,WORLD-50);
      if(d<55){
        const now=Date.now();
        if(!b._vortexT||now-b._vortexT>3000){
          b._vortexT=now; b.mass=Math.max(5,b.mass*0.8); b.ep=(b.ep||0)+100;
          if(b.isPlayer){addFloat(b.x,b.y,'+100 EP!','#00ffff');addFloat(b.x,b.y-24,'-20% MASS','#ff6600');checkAch('vortex_survivor');}
        }
      }
    }
  }
  if(vortex.timer<=0) explodeVortex();
}
function spawnVortex(){
  vortex={x:rnd(300,WORLD-300),y:rnd(300,WORLD-300),radius:400,phase:'warning',timer:10000};
  showBanner('⚠️ VORTEX FORMING!',8000);
  snd('boss_warning');
}
function explodeVortex(){
  const all=[player,...bots].filter(b=>b&&!b.dead);
  for(const b of all){const dx=b.x-vortex.x,dy=b.y-vortex.y,d=Math.sqrt(dx*dx+dy*dy)||1;if(d<vortex.radius){const f=80*(1-d/vortex.radius);b.x=clamp(b.x+dx/d*f,50,WORLD-50);b.y=clamp(b.y+dy/d*f,50,WORLD-50);}}
  for(let i=0;i<30;i++){const a=(i/30)*Math.PI*2,r=rnd(50,200);spawnCrystalAt(vortex.x+Math.cos(a)*r,vortex.y+Math.sin(a)*r,'rare');}
  spawnN(vortex.x,vortex.y,'evolve',40); triggerShake(20,800); showBanner('💥 VORTEX EXPLODED!',3000); showGameFlash('rgba(0,200,255,0.4)',500); snd('airstrike');
  vortex=null;
}

// ── METEOR SYSTEM ─────────────────────────────────────────────────
function updateMeteors(dt){
  if(!meteorShowerActive){meteorTimer-=dt;if(meteorTimer<=0){startMeteorShower();meteorTimer=240000;}return;}
  meteorShowerSpawnT-=dt;
  if(meteorShowerSpawnT<=0&&meteorShowerCount>0){spawnMeteor();meteorShowerCount--;meteorShowerSpawnT=rnd(500,1500);}
  for(let i=meteors.length-1;i>=0;i--){
    const m=meteors[i]; m.warnTimer-=dt;
    if(m.warnTimer<=0&&!m.impacted) impactMeteor(m);
    if(m.impacted){m.impactTimer-=dt;if(m.impactTimer<=0) meteors.splice(i,1);}
  }
  if(meteorShowerCount===0&&meteors.every(m=>m.impacted)) meteorShowerActive=false;
}
function startMeteorShower(){
  meteorShowerActive=true; meteorShowerCount=rndInt(10,15); meteorShowerSpawnT=0;
  showBanner('☄️ METEOR SHOWER INCOMING!',5000);
  snd('wave_start');
}
function spawnMeteor(){
  meteors.push({targetX:rnd(100,WORLD-100),targetY:rnd(100,WORLD-100),warnTimer:2000,impacted:false,impactTimer:800});
}
function impactMeteor(m){
  m.impacted=true; m.impactTimer=800;
  for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2,r=rnd(20,60);spawnCrystalAt(m.targetX+Math.cos(a)*r,m.targetY+Math.sin(a)*r,'rare');}
  triggerShake(8,300); showGameFlash('rgba(255,100,0,0.22)',200); spawnN(m.targetX,m.targetY,'fire',15); snd('shot_fire');
  const all=[player,...bots].filter(b=>b&&!b.dead);
  for(const b of all){
    if(dist(b,{x:m.targetX,y:m.targetY})<80){
      if(b.mass>=100){b.mass+=50;if(b.isPlayer){addFloat(b.x,b.y,'+50 ABSORBED!','#ffd700');checkAch('meteor_magnet');incrementQuest('meteor_absorbed',1);}}
      else{const dmg=b.mass*0.30;b.mass=Math.max(5,b.mass-dmg);if(b.isPlayer){addFloat(b.x,b.y,`-${Math.floor(dmg)} ☄️`,'#ff4500');triggerShake(10,400);}}
    }
  }
}

// ── BLACK HOLES ───────────────────────────────────────────────────
function updateBlackHoles(dt){
  for(let i=blackHoles.length-1;i>=0;i--){
    const bh=blackHoles[i]; bh.duration-=dt;
    const all=[player,...bots].filter(b=>b&&!b.dead&&b!==bh.owner);
    for(const b of all){
      const dx=bh.x-b.x,dy=bh.y-b.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      if(d<bh.radius){
        const pull=2.2*(1-d/bh.radius); b.x=clamp(b.x+dx/d*pull,50,WORLD-50); b.y=clamp(b.y+dy/d*pull,50,WORLD-50);
        const drain=b.mass*0.05*(dt/1000); b.mass=Math.max(5,b.mass-drain);
        if(b.isPlayer&&Math.random()<0.08) addFloat(b.x,b.y-mToR(b.mass),`-${Math.ceil(drain)}`,'#8800cc');
      }
    }
    if(bh.duration<=0) blackHoles.splice(i,1);
  }
}

// ── CRYSTAL EATING ────────────────────────────────────────────────
function eatCrystalsNear(blob){
  const r=mToR(blob.mass);
  for(const c of gQuery(blob.x,blob.y,r+20)) if(c.isCrystal&&!c.eaten&&dist(blob,c)<r+c.size*0.8) eatCrystal(blob,c);
}
function eatCrystal(blob,c){
  if(c.eaten) return;
  blob.mass+=c.mass; spawnN(c.x,c.y,fPType(c.form||'neutru'),4);
  if(blob.isPlayer){ incrementQuest('crystals_eaten',1); snd('crystal'); }
  if(c.type==='chaos'){
    spawnN(c.x,c.y,'evolve',6);
    const nf=FORM_KEYS[rndInt(1,5)];
    if(blob.isPlayer) triggerEvo(blob,nf); else{blob.form=nf;blob.ep=0;}
  } else if(c.form){
    if(blob.form==='neutru'||baseForm(blob.form)===c.form||blob.form===c.form){
      blob.ep=(blob.ep||0)+(c.type==='rare'?3:1);
      if(blob.isPlayer&&blob.ep>=EVOLVE_THRESHOLD) checkPlayerEvo();
    }
  }
  removeCrystal(c);
}
function checkPlayerEvo(){
  if(!player||player.dead||player.ep<EVOLVE_THRESHOLD) return;
  if(FORMS[player.form].tier===2) { player.ep=0; return; } // ultra forms don't re-evo this way
  const opts=FORM_KEYS.filter(f=>f!=='neutru'&&f!==player.form);
  triggerEvo(player,opts[rndInt(0,opts.length-1)]);
}
function triggerEvo(blob,newForm){
  blob.form=newForm; blob.ep=0; spawnN(blob.x,blob.y,'evolve',30);
  if(!blob.isPlayer) return;
  snd('levelup');
  const fd=FORMS[newForm];
  document.getElementById('evo-form-name').textContent=fd.name+' '+fd.emoji;
  const fl=document.getElementById('evo-flash');
  fl.classList.remove('hidden'); fl.style.animation='none'; void fl.offsetHeight; fl.style.animation='';
  setTimeout(()=>fl.classList.add('hidden'),2200);
  document.getElementById('ability-bar').style.borderColor=fd.color+'90';
  document.getElementById('elem-progress').style.background=`linear-gradient(90deg,${fd.color},${fd.color2})`;
  checkFormsAch();
}

// ── ULTRA EVOLUTION ───────────────────────────────────────────────
function tryUltraEvo(){
  if(!player||player.dead||ultraEvoTimer>0) return;
  const ultra=ULTRA_MAP[player.form];
  if(!ultra) return;
  if(player.mass<500) { addFloat(player.x,player.y,'Need 500 mass!','#ff6600'); return; }
  ultraEvoTimer=3000; ultraEvoTarget=ultra;
  showBanner('⚡ ULTRA EVOLVING...',3500);
  showGameFlash('rgba(255,215,0,0.2)',3000);
  document.getElementById('ultra-avail').classList.add('hidden');
}
function finishUltraEvo(){
  if(!player||player.dead||!ultraEvoTarget) return;
  const fd=FORMS[ultraEvoTarget];
  player.form=ultraEvoTarget; player.ep=0; player.abCD=0;
  spawnN(player.x,player.y,'evolve',50); triggerShake(18,800);
  showGameFlash('rgba(255,215,0,0.55)',700);
  document.getElementById('evo-form-name').textContent=fd.name+' '+fd.emoji;
  const fl=document.getElementById('evo-flash');
  fl.classList.remove('hidden'); fl.style.animation='none'; void fl.offsetHeight; fl.style.animation='';
  setTimeout(()=>fl.classList.add('hidden'),2200);
  document.getElementById('ability-bar').style.borderColor=fd.color+'90';
  incrementQuest('ultra_evolved',1); checkAch('ultra_evolved');
  snd('evolve');
  ultraEvoTarget=null;
}

// ── DAILY QUEST SYSTEM ────────────────────────────────────────────
function initDailyQuests(){
  const today=new Date().toISOString().slice(0,10);
  const saved=JSON.parse(localStorage.getItem('blobevo_daily_progress')||'{}');
  if(saved.date===today&&saved.quests){
    dailyQuests=saved.quests; return;
  }
  const seed=parseInt(today.replace(/-/g,''))%1000000;
  const idx1=seed%QUEST_POOL.length;
  let idx2=(seed*7+3)%QUEST_POOL.length; if(idx2===idx1) idx2=(idx2+1)%QUEST_POOL.length;
  dailyQuests=[{...QUEST_POOL[idx1],progress:0,done:false},{...QUEST_POOL[idx2],progress:0,done:false}];
  localStorage.setItem('blobevo_daily_progress',JSON.stringify({date:today,quests:dailyQuests}));
}
function saveDailyQuests(){
  const today=new Date().toISOString().slice(0,10);
  localStorage.setItem('blobevo_daily_progress',JSON.stringify({date:today,quests:dailyQuests}));
}
function incrementQuest(trackKey,amount){
  let changed=false;
  for(const q of dailyQuests){
    if(!q.done&&q.trackKey===trackKey){
      q.progress=Math.min(q.target,(q.progress||0)+amount);
      if(q.progress>=q.target) completeQuest(q);
      changed=true;
    }
  }
  if(changed){ saveDailyQuests(); updateQuestPanel(); }
}
function checkTimeQuests(){
  if(!gameTime) return;
  const elapsed=Math.floor((Date.now()-gameTime-totalPauseDur)/1000);
  let changed=false;
  for(const q of dailyQuests){
    if(!q.done&&q.trackKey==='time_alive'){
      const prev=q.progress||0; q.progress=Math.min(q.target,elapsed);
      if(q.progress>prev) changed=true;
      if(q.progress>=q.target) { completeQuest(q); changed=true; }
    }
  }
  if(changed){ saveDailyQuests(); updateQuestPanel(); }
}
function completeQuest(q){
  if(q.done) return; q.done=true;
  const coinKey=`u2048_coins_${nickname}`;
  const coins=parseInt(localStorage.getItem(coinKey)||'0')+q.reward.coins;
  localStorage.setItem(coinKey,coins);
  const xp=Math.floor(q.reward.xp*xpMultiplier);
  const portalXP=parseInt(localStorage.getItem('portal_xp')||'0')+xp;
  localStorage.setItem('portal_xp',portalXP);
  if(player&&!player.dead) addFloat(canvas.width/2/camera.zoom+camera.x,canvas.height/2/camera.zoom+camera.y-80,`✓ QUEST! +${q.reward.coins}🪙 +${xp}XP`,'#ffd700');
  showBanner(`✅ QUEST DONE! +${q.reward.coins}🪙 +${xp}XP`,3500);
  snd('success');
  updateQuestPanel();
}
function updateQuestPanel(){
  const list=document.getElementById('quest-list'); if(!list) return;
  list.innerHTML='';
  for(const q of dailyQuests){
    const pct=Math.min(100,(q.progress||0)/q.target*100);
    const div=document.createElement('div');
    div.className='quest-item'+(q.done?' done':'');
    div.innerHTML=`<div class="quest-name">${q.done?'✓':'○'} ${q.desc}</div><div class="quest-bar-bg"><div class="quest-bar-fill" style="width:${pct}%"></div></div><div class="quest-count">${Math.min(q.progress||0,q.target)}/${q.target} · +${q.reward.coins}🪙 +${q.reward.xp}XP</div>`;
    list.appendChild(div);
  }
}

// ── PRESTIGE SYSTEM ───────────────────────────────────────────────
function checkPrestige(){
  const el=document.getElementById('prestige-btn-wrap');
  if(player&&!player.dead&&player.mass>=10000&&prestigeLevel<3) el.classList.remove('hidden');
  else el.classList.add('hidden');
}
function showPrestigePopup(){
  const mults=['×1.5','×2','×3'];
  const badges=['⭐','⭐⭐','⭐⭐⭐'];
  const next=prestigeLevel+1;
  document.getElementById('prestige-popup-icon').textContent=badges[Math.min(next-1,2)];
  document.getElementById('prestige-rewards').textContent=`XP Multiplier: ${mults[Math.min(next-1,2)]} · Badge: ${badges[Math.min(next-1,2)]} P${next}`;
  document.getElementById('prestige-popup').classList.remove('hidden');
}
function doPrestige(){
  document.getElementById('prestige-popup').classList.add('hidden');
  if(!player||player.dead) return;
  prestigeLevel=Math.min(3,prestigeLevel+1);
  xpMultiplier=[1,1.5,2,3][prestigeLevel];
  const xp=Math.floor(400*xpMultiplier);
  const portalXP=parseInt(localStorage.getItem('portal_xp')||'0')+xp;
  localStorage.setItem('portal_xp',portalXP);
  localStorage.setItem('blobevo_prestige',prestigeLevel);
  player.mass=10; player.form='neutru'; player.ep=0; player.abCD=0; player.abTimer=0; player.invisible=false;
  maxMass=10; spawnN(player.x,player.y,'evolve',40);
  triggerShake(15,600); showGameFlash('rgba(255,215,0,0.5)',700);
  showBanner(`⭐ PRESTIGE ${prestigeLevel}! ×${xpMultiplier} XP`,4000);
  addFloat(player.x,player.y,`⭐ PRESTIGE ${prestigeLevel}!`,'#ffd700');
  if(prestigeLevel===1) checkAch('prestige_1');
}

// ── ACHIEVEMENT SYSTEM ────────────────────────────────────────────
function checkAch(id){
  if(achsDone.has(id)) return;
  const ach=BLOB_ACHS.find(a=>a.id===id); if(!ach) return;
  achsDone.add(id);
  localStorage.setItem('blobevo_achs',JSON.stringify([...achsDone]));
  const xp=Math.floor(ach.xp*xpMultiplier);
  const portalXP=parseInt(localStorage.getItem('portal_xp')||'0')+xp;
  localStorage.setItem('portal_xp',portalXP);
  achPopupQueue.push({...ach,xpActual:xp});
  snd('achievement');
}
function checkFormsAch(){
  const unlocked=JSON.parse(localStorage.getItem('blobevo_forms_unlocked')||'["neutru"]');
  if(!unlocked.includes(player.form)){ unlocked.push(player.form); localStorage.setItem('blobevo_forms_unlocked',JSON.stringify(unlocked)); }
  if(unlocked.length>=6) checkAch('element_master');
}
function updateAchPopup(dt){
  if(achPopupTimer>0){ achPopupTimer-=dt; return; }
  const el=document.getElementById('ach-popup');
  if(achPopupQueue.length>0){
    const ach=achPopupQueue.shift();
    document.getElementById('ach-popup-icon').textContent=ach.emoji||'🏆';
    document.getElementById('ach-popup-name').textContent=ach.name;
    document.getElementById('ach-popup-xp').textContent=`+${ach.xpActual} XP`;
    el.classList.remove('hidden','ach-popup-leave');
    achPopupTimer=3500;
  } else {
    if(!el.classList.contains('hidden')&&!el.classList.contains('ach-popup-leave')){
      el.classList.add('ach-popup-leave');
      setTimeout(()=>el.classList.add('hidden'),400);
    }
  }
}

// ── VISUAL EFFECTS ────────────────────────────────────────────────
function addFloat(x,y,text,color='#ffffff'){
  floatTexts.push({x,y,text,color,life:1.8,maxLife:1.8,vy:-1.2});
}
function updateFloatTexts(dt){
  for(let i=floatTexts.length-1;i>=0;i--){
    const f=floatTexts[i]; f.life-=dt/1000; f.y+=f.vy;
    if(f.life<=0) floatTexts.splice(i,1);
  }
}
function triggerShake(mag,dur){ if(mag>shakeMag||shakeTimer<=0){shakeMag=mag;shakeTimer=dur;} }
function updateShake(dt){ if(shakeTimer>0) shakeTimer-=dt; else shakeMag=0; }
function showBanner(text,dur=3000){
  clearTimeout(_bannerTimeout);
  const b=document.getElementById('event-banner'); b.classList.remove('hidden');
  document.getElementById('event-banner-text').textContent=text;
  _bannerTimeout=setTimeout(()=>b.classList.add('hidden'),dur);
}
function showGameFlash(color,dur){
  const el=document.getElementById('game-flash');
  el.style.background=color; el.style.opacity='1';
  el.style.transition='none'; void el.offsetHeight;
  el.style.transition=`opacity ${dur}ms ease`;
  el.style.opacity='0';
}

// ── COLLISIONS ────────────────────────────────────────────────────
function checkCollisions(){
  const now=Date.now();
  const allB=[player,...bots];
  // Fire/Inferno trail damage
  for(const att of allB){
    if(!att||att.dead||(att.form!=='flacarau'&&att.form!=='inferno')) continue;
    if(att.form==='flacarau'&&att.abTimer<=0) continue;
    if(!att.trailPts.length) continue;
    for(const vic of allB){
      if(!vic||vic===att||vic.dead) continue;
      const vr2=mToR(vic.mass)**2;
      for(const tp of att.trailPts){
        const dx=vic.x-tp.x,dy=vic.y-tp.y;
        if(dx*dx+dy*dy<vr2*0.6){
          if(now-vic._trailDmgT>500){ vic.mass=Math.max(5,vic.mass*0.8); vic._trailDmgT=now; spawnN(vic.x,vic.y,'fire',3); if(vic.isPlayer){addFloat(vic.x,vic.y,'-BURN','#ff4500');} }
          break;
        }
      }
    }
  }
  // Player vs bots
  if(player&&!player.dead){
    const pr=mToR(player.mass);
    for(let i=bots.length-1;i>=0;i--){
      const b=bots[i]; if(b.dead||b.invisible) continue;
      if(dist(player,b)<pr+mToR(b.mass)){
        if(canEat(player,b)){eatBlob(player,b);botsEaten++;incrementQuest('blobs_eaten',1);bots.splice(i,1);setTimeout(()=>{if(gameState==='playing')respawnBot();},rnd(5000,14000));checkPlayerEvo();}
        else if(!player.invisible&&canEat(b,player)){playerDead(b.name);return;}
      }
    }
    // Player vs boss
    if(boss){
      if(dist(player,boss)<pr+mToR(boss.mass)){
        if(canEat(player,boss)&&player.mass>boss.mass*0.25) hitBoss(player);
        else if(!player.invisible&&canEat(boss,player)) {playerDead(boss.name);return;}
      }
    }
  }
  // Bot vs bot
  for(let i=0;i<bots.length;i++){
    const a=bots[i]; if(a.dead||a.invisible) continue;
    for(let j=i+1;j<bots.length;j++){
      const b=bots[j]; if(b.dead||b.invisible) continue;
      if(dist(a,b)<mToR(a.mass)+mToR(b.mass)){
        if(canEat(a,b)){eatBlob(a,b);bots.splice(j,1);j--;setTimeout(()=>{if(gameState==='playing')respawnBot();},rnd(5000,14000));}
        else if(canEat(b,a)){eatBlob(b,a);bots.splice(i,1);i--;setTimeout(()=>{if(gameState==='playing')respawnBot();},rnd(5000,14000));break;}
      }
    }
  }
  // Bot vs boss
  if(boss){
    for(let i=bots.length-1;i>=0;i--){
      const b=bots[i]; if(b.dead||b.invisible) continue;
      if(dist(b,boss)<mToR(b.mass)+mToR(boss.mass)){
        if(canEat(b,boss)&&b.mass>boss.mass*0.25) hitBoss(b);
        else if(canEat(boss,b)){eatBlob(boss,b);bots.splice(i,1);setTimeout(()=>{if(gameState==='playing')respawnBot();},rnd(5000,14000));}
      }
    }
  }
}

function canEat(eater,prey){
  const ef=baseForm(eater.form),pf=baseForm(prey.form);
  if(STRENGTH[ef]===pf) return eater.mass>prey.mass*0.75;
  if(WEAKNESS[ef]===pf) return eater.mass>prey.mass*1.5;
  return eater.mass>prey.mass*0.88;
}
function eatBlob(eater,prey){ eater.mass+=prey.mass*0.65; eater.ep=(eater.ep||0)+5; spawnN(prey.x,prey.y,fPType(prey.form),14); if(eater.isPlayer){ addFloat(prey.x,prey.y,`+${Math.floor(prey.mass*0.65)}`,'#4ade80'); snd('eat'); } }
function respawnBot(){
  const form=FORM_KEYS[rndInt(0,5)];
  const b=mkBlob(rnd(100,WORLD-100),rnd(100,WORLD-100),rnd(8,22),form,false);
  b.name=BOT_NAMES[rndInt(0,19)];b.speed=rnd(2.0,3.2);b.isAI=Math.random()<0.5;b.state='wander';b.stTimer=rnd(2000,6000);b.wTgt={x:rnd(100,WORLD-100),y:rnd(100,WORLD-100)};
  bots.push(b);
}

function playerDead(killedBy){
  if(!player||player.dead) return;
  player.dead=true; gameState='dead';
  spawnN(player.x,player.y,fPType(player.form),40);
  const elapsed=Date.now()-gameTime-totalPauseDur;
  const isNew=maxMass>bestMass;
  if(isNew){bestMass=maxMass;localStorage.setItem('blobevo_best',bestMass);}
  const g=(parseInt(localStorage.getItem('blobevo_games'))||0)+1;
  localStorage.setItem('blobevo_games',g);
  localStorage.setItem('blobevo_total_time',(parseInt(localStorage.getItem('blobevo_total_time'))||0)+Math.floor(elapsed/1000));
  localStorage.setItem('blobevo_total_time_ms',(parseInt(localStorage.getItem('blobevo_total_time_ms'))||0)+elapsed);
  snd('gameover');
  if(elapsed>=300000) localStorage.setItem('blobevo_survived_5min','1');
  if(elapsed>=600000) checkAch('untouchable');
  if(player.form!=='neutru') localStorage.setItem('blobevo_best_form',player.form);
  const unlocked=JSON.parse(localStorage.getItem('blobevo_forms_unlocked')||'["neutru"]');
  if(!unlocked.includes(player.form)){unlocked.push(player.form);localStorage.setItem('blobevo_forms_unlocked',JSON.stringify(unlocked));}
  const lb=JSON.parse(localStorage.getItem('blobLeaderboard')||'[]');
  const ei=lb.findIndex(e=>e.name===nickname);if(ei>=0)lb.splice(ei,1);
  lb.push({name:nickname,score:Math.floor(maxMass),form:player.form});
  lb.sort((a,b)=>b.score-a.score);lb.splice(10);
  localStorage.setItem('blobLeaderboard',JSON.stringify(lb));
  for(const id of ['hud','elem-bar','ws-panel','hud-lb','ability-bar','minimap','quest-panel','boss-hpbar','ultra-avail','prestige-btn-wrap'])
    document.getElementById(id).classList.add('hidden');
  boss=null; vortex=null;
  setTimeout(()=>{
    document.getElementById('go-mass').textContent=Math.floor(maxMass);
    document.getElementById('go-form').textContent=FORMS[player.form].emoji+' '+FORMS[player.form].name;
    document.getElementById('go-time').textContent=fmtT(elapsed);
    document.getElementById('go-eaten').textContent=botsEaten;
    const nb=document.getElementById('go-newbest');
    if(isNew) nb.classList.remove('hidden'); else nb.classList.add('hidden');
    document.getElementById('gameover').classList.remove('hidden');
  },1600);
}

function pauseGame(){ if(gameState!=='playing')return; gameState='paused'; pauseStart=Date.now(); document.getElementById('pause-screen').classList.remove('hidden'); }
function resumeGame(){ if(gameState!=='paused')return; totalPauseDur+=Date.now()-pauseStart; gameState='playing'; document.getElementById('pause-screen').classList.add('hidden'); }

// ── CRYSTAL & PARTICLE UPDATE ─────────────────────────────────────
function updateCrystals(dt){
  const now=Date.now();
  for(const c of crystals){
    c.angle+=c.rotSpd; c.pulse+=0.05;
    if(c.attractedUntil>now){
      let src=null;
      if(player&&!player.dead&&(player.form==='lumina'||player.form==='radiance')&&(player.abTimer>0||player.form==='radiance')&&dist(player,c)<500) src=player;
      if(!src) for(const b of bots) if(!b.dead&&(b.form==='lumina'||b.form==='radiance')&&b.abTimer>0&&dist(b,c)<500){src=b;break;}
      if(src){const dx=src.x-c.x,dy=src.y-c.y,d=Math.sqrt(dx*dx+dy*dy)||1;gMove(c,c.x+dx/d*3,c.y+dy/d*3);}
    }
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy;
    if(p.type==='fire') p.vy-=0.06; p.vx*=0.97; p.vy*=0.97; p.life-=dt/(p.maxLife*1000);
    if(p.life<=0) particles.splice(i,1);
  }
}
function updateCamera(dt){
  if(!player||player.dead) return;
  camera.x+=(player.x-camera.x)*0.1; camera.y+=(player.y-camera.y)*0.1;
  const tz=Math.max(0.22,Math.min(1.0,canvas.height/(mToR(player.mass)*22)));
  camera.zoom+=(tz-camera.zoom)*0.05;
}

// ── RENDER ────────────────────────────────────────────────────────
let _bgT=0;
function renderBg(){
  ctx.fillStyle='#020208'; ctx.fillRect(0,0,canvas.width,canvas.height);
  _bgT+=0.008;
  for(const layer of starLayers){
    for(const s of layer.stars){
      const sx=((s.x+(camera?camera.x/WORLD:0)*layer.spd*0.25)%1)*canvas.width;
      const sy=((s.y+(camera?camera.y/WORLD:0)*layer.spd*0.25)%1)*canvas.height;
      const b=s.b*(0.65+0.35*Math.sin(_bgT+s.tw));
      ctx.fillStyle=`rgba(255,255,255,${b.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2); ctx.fill();
    }
  }
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  renderBg();
  // Screen shake
  let sx=0,sy=0;
  if(shakeTimer>0){const m=shakeMag*(shakeTimer>200?1:shakeTimer/200);sx=(Math.random()-0.5)*m;sy=(Math.random()-0.5)*m;}
  ctx.save();
  ctx.translate(canvas.width/2+sx,canvas.height/2+sy);
  ctx.scale(camera.zoom,camera.zoom);
  ctx.translate(-camera.x,-camera.y);
  // World border + grid
  ctx.strokeStyle='rgba(6,182,212,0.18)'; ctx.lineWidth=5; ctx.strokeRect(0,0,WORLD,WORLD);
  ctx.strokeStyle='rgba(255,255,255,0.025)'; ctx.lineWidth=1;
  for(let x=0;x<=WORLD;x+=250){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD);ctx.stroke();}
  for(let y=0;y<=WORLD;y+=250){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD,y);ctx.stroke();}
  renderParticles();
  renderCrystals();
  renderVortex();
  renderMeteors();
  renderTrails();
  renderBlackHoles();
  for(const b of bots) if(!b.dead) renderBlob(b);
  if(boss) renderBoss();
  if(player&&!player.dead) renderBlob(player);
  renderFreezeRings();
  renderChainLightning();
  renderFloatTexts();
  ctx.restore();
}

function renderParticles(){
  for(const p of particles){const a=Math.max(0,p.life);ctx.globalAlpha=a;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0.5,p.size*a),0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.shadowBlur=0;
}

function renderCrystals(){
  const now=Date.now();
  for(const c of crystals){
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);
    const pf=0.82+0.18*Math.sin(c.pulse);
    if(c.type==='chaos'){const hue=(now/18)%360;ctx.shadowColor=`hsl(${hue},100%,65%)`;ctx.shadowBlur=14;drawCrystal(ctx,c.size*pf,`hsl(${hue},100%,75%)`,2);drawCrystal(ctx,c.size*pf*0.55,`hsl(${(hue+150)%360},100%,75%)`,1.2);}
    else if(c.type==='rare'){ctx.shadowColor=c.color;ctx.shadowBlur=18;drawCrystal(ctx,c.size*pf,c.color2,2.5);drawCrystal(ctx,c.size*pf*0.5,c.color,1.5);}
    else{ctx.shadowColor=c.color;ctx.shadowBlur=8;drawCrystal(ctx,c.size*pf,c.color,1.5);}
    ctx.shadowBlur=0;ctx.restore();
  }
}
function drawCrystal(ctx,size,color,lw){
  ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.beginPath();
  for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2,r=i%2===0?size:size*0.55;if(i===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  ctx.closePath();ctx.stroke();
}

function renderVortex(){
  if(!vortex) return;
  const now=Date.now();
  if(vortex.phase==='warning'){
    const pulse=0.5+0.5*Math.sin(now/200);
    ctx.strokeStyle=`rgba(0,200,255,${0.25+pulse*0.3})`;ctx.lineWidth=4;ctx.shadowColor='#00cfff';ctx.shadowBlur=20;
    ctx.setLineDash([15,10]);
    ctx.beginPath();ctx.arc(vortex.x,vortex.y,vortex.radius,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);ctx.shadowBlur=0;
  } else {
    const t=now/500;
    ctx.fillStyle='rgba(0,100,200,0.08)';ctx.beginPath();ctx.arc(vortex.x,vortex.y,vortex.radius,0,Math.PI*2);ctx.fill();
    for(let ring=0;ring<4;ring++){
      ctx.strokeStyle=`rgba(0,${150+ring*25},255,${0.12+ring*0.08})`;ctx.lineWidth=1.5-ring*0.3;
      ctx.beginPath();
      for(let a=0;a<=Math.PI*6;a+=0.08){const r=vortex.radius*(0.15+ring*0.28)*(a/(Math.PI*6));ctx.lineTo(vortex.x+Math.cos(a-t)*r,vortex.y+Math.sin(a-t)*r);}
      ctx.stroke();
    }
    ctx.shadowColor='#00cfff';ctx.shadowBlur=30;ctx.fillStyle='rgba(0,200,255,0.5)';
    ctx.beginPath();ctx.arc(vortex.x,vortex.y,28,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
}

function renderMeteors(){
  for(const m of meteors){
    if(m.impacted){
      const a=Math.max(0,m.impactTimer/800);
      ctx.globalAlpha=a*0.9;ctx.fillStyle='#ff8800';ctx.shadowColor='#ff8800';ctx.shadowBlur=30;
      ctx.beginPath();ctx.arc(m.targetX,m.targetY,50*(1-a)+5,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    } else {
      const prog=1-m.warnTimer/2000,r=60*(0.3+0.7*prog);
      ctx.strokeStyle=`rgba(255,80,0,${0.3+prog*0.55})`;ctx.lineWidth=3;ctx.shadowColor='#ff4500';ctx.shadowBlur=10;
      ctx.beginPath();ctx.arc(m.targetX,m.targetY,r,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=`rgba(255,200,0,${0.5*prog})`;ctx.lineWidth=2;
      const cs=18;
      ctx.beginPath();ctx.moveTo(m.targetX-cs,m.targetY);ctx.lineTo(m.targetX+cs,m.targetY);ctx.moveTo(m.targetX,m.targetY-cs);ctx.lineTo(m.targetX,m.targetY+cs);ctx.stroke();
      ctx.shadowBlur=0;
    }
  }
  ctx.globalAlpha=1;
}

function renderBlackHoles(){
  const now=Date.now();
  for(const bh of blackHoles){
    const a=Math.min(1,bh.duration/3000);
    const t=now/400;
    ctx.save();ctx.translate(bh.x,bh.y);
    for(let i=0;i<3;i++){
      ctx.strokeStyle=`rgba(${100+i*50},0,${200-i*40},${a*(0.2+i*0.15)})`;ctx.lineWidth=2-i*0.5;
      ctx.beginPath();
      for(let ang=0;ang<=Math.PI*4;ang+=0.1){const r=bh.radius*(0.05+i*0.3)*(ang/(Math.PI*4));ctx.lineTo(Math.cos(ang-t)*r,Math.sin(ang-t)*r);}
      ctx.stroke();
    }
    ctx.shadowColor='#6600cc';ctx.shadowBlur=25;ctx.fillStyle=`rgba(10,0,20,${a*0.85})`;
    ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.restore();
  }
}

function renderTrails(){
  const now=Date.now();
  for(const blob of [player,...bots]){
    if(!blob||blob.dead||(blob.form!=='flacarau'&&blob.form!=='inferno')||blob.trailPts.length<2) continue;
    ctx.lineCap='round';
    for(let i=0;i<blob.trailPts.length-1;i++){
      const tp=blob.trailPts[i],age=1-(tp.exp-now)/3000;
      ctx.globalAlpha=Math.max(0,0.65*(1-age));
      ctx.strokeStyle=blob.form==='inferno'?(age<0.4?'#ffff00':'#ff2200'):(age<0.4?'#ff8c00':'#ff4500');
      ctx.lineWidth=Math.max(1,(1-age)*(blob.form==='inferno'?14:9));
      ctx.beginPath();ctx.moveTo(tp.x,tp.y);ctx.lineTo(blob.trailPts[i+1].x,blob.trailPts[i+1].y);ctx.stroke();
    }
  }
  ctx.globalAlpha=1;ctx.lineCap='butt';
}

function renderBoss(){
  if(!boss) return;
  const r=mToR(boss.mass),form=FORMS[boss.form],now=Date.now();
  const pulse=boss.enraged?(0.5+0.5*Math.sin(now/100)):0;
  ctx.shadowColor=boss.enraged?'#ff0000':form.color;ctx.shadowBlur=30+pulse*20;
  const g=ctx.createRadialGradient(boss.x-r*0.3,boss.y-r*0.3,r*0.05,boss.x,boss.y,r);
  g.addColorStop(0,boss.enraged?'#ff4400':form.color2);g.addColorStop(1,boss.enraged?'#880000':form.color);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(boss.x,boss.y,r,0,Math.PI*2);ctx.fill();
  // Enrage ring
  if(boss.enraged){ctx.strokeStyle=`rgba(255,0,0,${0.4+pulse*0.4})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(boss.x,boss.y,r+6,0,Math.PI*2);ctx.stroke();}
  ctx.shadowBlur=0;
  // HP hearts above (world space)
  const hs=Math.max(14,r*0.5);ctx.font=`${hs}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('❤️'.repeat(boss.hp)+'🖤'.repeat(boss.maxHp-boss.hp),boss.x,boss.y-r-14);
  // Name
  const ns=Math.max(10,Math.min(16,r*0.38));ctx.fillStyle='#fff';ctx.font=`bold ${ns}px Courier New`;ctx.shadowColor='#000';ctx.shadowBlur=4;
  ctx.fillText(`👹 BOSS`,boss.x,boss.y);ctx.shadowBlur=0;
}

function renderBlob(blob){
  const r=mToR(blob.mass),form=FORMS[blob.form];
  const frz=frozenBlobs.has(blob)&&Date.now()<frozenBlobs.get(blob);
  if(blob.invisible&&!blob.isPlayer){ctx.globalAlpha=0.07;ctx.fillStyle='#3a0066';ctx.beginPath();ctx.arc(blob.x,blob.y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;return;}
  if(blob.invisible) ctx.globalAlpha=0.28;
  ctx.shadowColor=frz?'#00cfff':form.color;ctx.shadowBlur=blob.isPlayer?28:18;
  const g=ctx.createRadialGradient(blob.x-r*0.3,blob.y-r*0.3,r*0.05,blob.x,blob.y,r);
  g.addColorStop(0,frz?'#e0f8ff':form.color2);g.addColorStop(1,frz?'#0099bb':form.color);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(blob.x,blob.y,r,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  // Ultra tier2 outer ring
  if(form.tier===2){
    ctx.strokeStyle=form.color;ctx.lineWidth=3;ctx.globalAlpha=(blob.invisible?0.28:1)*0.7;
    ctx.shadowColor=form.color;ctx.shadowBlur=15;
    ctx.beginPath();ctx.arc(blob.x,blob.y,r+4+(Math.sin(Date.now()/300)*2),0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;
  }
  switch(blob.form){
    case 'flacarau': drawFireDeco(blob,r);    break;
    case 'glaciar':  drawIceDeco(blob,r);     break;
    case 'fulgerul': drawStormDeco(blob,r);   break;
    case 'umbra':    drawShadowDeco(blob,r);  break;
    case 'lumina':   drawLightDeco(blob,r);   break;
    case 'inferno':  drawInfernoDeco(blob,r); break;
    case 'blizzard': drawBlizzardDeco(blob,r);break;
    case 'thundergod':drawStormDeco(blob,r);  break;
    case 'voidform': drawVoidDeco(blob,r);    break;
    case 'radiance': drawLightDeco(blob,r);   break;
  }
  if(frz){ctx.globalAlpha=(blob.invisible?0.28:1)*0.35;ctx.fillStyle='#a0f0ff';ctx.beginPath();ctx.arc(blob.x,blob.y,r,0,Math.PI*2);ctx.fill();}
  if(blob.isPlayer&&form.cooldown>0){
    const prog=blob.abCD<=0?1:1-blob.abCD/form.cooldown;
    ctx.strokeStyle=prog>=1?'#4ade80':'#06b6d4';ctx.lineWidth=3;ctx.globalAlpha=0.7;
    ctx.beginPath();ctx.arc(blob.x,blob.y,r+6,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);ctx.stroke();
  }
  ctx.globalAlpha=blob.invisible?0.28:1;
  const fs=Math.max(8,Math.min(14,r*0.42));
  ctx.fillStyle='#ffffff';ctx.font=`bold ${fs}px Courier New`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor='#000';ctx.shadowBlur=3;
  const label=(blob.isPlayer?nickname:blob.name)||'?';
  ctx.fillText(label.length>10?label.slice(0,9)+'…':label,blob.x,blob.y);
  const es=Math.max(8,Math.min(15,r*0.48));ctx.font=`${es}px serif`;
  ctx.fillText(form.emoji,blob.x,blob.y+r*0.44+es*0.55);
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}

function drawFireDeco(blob,r){const t=Date.now()/180;ctx.save();ctx.translate(blob.x,blob.y);for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2+t,d=r+3+Math.sin(t*3+i*1.3)*4;ctx.globalAlpha=0.8;ctx.fillStyle=i%2===0?'#ff4500':'#ff8c00';ctx.shadowColor='#ff4500';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d,3.5,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawInfernoDeco(blob,r){const t=Date.now()/100;ctx.save();ctx.translate(blob.x,blob.y);for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2+t,d=r+4+Math.sin(t*4+i*1.1)*5;ctx.globalAlpha=0.85;ctx.fillStyle=i%3===0?'#ffff00':i%3===1?'#ff2200':'#ff8800';ctx.shadowColor='#ff4500';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d,4.5,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawIceDeco(blob,r){const t=Date.now()/1000;ctx.save();ctx.translate(blob.x,blob.y);for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2+t*0.8,d=r+9;ctx.save();ctx.translate(Math.cos(a)*d,Math.sin(a)*d);ctx.rotate(a*2);ctx.strokeStyle='#a0f0ff';ctx.lineWidth=1.5;ctx.globalAlpha=0.85;ctx.shadowColor='#00cfff';ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(3,0);ctx.lineTo(0,5);ctx.lineTo(-3,0);ctx.closePath();ctx.stroke();ctx.restore();}ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawBlizzardDeco(blob,r){const t=Date.now()/800;ctx.save();ctx.translate(blob.x,blob.y);for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+t*0.6,d=r+10;ctx.save();ctx.translate(Math.cos(a)*d,Math.sin(a)*d);ctx.rotate(a+t);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.globalAlpha=0.9;ctx.shadowColor='#00aaff';ctx.shadowBlur=12;for(let j=0;j<3;j++){const ba=(j/3)*Math.PI;ctx.beginPath();ctx.moveTo(-6*Math.cos(ba),-6*Math.sin(ba));ctx.lineTo(6*Math.cos(ba),6*Math.sin(ba));ctx.stroke();}ctx.restore();}ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawStormDeco(blob,r){const t=Date.now()/130;ctx.save();ctx.translate(blob.x,blob.y);for(let a=0;a<3;a++){const base=(a/3)*Math.PI*2+t;ctx.strokeStyle=a%2===0?'#ffe500':'#cc00ff';ctx.lineWidth=1.8;ctx.globalAlpha=0.65;ctx.shadowColor=a%2===0?'#ffe500':'#cc00ff';ctx.shadowBlur=10;ctx.beginPath();let cx=Math.cos(base)*r*0.75,cy=Math.sin(base)*r*0.75;ctx.moveTo(cx,cy);for(let s=1;s<=5;s++){const ra=base+(s/5)*0.7-0.35+(Math.random()-0.5)*0.25;ctx.lineTo(Math.cos(ra)*(r*0.75+s*4.5),Math.sin(ra)*(r*0.75+s*4.5));}ctx.stroke();}ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawShadowDeco(blob,r){const t=Date.now()/750;ctx.save();ctx.translate(blob.x,blob.y);for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2+t,d=r+5+Math.sin(t*1.8+i)*5;ctx.fillStyle='#5500aa';ctx.globalAlpha=0.55;ctx.shadowColor='#aa00ff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d,3+Math.sin(t+i)*1.5,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawVoidDeco(blob,r){const t=Date.now()/500;ctx.save();ctx.translate(blob.x,blob.y);for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-t,d=r+6+Math.sin(t*2+i)*4;ctx.fillStyle='#110011';ctx.globalAlpha=0.75;ctx.shadowColor='#8800cc';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d,4.5,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='rgba(100,0,200,0.4)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r-3,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;}
function drawLightDeco(blob,r){const t=Date.now()/600;ctx.save();ctx.translate(blob.x,blob.y);ctx.globalAlpha=0.14;for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2+t*0.25,ex=Math.cos(a)*(r+32),ey=Math.sin(a)*(r+32);const g=ctx.createLinearGradient(0,0,ex,ey);g.addColorStop(0,'#ffffff');g.addColorStop(1,'rgba(255,255,180,0)');ctx.strokeStyle=g;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ex,ey);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;}

function renderFreezeRings(){
  const now=Date.now();
  for(const [blob,exp] of frozenBlobs){if(now>=exp)continue;ctx.strokeStyle='#00cfff';ctx.lineWidth=2;ctx.globalAlpha=0.55;ctx.shadowColor='#00cfff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(blob.x,blob.y,mToR(blob.mass)+7,0,Math.PI*2);ctx.stroke();}
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}

function renderChainLightning(){
  const allB=[player,...bots];
  for(const b of allB){
    if(!b||b.dead||!b._chainTargets) continue;
    b._chainTargets.timer-=16;
    if(b._chainTargets.timer<=0){delete b._chainTargets;continue;}
    for(const t of b._chainTargets.targets){
      if(!t||t.dead) continue;
      ctx.strokeStyle='#ffe500';ctx.lineWidth=2;ctx.globalAlpha=b._chainTargets.timer/400*0.8;
      ctx.shadowColor='#ffe500';ctx.shadowBlur=10;
      ctx.beginPath();ctx.moveTo(b.x,b.y);
      const mx=(b.x+t.x)/2+(Math.random()-0.5)*40, my=(b.y+t.y)/2+(Math.random()-0.5)*40;
      ctx.quadraticCurveTo(mx,my,t.x,t.y);ctx.stroke();
    }
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
}

function renderFloatTexts(){
  for(const f of floatTexts){
    const a=Math.min(1,f.life/f.maxLife*2);
    ctx.globalAlpha=a;ctx.fillStyle=f.color;ctx.strokeStyle='rgba(0,0,0,0.7)';
    ctx.font=`bold ${Math.max(10,14*(1-0.2*(1-a)))}px Courier New`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=3;ctx.strokeText(f.text,f.x,f.y);ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

// ── MINIMAP ───────────────────────────────────────────────────────
function renderMinimap(){
  if(!mmCtx||!player) return;
  const m=mmCtx,S=MM_SIZE,sc=S/WORLD;
  m.clearRect(0,0,S,S);m.fillStyle='rgba(2,2,8,0.7)';m.fillRect(0,0,S,S);
  for(const c of crystals){m.fillStyle=c.type==='chaos'?'#ff00ff':(FORMS[c.form||'neutru'].crystalColor);m.fillRect(c.x*sc-0.5,c.y*sc-0.5,1.5,1.5);}
  for(const b of bots){if(b.dead||b.invisible)continue;m.fillStyle=FORMS[b.form].color;m.beginPath();m.arc(b.x*sc,b.y*sc,2.5,0,Math.PI*2);m.fill();}
  if(boss){m.fillStyle='#ff0000';m.shadowColor='#ff0000';m.shadowBlur=6;m.beginPath();m.arc(boss.x*sc,boss.y*sc,5,0,Math.PI*2);m.fill();m.shadowBlur=0;}
  m.shadowColor=FORMS[player.form].color;m.shadowBlur=6;m.fillStyle=FORMS[player.form].color2;m.beginPath();m.arc(player.x*sc,player.y*sc,4,0,Math.PI*2);m.fill();m.shadowBlur=0;
  const vw=(canvas.width/camera.zoom)*sc,vh=(canvas.height/camera.zoom)*sc;
  m.strokeStyle='rgba(6,182,212,0.4)';m.lineWidth=1;m.strokeRect(camera.x*sc-vw/2,camera.y*sc-vh/2,vw,vh);
  m.strokeStyle='rgba(6,182,212,0.25)';m.lineWidth=1;m.strokeRect(0,0,S,S);
}

// ── HUD UPDATE ────────────────────────────────────────────────────
function updateHUD(){
  if(!player||player.dead) return;
  const form=FORMS[player.form];
  const elapsed=Date.now()-gameTime-totalPauseDur;

  document.getElementById('hud-mass').textContent=Math.floor(player.mass);
  document.getElementById('hud-best').textContent=Math.floor(Math.max(bestMass,maxMass));
  document.getElementById('hud-time').textContent=fmtT(elapsed);
  document.getElementById('hud-form').textContent=form.name;
  document.getElementById('hud-form-emoji').textContent=form.emoji;

  // Prestige badge
  const pr=document.getElementById('hud-prestige-row'),pv=document.getElementById('hud-prestige');
  if(prestigeLevel>0){pr.classList.remove('hidden');pv.textContent='⭐'.repeat(prestigeLevel)+' P'+prestigeLevel;}
  else pr.classList.add('hidden');

  document.getElementById('ability-icon').textContent=form.ability?abEmoji(form.ability):'—';
  document.getElementById('ability-name').textContent=form.ability?abName(form.ability):'NO ABILITY';

  const arc=document.getElementById('cooldown-arc'),cdTxt=document.getElementById('cooldown-text'),CIRC=113.1;
  if(!form.cooldown){arc.style.strokeDashoffset='0';arc.style.stroke='rgba(255,255,255,0.15)';cdTxt.textContent='—';}
  else if(player.abCD<=0){arc.style.strokeDashoffset='0';arc.style.stroke='#4ade80';cdTxt.textContent=ultraEvoTimer>0?'EVOLVING':'READY';}
  else{arc.style.strokeDashoffset=String(CIRC*player.abCD/form.cooldown);arc.style.stroke='#06b6d4';cdTxt.textContent=(player.abCD/1000).toFixed(1)+'s';}

  const ep=Math.min(player.ep||0,EVOLVE_THRESHOLD);
  document.getElementById('elem-progress').style.width=(ep/EVOLVE_THRESHOLD*100)+'%';
  document.getElementById('elem-count').textContent=`${Math.floor(ep)} / ${EVOLVE_THRESHOLD}`;
  document.getElementById('elem-progress').style.background=`linear-gradient(90deg,${form.color},${form.color2})`;

  const weak=WEAKNESS[baseForm(player.form)],strong=STRENGTH[baseForm(player.form)];
  const we=document.getElementById('ws-weak'),se=document.getElementById('ws-strong');
  if(weak){we.classList.remove('hidden');document.getElementById('ws-weak-name').textContent=FORMS[weak].name;}else we.classList.add('hidden');
  if(strong){se.classList.remove('hidden');document.getElementById('ws-strong-name').textContent=FORMS[strong].name;}else se.classList.add('hidden');

  // Ultra evo available
  const canUltra=ULTRA_MAP[player.form]&&player.mass>=500&&ultraEvoTimer<=0;
  document.getElementById('ultra-avail').classList.toggle('hidden',!canUltra);

  // Ultra mass progress bar
  const ultraWrap=document.getElementById('ultra-mass-wrap');
  const ultraTarget=ULTRA_MAP[player.form];
  if(ultraTarget&&FORMS[player.form].tier===1&&!canUltra){
    ultraWrap.classList.remove('hidden');
    const massPct=Math.min(100,player.mass/500*100);
    document.getElementById('ultra-mass-progress').style.width=massPct+'%';
    document.getElementById('ultra-mass-count').textContent=`${Math.floor(player.mass)} / 500`;
  } else { ultraWrap.classList.add('hidden'); }

  // Next event countdown
  const evRow=document.getElementById('hud-next-event-row');
  const evLabel=document.getElementById('hud-next-event-label');
  const evVal=document.getElementById('hud-next-event-val');
  evRow.classList.remove('hidden');
  if(boss){
    evLabel.textContent='BOSS HP';
    evVal.textContent='❤️'.repeat(boss.hp);
    evVal.style.color='#ef4444';
  } else if(vortex){
    evLabel.textContent='VORTEX';
    evVal.textContent=fmtT(Math.max(0,vortex.timer));
    evVal.style.color='#00cfff';
  } else if(meteorShowerActive){
    evLabel.textContent='METEORS';
    evVal.textContent=meteorShowerCount>0?meteorShowerCount+' LEFT':'ENDING';
    evVal.style.color='#ff6600';
  } else {
    // Find closest upcoming event
    const events=[
      {label:'BOSS IN',  t:bossTimer,   color:'#ef4444'},
      {label:'VORTEX IN',t:vortexTimer, color:'#00cfff'},
      {label:'METEOR IN',t:meteorTimer, color:'#ff6600'},
    ];
    events.sort((a,b)=>a.t-b.t);
    const next=events[0];
    evLabel.textContent=next.label;
    evVal.textContent=fmtT(Math.max(0,next.t));
    evVal.style.color=next.color;
  }

  // Leaderboard HUD
  const all=[{name:nickname,mass:player.mass,form:player.form,me:true},...bots.map(b=>({name:b.name,mass:b.mass,form:b.form,me:false}))];
  if(boss) all.push({name:'👹BOSS',mass:boss.mass,form:boss.form,me:false});
  all.sort((a,b)=>b.mass-a.mass);
  const lbEl=document.getElementById('lb-entries');lbEl.innerHTML='';
  all.slice(0,5).forEach((e,i)=>{
    const d=document.createElement('div');d.className='lb-entry'+(e.me?' me':'');
    d.innerHTML=`<span class="lb-rank">${i+1}</span><span class="lb-name">${FORMS[e.form]?FORMS[e.form].emoji:'👹'} ${e.name}</span><span class="lb-mass">${Math.floor(e.mass)}</span>`;
    lbEl.appendChild(d);
  });

  // 10-minute achievement
  if(elapsed>=600000) checkAch('untouchable');
}

const abEmoji = a=>({fireTrail:'🔥',freezePulse:'❄️',teleport:'⚡',invisible:'👁',attract:'✨',explosion:'💥',megaFreeze:'🌨',chainLightning:'🌩',blackHole:'🕳',blindAll:'☀️'}[a]||'?');
const abName  = a=>({fireTrail:'FIRE TRAIL',freezePulse:'FREEZE PULSE',teleport:'TELEPORT',invisible:'INVISIBLE',attract:'ATTRACT',explosion:'EXPLOSION',megaFreeze:'MEGA FREEZE',chainLightning:'CHAIN LIGHTNING',blackHole:'BLACK HOLE',blindAll:'BLIND ALL'}[a]||a);

// ── BOOT ──────────────────────────────────────────────────────────
window.addEventListener('load', init);

(function () {
  'use strict';
  let _didPause = false;
  function openExitDialog() {
    if (typeof gameState !== 'undefined' && gameState === 'playing') {
      pauseGame();
      _didPause = true;
    }
    document.getElementById('exit-confirm').classList.remove('hidden');
  }
  function closeExitDialog() {
    document.getElementById('exit-confirm').classList.add('hidden');
    if (_didPause) {
      _didPause = false;
      if (typeof gameState !== 'undefined' && gameState === 'paused') resumeGame();
    }
  }
  function confirmExit() {
    if (typeof player !== 'undefined' && player) {
      const currentBest = parseInt(localStorage.getItem('blobevo_best') || '0', 10);
      if (player.mass > currentBest) localStorage.setItem('blobevo_best', String(Math.floor(player.mass)));
    }
    window.location.href = '/';
  }
  document.getElementById('exit-portal-btn').addEventListener('click', openExitDialog);
  document.getElementById('exit-confirm-no').addEventListener('click', closeExitDialog);
  document.getElementById('exit-confirm-yes').addEventListener('click', confirmExit);
})();
