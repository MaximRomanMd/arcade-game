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
  minnow : { hp:15,  value:5,   size:16, speed:170, color:'#39e6c4', glow:'#aef9ec', weight:38, coins:1 },
  fry    : { hp:12,  value:3,   size:11, speed:215, color:'#7fe0d0', glow:'#cffaf0', weight:24, coins:1, spriteFrom:'minnow' },
  darter : { hp:21,  value:12,  size:22, speed:135, color:'#4aa8ff', glow:'#bfe2ff', weight:28, coins:3 },
  ray    : { hp:33,  value:30,  size:34, speed:88,  color:'#b07bff', glow:'#e4d2ff', weight:18, coins:7 },
  angler : { hp:48, value:70,  size:30, speed:110, color:'#ff7a59', glow:'#ffd2b0', weight:9,  coins:16, hunter:true },
  golden : { hp:66, value:160, size:30, speed:160, color:'#ffce63', glow:'#fff1c2', weight:4,  coins:30, shiny:true },
  levia  : { hp:210, value:380, size:64, speed:55,  color:'#ffb13d', glow:'#ffe7a8', weight:1,  coins:100, boss:true },
  seacat : { hp:84, value:100, size:42, speed:95,  color:'#9aa6b0', glow:'#d7e0e8', weight:6,  coins:30 },
  shark  : { hp:135, value:230, size:58, speed:135, color:'#7f93a3', glow:'#cfe0ee', weight:3,  coins:60 },
  whale  : { hp:285, value:600, size:118, speed:46, color:'#3a78d0', glow:'#a9d0ff', weight:1,  coins:130 },
  megalodon:{ hp:1000, value:3500, size:140, speed:36, color:'#5a6b7a', glow:'#cfe0ee', weight:0, coins:450, boss:true },
  jackpot: { hp:750, value:2000,size:148, speed:58,  color:'#ffce63', glow:'#fff1c2', weight:0,  coins:300, jackpot:true },
};
const TYPE_KEYS = Object.keys(FISH_TYPES);
const TOTAL_WEIGHT = TYPE_KEYS.reduce((s,k)=>s+FISH_TYPES[k].weight,0);

// optional ludo.ai fish art: assets/fish-<key>.png auto-loads into each type
TYPE_KEYS.forEach(k => {
  if (FISH_TYPES[k].spriteFrom) return;
  const img = new Image();
  img.onload = () => { FISH_TYPES[k].sprite = img; buildMask(k, img, 1, 1); };
  img.src = `assets/fish-${k}.png?v=2`;
});
// ── damage zone = the fish silhouette (alpha mask of the sprite) ──
const MASK = {};
const _mc = document.createElement('canvas'); _mc.width=64; _mc.height=32;
const _mcx = _mc.getContext('2d', { willReadFrequently:true });
function buildMask(key, img, cols, rows){
  try {
    const MW=64, MH=32, fw=img.width/cols, fh=img.height/rows, m=new Uint8Array(MW*MH);
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
      _mcx.clearRect(0,0,MW,MH);
      _mcx.drawImage(img, c*fw, r*fh, fw, fh, 0,0, MW,MH);
      const d=_mcx.getImageData(0,0,MW,MH).data;
      for (let i=0;i<MW*MH;i++) if (d[i*4+3]>28) m[i]=1;
    }
    MASK[key]={ data:m, mw:MW, mh:MH };
  } catch(e){}
}
// red flash tinted to the silhouette only (offscreen buffer)
const _fc = document.createElement('canvas'); const _fcx = _fc.getContext('2d');
function drawFlash(img, sx,sy,sw,sh, bw,bh, a){
  const W2=Math.max(1,Math.ceil(bw)), H2=Math.max(1,Math.ceil(bh));
  if (_fc.width<W2) _fc.width=W2; if (_fc.height<H2) _fc.height=H2;
  _fcx.clearRect(0,0,_fc.width,_fc.height);
  _fcx.drawImage(img, sx,sy,sw,sh, 0,0, bw,bh);
  _fcx.globalCompositeOperation='source-atop'; _fcx.fillStyle='#ff2a2a'; _fcx.fillRect(0,0,bw,bh); _fcx.globalCompositeOperation='source-over';
  ctx.globalAlpha=a; ctx.drawImage(_fc, 0,0,W2,H2, -bw/2,-bh/2, bw,bh); ctx.globalAlpha=1;
}
// per-fish ludo swim animations. add one [key,cols,rows,frames,rate] line per fish.
const FISHANIM = {};
[['ray',5,5,25,0.00833],['darter',5,5,25,0.00833],['minnow',6,6,36,0.012],['angler',5,5,25,0.00833],['levia',5,5,25,0.00833],['shark',5,5,25,0.00833],['whale',5,5,25,0.00833],['golden',5,5,25,0.00833],['seacat',5,5,25,0.00833],['megalodon',5,5,25,0.006]].forEach(function(e){
  const o={img:new Image(), cols:e[1], rows:e[2], frames:e[3], rate:e[4], ready:false};
  o.img.onload=function(){ o.ready=true; buildMask(e[0], o.img, e[1], e[2]); };
  o.img.src=`assets/${e[0]}-anim.png?v=1`;
  FISHANIM[e[0]]=o;
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
let multiFormat = '6p';
let multiSeat = 0;
let cannonHome = null, seats = [], chosenSeat = null;
let wallet = (parseFloat(localStorage.getItem('fishhunter_wallet')) || 10000), bots = [];
let roomEntry = 0, roomPrize = 0;
function saveWallet(){
  try { localStorage.setItem('fishhunter_wallet', String(wallet)); } catch(e){}
  const _a=document.getElementById('bal-val');       if(_a) _a.textContent=formatNum(wallet);
  const _b=document.getElementById('lobby-wallet');  if(_b) _b.textContent=formatNum(wallet);
  const _c=document.getElementById('lobby-wallet2'); if(_c) _c.textContent=formatNum(wallet);
}
let running = false;
let fish = [], bullets = [], particles = [], pops = [], rings = [], bubbles = [];
let aim = { x: W/2, y: H*0.4 };
let firing = false, fireTimer = 0;
let wpnLevel = 1;
let fireMode = 'spread';
let credits = START_CREDITS;
let creditsShown = START_CREDITS;
let score = 0, timeLeft = ROUND_TIME, shake = 0, flash = 0, flashColor = '#28e0c8';
let matchStartT = 0;   // wall-clock anchor so the timer is REAL time (keeps running if the tab is backgrounded)
let combo = 1, comboTimer = 0, comboKills = 0;
let brokeT = 0;
let spawnTimer = 0, elapsed = 0;
let hitStop = 0;
let coinsFx = [];
let waves = [];
let zoomPunch = 0, zx = 0, zy = 0;
let powerups = [], puTimer = 18;
let jackpotTimer = 32;
let megTimer = 45, megAlert = 0, megPending = false;
let freezeT = 0, doubleT = 0, multiT = 0;
const POWERUPS = {
  freeze: { icon:'F',  color:'#7fd4ff', label:'FREEZE' },
  frenzy: { icon:'x2', color:'#ffce63', label:'FRENZY' },
  multi:  { icon:'M',  color:'#28e0c8', label:'MULTI'  },
  bomb:   { icon:'B',  color:'#ff5d6c', label:'BOMB'   },
};
const PU_KEYS = ['freeze'];
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
sceneImg.src = 'assets/scene.png?v=2';
const algeAnim = new Image(); algeAnim.src='assets/alge-anim.png?v=1';
const algePurple = new Image(); algePurple.src='assets/alge-purple-anim.png?v=1';
const algeOrange = new Image(); algeOrange.src='assets/alge-orange-anim.png?v=1';
const algeTeal = new Image(); algeTeal.src='assets/alge-teal-anim.png?v=1';
const coralFan = new Image(); coralFan.src='assets/coral-fan-anim.png?v=1';
const PLANTINST = [
  ['green',0.03,0.42,0],['purple',0.09,0.30,5],['teal',0.15,0.24,9],['orange',0.21,0.18,2],['coral',0.27,0.15,12],
  ['green',0.34,0.16,7],['purple',0.41,0.13,3],
  ['coral',0.60,0.14,10],['green',0.67,0.15,1],['teal',0.73,0.18,6],['orange',0.79,0.22,13],['purple',0.86,0.28,4],['teal',0.92,0.34,8],['green',0.97,0.42,11]
];

// optional ludo.ai cannon turret (assets/cannon.png) — barrel pointing UP
const cannonImg = new Image(); let cannonReady = false;
cannonImg.onload = () => { cannonReady = true; };
cannonImg.src = 'assets/cannon.png';
// fish use clean static ludo sprites (no procedural warp)

// ===== CANNON SKINS =====
const SKINS = [
  { file:'assets/cannon.png',   bullet:'#7ff0dd', name:'STANDARD', tint:null,      cost:0 },
  { file:'assets/cannon-2.png', bullet:'#ffce63', name:'GOLD',     tint:'#ffce63', cost:300 },
  { file:'assets/cannon-3.png', bullet:'#ff5d6c', name:'CRIMSON',  tint:'#ff5d6c', cost:600 },
  { file:'assets/cannon-4.png', bullet:'#39e6c4', name:'EMERALD',  tint:'#39e6c4', cost:1000 },
  { file:'assets/cannon-5.png', bullet:'#b07bff', name:'VIOLET',   tint:'#b07bff', cost:1500 },
];
let skinId = parseInt(localStorage.getItem('fishhunter_skin')||'0',10) || 0;
SKINS.forEach((sk,i) => { sk.id=i; if(i===0){ sk.img=cannonImg; return; } sk.img=null; const im=new Image(); im.onload=()=>{ sk.img=im; }; im.src=sk.file; });
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
function currentSkin(){ return SKINS[clamp(skinId,0,SKINS.length-1)]||SKINS[0]; }
function currentCannonImg(){ const sk=currentSkin(); if (sk&&sk.img&&sk.img.complete&&sk.img.naturalWidth) return sk.img; return cannonReady?cannonImg:null; }
function currentBulletColor(){ return currentSkin().bullet; }
// ===== XP currency, daily login & daily quests =====
const xpGet = () => parseInt(localStorage.getItem('fishhunter_xp')||'0',10);
function updateXpHud(){ const e=document.getElementById('xp-val'); if(e) e.textContent=formatNum(xpGet()); }
function xpSet(v){ localStorage.setItem('fishhunter_xp', String(Math.max(0,Math.round(v)))); updateXpHud(); }
function xpToast(txt){ const s=document.getElementById('soon-msg'); if(s){ s.textContent=txt; s.classList.add('show'); clearTimeout(xpToast._t); xpToast._t=setTimeout(()=>s.classList.remove('show'),2200); } }
function xpAdd(n){ n=Math.round(n); if(n<=0) return; xpSet(xpGet()+n); xpToast('+'+n+' XP'); }

function grantDailyLogin(){
  const today=todayStr(); const last=localStorage.getItem('fishhunter_xp_login')||'';
  if(last===today) return;
  const y=new Date(Date.now()-86400000); const ys=y.getUTCFullYear()+'-'+(y.getUTCMonth()+1)+'-'+y.getUTCDate();
  let streak=parseInt(localStorage.getItem('fishhunter_xp_streak')||'0',10);
  streak = (last===ys) ? streak+1 : 1;
  const reward=Math.min(60, 15+(streak-1)*5);
  localStorage.setItem('fishhunter_xp_login',today); localStorage.setItem('fishhunter_xp_streak',String(streak));
  xpSet(xpGet()+reward);
  setTimeout(()=>xpToast('Daily login +'+reward+' XP \u00b7 Day '+streak),700);
}

const QUEST_DEFS=[
  {id:'play',  desc:'Play 3 matches', goal:3,  xp:40},
  {id:'catch', desc:'Catch 80 fish',  goal:80, xp:50},
  {id:'win',   desc:'Win a room',     goal:1,  xp:70},
];
function questState(){
  let q; try{ q=JSON.parse(localStorage.getItem('fishhunter_quests')||'null'); }catch(e){ q=null; }
  if(!q || q.date!==todayStr()){ q={ date:todayStr(), items:QUEST_DEFS.map(d=>({id:d.id,prog:0,claimed:false})) }; localStorage.setItem('fishhunter_quests',JSON.stringify(q)); }
  return q;
}
function questSave(q){ localStorage.setItem('fishhunter_quests',JSON.stringify(q)); }
function questProgress(id,amt){ const q=questState(); const it=q.items.find(i=>i.id===id); const def=QUEST_DEFS.find(d=>d.id===id); if(!it||!def||it.claimed) return; it.prog=Math.min(def.goal, it.prog+amt); questSave(q); }
function renderQuests(){
  const box=document.getElementById('daily-list'); if(!box) return;
  const q=questState(); const streak=parseInt(localStorage.getItem('fishhunter_xp_streak')||'1',10);
  let html='<div class="dq-login">\u2b50 Daily login claimed \u00b7 Day '+streak+' streak \u00b7 You have <b>'+formatNum(xpGet())+' XP</b></div>';
  q.items.forEach(it=>{ const def=QUEST_DEFS.find(d=>d.id===it.id); const done=it.prog>=def.goal; const pct=Math.min(100,Math.round(it.prog/def.goal*100));
    html+='<div class="dq-item"><div class="dq-top"><span class="dq-desc">'+def.desc+'</span><span class="dq-xp">+'+def.xp+' XP</span></div>'
      +'<div class="dq-bar"><div class="dq-fill" style="width:'+pct+'%"></div></div>'
      +'<div class="dq-bot"><span class="dq-prog">'+it.prog+' / '+def.goal+'</span>'
      +(it.claimed?'<span class="dq-claimed">\u2713 CLAIMED</span>':(done?'<button class="dq-claim" data-q="'+it.id+'">CLAIM</button>':'<span class="dq-todo">in progress</span>'))
      +'</div></div>';
  });
  box.innerHTML=html;
  box.querySelectorAll('.dq-claim').forEach(b=>b.onclick=()=>{ const id=b.dataset.q; const q2=questState(); const it=q2.items.find(i=>i.id===id); const def=QUEST_DEFS.find(d=>d.id===id); if(it&&!it.claimed&&it.prog>=def.goal){ it.claimed=true; questSave(q2); xpAdd(def.xp); try{initAudio();sfxJackpot();}catch(e){} renderQuests(); } });
}

function shopOwned(){ try{ return new Set(JSON.parse(localStorage.getItem('fishhunter_skins_owned')||'[0]')); }catch(e){ return new Set([0]); } }
function shopAvail(){ return xpGet(); }
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
    else if(xpGet()>=sk.cost){ btn.textContent='BUY '+sk.cost+' XP'; btn.onclick=()=>{ xpSet(xpGet()-sk.cost); owned.add(sk.id); localStorage.setItem('fishhunter_skins_owned',JSON.stringify([...owned])); skinId=sk.id; localStorage.setItem('fishhunter_skin',String(sk.id)); try{initAudio();sfxJackpot();}catch(e){} renderShop(); }; }
    else { btn.textContent='LOCKED '+sk.cost+' XP'; btn.disabled=true; btn.classList.add('locked'); }
    cell.appendChild(btn); grid.appendChild(cell);
  });
}

// ════════════════════════════════════════════════════════════════
//  SOUND — procedural Web Audio (no files)
// ════════════════════════════════════════════════════════════════
let actx = null, masterGain = null, ambGain = null, muted = false, ambBubbleTimer = null;
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
function bell(freq, dur, vol){
  if (!actx) return;
  const o=actx.createOscillator(), o2=actx.createOscillator(), g=actx.createGain(), g2=actx.createGain();
  o.type='sine'; o2.type='triangle'; o.frequency.value=freq; o2.frequency.value=freq*2.01;
  g2.gain.value=0.22; o2.connect(g2); g2.connect(g); o.connect(g); g.connect(masterGain);
  const t0=actx.currentTime;
  g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.start(t0); o2.start(t0); o.stop(t0+dur+0.05); o2.stop(t0+dur+0.05);
}
function startAmbient(){
  if (!actx) return;
  ambGain = actx.createGain(); ambGain.gain.value = 0; ambGain.connect(masterGain);

  // ── bright warm MAJOR pad (happy) ──
  const pad = actx.createGain(); pad.gain.value = 0.17; pad.connect(ambGain);
  const padFlt = actx.createBiquadFilter(); padFlt.type='lowpass'; padFlt.frequency.value=1500; padFlt.connect(pad);
  [220.0, 277.18, 329.63].forEach((f,i)=>{                 // A major triad, gentle
    const o=actx.createOscillator(); o.type='sine'; o.frequency.value=f;
    const g=actx.createGain(); g.gain.value=0.42; o.connect(g); g.connect(padFlt); o.start();
    const lf=actx.createOscillator(), lg=actx.createGain(); lf.frequency.value=0.05+i*0.02; lg.gain.value=2.5; lf.connect(lg); lg.connect(o.frequency); lf.start();
  });

  // ── light water shimmer (quiet, sparkly) ──
  const len=Math.floor(actx.sampleRate*3); const nb=actx.createBuffer(1,len,actx.sampleRate); const nd=nb.getChannelData(0);
  for(let i=0;i<len;i++) nd[i]=(Math.random()*2-1)*0.5;
  const noise=actx.createBufferSource(); noise.buffer=nb; noise.loop=true;
  const nf=actx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=2200; nf.Q.value=0.5;
  const ng=actx.createGain(); ng.gain.value=0.02; noise.connect(nf); nf.connect(ng); ng.connect(ambGain);
  const w=actx.createOscillator(), wg=actx.createGain(); w.frequency.value=0.08; wg.gain.value=0.012; w.connect(wg); wg.connect(ng.gain); w.start();
  noise.start();

  ambGain.gain.linearRampToValueAtTime(0.22, actx.currentTime + 2.5);

  // ── cheerful gentle arpeggio: C major pentatonic, soft bells ──
  const scale=[523.25,587.33,659.25,783.99,880.0,1046.5]; let melI=2;
  if (ambBubbleTimer) clearInterval(ambBubbleTimer);
  ambBubbleTimer = setInterval(()=>{
    if (muted || !actx) return;
    melI = Math.max(0, Math.min(scale.length-1, melI + (Math.random()<0.5?1:-1)*(Math.random()<0.72?1:2)));
    bell(scale[melI], 0.95, 0.02);
    if (Math.random()<0.35) bell(scale[melI]*1.5, 0.7, 0.01);   // soft harmony shimmer
  }, 900);
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
function sfxAlert(){ blip({freq:170,type:'sawtooth',dur:0.7,vol:0.16,slideTo:110}); setTimeout(()=>blip({freq:190,type:'sawtooth',dur:0.7,vol:0.16,slideTo:120}),360); noiseBurst({dur:0.4,vol:0.09,freq:280,type:'lowpass'}); }
function toggleMute(){
  muted = !muted;
  if (!muted) initAudio();                       // a click is a valid gesture: start audio
  if (actx && actx.state === 'suspended') actx.resume();
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
  const b = document.getElementById('mute-btn'); if (b) b.textContent = muted ? '🔇' : '🔊';
}
// Kick the ambient track to life on the very first interaction with the page
function _firstGesture(){ if (!muted) initAudio(); window.removeEventListener('pointerdown', _firstGesture); window.removeEventListener('keydown', _firstGesture); }
window.addEventListener('pointerdown', _firstGesture);
window.addEventListener('keydown', _firstGesture);

// ── helpers ──────────────────────────────────────────────────────
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const formatNum = n => Number(n).toLocaleString('en-US');
function hexA(h,a){ h=(h||'#28e0c8').replace('#',''); const n=parseInt(h,16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
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
  const _pp = pointerPos(e);
  if (phase === 'seating'){ pickSeat(_pp.x, _pp.y); return; }
  aim = _pp; firing = true; fireTimer = 0; tryFire();
});
window.addEventListener('pointerup',   () => firing = false);
window.addEventListener('pointercancel',() => firing = false);
window.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=' ) setWpn(wpnLevel+1);
  if (e.key === '-' || e.key === '_' ) setWpn(wpnLevel-1);
  if (e.code === 'Space'){ firing = true; tryFire(); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') firing = false; });

document.getElementById('wpn-up').onclick   = () => { if(mode==='multi')return; setWpn(wpnLevel+1); };
document.getElementById('wpn-down').onclick = () => { if(mode==='multi')return; setWpn(wpnLevel-1); };
{ const mb=document.getElementById('wpn-mode'); if(mb) mb.onclick=()=>{ fireMode = fireMode==='spread'?'focus':'spread'; mb.textContent = fireMode==='focus'?'FOCUS':'SPREAD'; mb.classList.toggle('focus', fireMode==='focus'); setWpn(wpnLevel); }; }

function setWpn(lv){
  wpnLevel = clamp(lv, 1, MAX_WPN_LV);
  document.getElementById('wpn-level').textContent = 'LV ' + wpnLevel;
  const _amt = (mode==='multi') ? '∞ ammo' : ('cost '+wpnLevel);
  document.getElementById('wpn-cost').textContent  =
    fireMode==='focus' ? `${_amt} · 1 shot, ${wpnLevel} dmg` : `${_amt} · ${wpnLevel} shots, 1 dmg`;
}

// ── firing ───────────────────────────────────────────────────────
function tryFire(){
  if (!running) return;
  if (mode !== 'multi'){          // multiplayer = infinite ammo
    const cost = wpnLevel;
    if (credits < cost) {
      if (credits < 1) return;
      setWpn(credits);
    }
    credits -= wpnLevel;
  }
  stats.shots++;
  const dx = aim.x - cannon.x, dy = aim.y - cannon.y;
  const a  = Math.atan2(dy, dx);
  const bl = cannonReady ? CN_BARREL : cannon.len;
  const muzzleX = cannon.x + Math.cos(a)*bl;
  const muzzleY = cannon.y + Math.sin(a)*bl;
  const speed = 840;
  // higher levels fire a tight spread of pellets
  // simple level-1 cannon: a single bullet that deals 3 damage
  bullets.push({
    x:muzzleX, y:muzzleY,
    vx:Math.cos(a)*speed, vy:Math.sin(a)*speed,
    dmg: 3, r: 7, life: 3.0, trail: [], color: currentBulletColor(),
  });
  // muzzle flash particles
  for (let i=0;i<6;i++){
    particles.push({ x:muzzleX, y:muzzleY,
      vx:Math.cos(a)*rand(60,180)+rand(-40,40),
      vy:Math.sin(a)*rand(60,180)+rand(-40,40),
      r:rand(1,3), life:.25, max:.25, c:'#aef9ec' });
  }
  shake = Math.min(shake + 1.6, 7);
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
  if (combo > _oldCombo){ sfxCombo(combo); if (combo >= 4) callout('COMBO ×'+combo, 'teal'); }
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
  { const cf = document.getElementById('combo-fill'); if (cf) cf.style.width = (Math.max(0, comboTimer) / COMBO_WINDOW * 100) + '%'; }
}

// ── center-screen callout banner: boss / big-catch / combo milestones ──
function callout(txt, kind){
  const el = document.getElementById('callout'); if (!el) return;
  el.textContent = txt;
  el.className = 'callout ' + (kind || '');
  void el.offsetWidth;            // reflow so the CSS animation restarts on every call
  el.classList.add('show');
}

// ── kill / hit fx ────────────────────────────────────────────────
function hurtFish(f, dmg, bx, by, owner){
  f.hp -= dmg; f.hitFlash = 0.18; f.killer = owner;
  stats.hits++;
  sfxHit();
  // damage shown ONLY via the red silhouette tint (f.hitFlash) — no white flash.
  for (let i=0;i<4;i++){ const a=Math.random()*6.28, sp=rand(50,150);
    particles.push({ x:bx, y:by, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:rand(1,2), life:rand(.12,.24), max:.24, c:'#ff6a5a' }); }
  if (f.hp <= 0) killFish(f);
}

function killFish(f){
  const owner = f.killer, mult = doubleT > 0 ? 2 : 1;
  let gained;
  if (owner && owner.score!==undefined){ gained = Math.round(f.value) * mult; owner.score += gained; }
  else {
    gained = Math.round(f.value * combo) * mult;
    score += gained; credits += f.coins * mult;
    stats.kills++; stats.coins += f.coins; questProgress('catch',1);
    if (f.value > stats.biggestVal){ stats.biggestVal = f.value; stats.biggest = labelFor(f.key); }
    addKillCombo();
    if (f.jackpot)                      callout('💰 JACKPOT  +'+gained, 'gold');
    else if (f.boss)                    callout((f.key==='megalodon'?'MEGALODON DOWN':'BOSS DOWN')+'  +'+gained, 'gold');
    else if (f.shiny || f.value >= 160) callout('BIG CATCH  +'+gained, 'gold');
  }
  sfxKill(f.boss || f.shiny); sfxCoin();

  // explosion particles
  const n = f.boss ? 38 : f.value>=70 ? 24 : f.value>=30 ? 16 : 9;
  for (let i=0;i<n;i++){
    const a = Math.random()*6.28, sp = rand(40, f.boss?420:240);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      r:rand(1.5,4.5), life:rand(.4,.9), max:.9,
      c: Math.random()<0.5 ? f.color : f.glow });
  }
  // gold coin sparkle burst — only for fish YOU killed (not other players')
  if (!(owner && owner.score!==undefined)) for (let i=0;i<Math.min(f.coins,6);i++){
    const a=Math.random()*6.28, sp=rand(60,200);
    particles.push({ x:f.x, y:f.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60,
      r:rand(1.5,3), life:rand(.5,1), max:1, c:'#ffce63', grav:280 });
  }
  // shockwave ring
  rings.push({ x:f.x, y:f.y, r:f.size, max:f.size*(f.boss?6:3.4), life:.5, c:f.glow });
  // score popup
  pops.push({ x:f.x, y:f.y, txt:'+'+gained, life:.9, max:.9,
    c: (f.killer&&f.killer.score!==undefined)?f.killer.col:(combo>1?'#ffce63':'#aef9ec'), big:f.boss||f.shiny||f.value>=70 });
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
  if (!(owner && owner.score!==undefined)) spawnCoinFx(f.x, f.y, Math.min(f.coins, f.boss?16:6));   // only your coins show
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
  { const _v=(mode==='multi')?'∞':Math.max(0,Math.round(creditsShown)); const _e=document.getElementById('hud-credits'); if(_e) _e.textContent=_v; const _w=document.getElementById('wallet-val'); if(_w) _w.textContent=_v; }
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

function spawnMegalodon(){
  const t = FISH_TYPES.megalodon;
  const sz = clamp(Math.min(W,H)*0.23, 190, 360);   // THE MEGALODON - huge & fearsome
  const fromLeft = srand()<0.5;
  const y = srange(H*0.32, H*0.6);
  fish.push({ key:'megalodon', ...t, maxHp:t.hp, size:sz,
    x: fromLeft?-sz*2.2:W+sz*2.2, y, vx:(fromLeft?1:-1)*t.speed, vy:0, baseY:y,
    freq:srange(0.25,0.45), phase:srand()*6.28, t:0, wig:srand()*6.28, hitFlash:0 });
  flash = 0.4; flashColor = '#ff3030'; shake = 14;
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
  if (pu.key==='freeze') freezeT = 7.5;
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
  { const _v2=(mode==='multi')?'∞':Math.max(0,Math.round(creditsShown)); document.getElementById('hud-credits').textContent=_v2; const _w2=document.getElementById('wallet-val'); if(_w2) _w2.textContent=_v2; }
  document.getElementById('hud-time').textContent    =
    (mode==='tournament'||mode==='multi') ? Math.ceil(timeLeft) : '∞';
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
  if (cannonHome){ cannon.x = cannonHome.x; cannon.y = cannonHome.y; } else { cannon.x = W/2; cannon.y = H - 40; }
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

// ── boot: splash + loading (waits for the real assets), then menu ──
function assetFrac(){
  let total=0, done=0;
  for (const k in FISHANIM){ total++; if (FISHANIM[k].ready) done++; }
  total++; if (sceneReady) done++;
  total++; if (cannonImg.complete && cannonImg.naturalWidth) done++;
  for (const k of TYPE_KEYS){ if (FISH_TYPES[k].spriteFrom) continue; total++; if (FISH_TYPES[k].sprite) done++; }
  return total ? done/total : 1;
}
function updateBoot(dt){
  bootT += dt;
  const aFrac = assetFrac();
  const shown = clamp(Math.min(bootT/1.2, 0.06 + 0.94*aFrac), 0, 1);
  const eased = shown*shown*(3-2*shown);
  const fill = document.getElementById('loading-fill');
  const pct  = document.getElementById('loading-pct');
  const msg  = document.getElementById('loading-msg');
  if (fill) fill.style.width = (eased*100).toFixed(0) + '%';
  if (pct)  pct.textContent  = Math.round(eased*100) + '%';
  if (msg)  msg.textContent  = LOAD_MSGS[Math.min(LOAD_MSGS.length-1, Math.floor(shown*LOAD_MSGS.length))];
  updateAmbient(dt);
  // start only when essential assets are ready (min splash time), or after a safety timeout
  if ((aFrac >= 1 && bootT >= BOOT_DUR) || bootT >= 16) startDive();
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

function renderCredits(){
  const el=document.getElementById('credits-stats'); if(!el) return;
  el.innerHTML =
    '<div class="st-row"><span>Player</span><b>'+NICK+'</b></div>'+
    '<div class="st-row"><span>Best score</span><b>'+formatNum(ls(K.best))+'</b></div>'+
    '<div class="st-row"><span>Games played</span><b>'+ls(K.games)+'</b></div>'+
    '<div class="st-row"><span>Credits won</span><b>'+formatNum(ls(K.coins))+'</b></div>'+
    '<div class="st-row"><span>Best combo</span><b>x'+(ls(K.bigCombo)||1)+'</b></div>';
}

function renderRooms(){
  const list=document.getElementById('rooms-list'); if(!list) return;
  const _wb=document.getElementById('lobby-wallet'); if(_wb) _wb.textContent=formatNum(wallet);
  const _bv=document.getElementById('bal-val'); if(_bv) _bv.textContent=formatNum(wallet);
  const _wb2=document.getElementById('lobby-wallet2'); if(_wb2) _wb2.textContent=formatNum(wallet);
  const prices=[0.5,1,5,10,50];
  const tiers=['MICRO','LOW','MID','HIGH','VIP'];      // stakes tier label per price index
  const fmts=[{k:'1v1',name:'1v1 DUEL',seats:2},{k:'6p',name:'6 PLAYERS',seats:6},{k:'8p',name:'8 PLAYERS',seats:8}];
  let html='';
  fmts.forEach(f=>{                                   // grouped & ordered: 1v1, then 6p, then 8p
    html+='<div class="rooms-section">'+f.name+'</div>';
    prices.forEach((pr,pi)=>{
      const net=pr*f.seats*0.90, top=net, filled=(pi+(f.k==='1v1'?1:2))%f.seats;
      const pct=Math.round(filled/f.seats*100);
      html+='<div class="room-card tier-'+pi+'" data-fmt="'+f.k+'" data-entry="'+pr+'" data-prize="'+top.toFixed(2)+'">'
        +'<div class="room-logo"><img src="assets/logo.png?v=1" alt=""></div>'
        +'<div class="room-mid"><div class="room-name">'+f.name+' <span class="tier-badge">'+tiers[pi]+'</span></div>'
        +'<div class="room-meta">$'+pr.toFixed(2)+' entry &middot; 90s &middot; seeded</div>'
        +'<div class="seat-bar"><div class="seat-fill" style="width:'+pct+'%"></div></div>'
        +'<div class="room-players">'+filled+'/'+f.seats+' seated</div></div>'
        +'<div class="room-right"><div class="room-prize">WIN $'+top.toFixed(2)+'</div>'
        +'<button class="room-join">JOIN</button></div></div>';
    });
  });
  list.innerHTML=html;
  // Event delegation: one robust listener on the container. A click anywhere on a
  // room card (or its JOIN button) enters that room. Survives re-renders and avoids
  // per-button wiring that a CSS overlay could swallow.
  if (!list._joinWired){
    list._joinWired = true;
    list.style.cursor = 'pointer';
    const enterRoom = (ev)=>{
      const card = ev.target && ev.target.closest ? ev.target.closest('.room-card') : null;
      if (!card) return;
      ev.preventDefault(); ev.stopPropagation();
      try {
        const entry = parseFloat(card.dataset.entry||'0'), prize = parseFloat(card.dataset.prize||'0');
        if (wallet < entry){ alert('Balance too low for this room (needs $'+entry.toFixed(2)+').'); return; }
        wallet -= entry; roomEntry = entry; roomPrize = prize; saveWallet();   // pay the entry fee
        multiFormat = card.dataset.fmt || '6p';
        const os = document.getElementById('overlay-start'); if (os) os.classList.add('hidden');
        startSeating(multiFormat);
      } catch(err){ console.error('JOIN failed:', err); alert('Join error: '+err.message); }
    };
    list.addEventListener('click', enterRoom);
    list.addEventListener('touchend', enterRoom, {passive:false});
  }
}
function renderMenu(){
  { const _ll=document.getElementById('lobby-landing'), _rv=document.getElementById('rooms-view'); if(_ll)_ll.classList.add('hidden'); if(_rv)_rv.classList.remove('hidden'); }
  { const _bv=document.getElementById('bal-val'); if(_bv) _bv.textContent=formatNum(wallet); }
  grantDailyLogin(); updateXpHud();
  { const _lx=document.getElementById('lobby-xp'); if(_lx) _lx.textContent=formatNum(xpGet()); }
  if (logoImg.complete && logoImg.naturalWidth > 0){
    const li = document.getElementById('menu-logo-img');
    const lt = document.getElementById('menu-logo-text');
    if (li){ li.src = logoImg.src; li.style.display = 'block'; }
    if (lt) lt.style.display = 'none';
  }
  const md = document.getElementById('menu-daily');
  if (md) md.textContent = `DAILY CHALLENGE #${dailySeed()}  -  same fish for all`;
  renderDaily();
  renderRooms();
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
  if (cannonHome){ cannon.x = cannonHome.x; cannon.y = cannonHome.y; } else { cannon.x = W/2; cannon.y = H - 40; }

  if (mode==='tournament' || mode==='multi'){
    timeLeft = ROUND_TIME - (performance.now() - matchStartT)/1000;   // real elapsed time
    if (timeLeft <= 0){ timeLeft = 0; return endGame(); }
    if (mode==='tournament' && credits < 1){ brokeT += dt; if (brokeT > 0.8) return endGame(); } else brokeT = 0;
  }

  if (mode==='multi' && bots.length){
    for (const bot of bots){
      // smooth barrel tracking toward the nearest fish (visual aim)
      if (fish.length){
        let nf=null, nd=1e18;
        for (const f of fish){ const dd=(f.x-bot.seat.x)*(f.x-bot.seat.x)+(f.y-bot.seat.y)*(f.y-bot.seat.y); if (dd<nd){ nd=dd; nf=f; } }
        if (nf){ const want=Math.atan2(nf.y-bot.seat.y, nf.x-bot.seat.x); let da=want-bot.aimA; while(da>Math.PI)da-=6.2832; while(da<-Math.PI)da+=6.2832; bot.aimA+=da*Math.min(1,dt*7); }
      }
      bot.fireT -= dt;
      if (fish.length && bot.fireT<=0){ bot.fireT = rand(0.18,0.26);   // human-like reaction (a touch slower than your hold-fire)
        const tgt = fish[(Math.random()*fish.length)|0];
        if (tgt){
          const base = Math.atan2(tgt.y-bot.seat.y, tgt.x-bot.seat.x) + (Math.random()-0.5)*0.09;  // human aim wobble
          bullets.push({ x:bot.seat.x, y:bot.seat.y, vx:Math.cos(base)*840, vy:Math.sin(base)*840, dmg:3, r:7, life:3.0, trail:[], color:currentBulletColor(), owner:bot });
        } }
    }
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
    if (srand() < 0.005 && !fish.some(f=>f.jackpot)) spawnJackpot();   // rare jackpot ~0.5%
    spawnTimer = interval * srange(0.7,1.3);
  }
  if (fish.length < 8) spawnFish(srand()<0.5); // keep the sea busy
  puTimer -= dt;
  if (puTimer <= 0){ spawnPowerup(); puTimer = srange(15, 25); }
  for (const pu of powerups){ pu.t += dt; pu.x += pu.vx*dt; pu.y = pu.baseY + Math.sin(pu.t*1.5 + pu.phase)*14;
    if (pu.x < -50 || pu.x > W+50) pu._gone = true; }
  powerups = powerups.filter(pu => !pu._gone);
  // jackpot is now a rare per-spawn chance (handled in the spawn block above)
  megTimer -= dt;
  if (megTimer <= 0){ megAlert = 1.6; megPending = true; megTimer = srange(80, 140); sfxAlert(); callout('⚠ MEGALODON INCOMING', 'danger'); }
  if (megAlert > 0){ megAlert -= dt; shake = Math.max(shake, 2.5); if (megAlert <= 0 && megPending){ megPending = false; spawnMegalodon(); } }
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
    b.life -= dt;
    // SWEPT movement: advance in <=6px sub-steps so fast bullets can't tunnel through fish
    const move = Math.hypot(b.vx, b.vy)*dt;
    const steps = Math.max(1, Math.ceil(move/6));
    const sx = b.vx*dt/steps, sy = b.vy*dt/steps;
    let done=false;
    for (let st=0; st<steps && !done; st++){
      b.x += sx; b.y += sy;
      if (b.x<-20||b.x>W+20||b.y<-20||b.y>H+20){ b.life = 0; break; }
      for (const f of fish){
        const s=f.size, dx=f.x-b.x, dy=f.y-b.y;
        if (dx*dx+dy*dy > (s*2.2+b.r)*(s*2.2+b.r)) continue;        // broad phase
        const mk=f.spriteFrom||f.key, mask=MASK[mk]||(f.jackpot?MASK['golden']:null);
        let hit=false;
        if (mask){
          const an=FISHANIM[mk]||(f.jackpot?FISHANIM['golden']:null);
          const bw=s*3.8, bh=(an&&an.ready)?bw*((an.img.height/an.rows)/(an.img.width/an.cols)):s*2.4;
          let lx=b.x-f.x; const ly=b.y-f.y; if (f.vx<0) lx=-lx;
          const u=(lx+bw/2)/bw, v=(ly+bh/2)/bh;
          if (u>=0&&u<=1&&v>=0&&v<=1){
            const mx=Math.min(mask.mw-1,(u*mask.mw)|0), my=Math.min(mask.mh-1,(v*mask.mh)|0);
            for (let oy=-1; oy<=1 && !hit; oy++) for (let ox=-1; ox<=1; ox++){   // forgiving on silhouette edges
              const cx=mx+ox, cy=my+oy; if(cx<0||cy<0||cx>=mask.mw||cy>=mask.mh) continue;
              if (mask.data[cy*mask.mw+cx]){ hit=true; break; }
            }
          }
          if (!hit){ const ex=s*1.15, ey=s*0.6, lxx=b.x-f.x, lyy=b.y-f.y; if ((lxx*lxx)/(ex*ex)+(lyy*lyy)/(ey*ey) <= 1) hit=true; }   // always-hit body core
        } else {
          const ex=s*1.6, ey=s*0.82, lx=b.x-f.x, ly=b.y-f.y;
          hit = (lx*lx)/(ex*ex)+(ly*ly)/(ey*ey) <= 1;
        }
        if (hit){ hurtFish(f, b.dmg, b.x, b.y, b.owner); b.life = 0; done=true; break; }
      }
      if (done) break;
      for (const pu of powerups){
        const dx=pu.x-b.x, dy=pu.y-b.y;
        if (dx*dx+dy*dy < (pu.r+b.r+6)*(pu.r+b.r+6)){ activatePowerup(pu); b.life=0; done=true; break; }
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
  lurker = { x: fromLeft? -W*0.35 : W*1.35, y: rand(H*0.28, H*0.58), vx:(fromLeft?1:-1)*rand(30,46),
    dir:fromLeft?1:-1, size:rand(250,350), t:0, phase:Math.random()*6.28 };
}
function updateBgLife(dt){
  if (descent < 0.99) return;
  for (const f of bgFish){ f.t+=dt; f.x+=f.vx*dt; f.y = f.baseY + Math.sin(f.t*f.freq+f.phase)*f.amp; }
  bgFish = bgFish.filter(f => f.x>-70 && f.x<W+70);
  while (bgFish.length < 5) spawnBgFish();
  lurker = null; // monster silhouette removed per request
}
function drawLurker(L){
  const s=L.size, ts=L.t;
  const edge = clamp(Math.min(L.x + W*0.3, W*1.3 - L.x)/(W*0.35), 0, 1);
  if (edge<=0) return;
  ctx.save(); ctx.translate(L.x, L.y); if (L.dir<0) ctx.scale(-1,1);
  // murky halo
  ctx.globalAlpha = 0.26*edge;
  const halo = ctx.createRadialGradient(-s*0.4,0,s*0.2,-s*0.4,0,s*2.1);
  halo.addColorStop(0,'rgba(0,3,8,0.7)'); halo.addColorStop(1,'rgba(0,3,8,0)');
  ctx.fillStyle=halo; ctx.beginPath(); ctx.ellipse(-s*0.4,0,s*2.1,s*0.85,0,0,6.28); ctx.fill();
  // undulating serpent body (head at +x, tail at -x)
  const N=16, P=[];
  for (let i=0;i<=N;i++){
    const u=i/N;
    const x=(1.05 - u*2.8)*s;
    const yo=Math.sin(ts*1.1 - u*5.0 + L.phase)*s*0.12*u;
    const half=Math.max(2,(0.30*Math.sin(u*Math.PI*0.95)+0.05)*s*(1-u*0.55));
    P.push([x,yo,half]);
  }
  ctx.globalAlpha=0.44*edge; ctx.fillStyle='rgba(1,4,10,1)';
  ctx.beginPath(); ctx.moveTo(P[0][0],P[0][1]-P[0][2]);
  for (let i=0;i<P.length;i++) ctx.lineTo(P[i][0],P[i][1]-P[i][2]);
  for (let i=P.length-1;i>=0;i--) ctx.lineTo(P[i][0],P[i][1]+P[i][2]);
  ctx.closePath(); ctx.fill();
  // dorsal spikes
  ctx.beginPath();
  for (let i=2;i<N-3;i+=2){ const p=P[i]; ctx.moveTo(p[0]+s*0.04,p[1]-p[2]); ctx.lineTo(p[0]+s*0.10,p[1]-p[2]-s*0.18); ctx.lineTo(p[0]-s*0.06,p[1]-p[2]); }
  ctx.fill();
  // tail fin
  const tl=P[N];
  ctx.beginPath(); ctx.moveTo(tl[0],tl[1]); ctx.lineTo(tl[0]-s*0.36,tl[1]-s*0.32); ctx.lineTo(tl[0]-s*0.18,tl[1]); ctx.lineTo(tl[0]-s*0.36,tl[1]+s*0.32); ctx.closePath(); ctx.fill();
  // glowing red eyes
  const breathe=0.6+0.4*Math.sin(ts*3+L.phase);
  ctx.globalAlpha=0.92*edge; ctx.shadowColor='#ff1414'; ctx.shadowBlur=26; ctx.fillStyle='#ff2e2e';
  const er=s*0.05+breathe*2.5;
  ctx.beginPath(); ctx.arc(s*0.80,-s*0.05,er,0,6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(s*0.64,-s*0.02,er*0.66,0,6.28); ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
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
  if (lurker) drawLurker(lurker);
}

function drawKelp(bx, by, h, w, ph, ts){
  const N=10, L=[], R=[];
  for (let i=0;i<=N;i++){
    const t=i/N, yy=by - t*h;
    const sway=Math.sin(ts*1.15 + ph + t*2.6)*(w*2.4)*t;
    const ww=Math.max(1, w*(1-0.78*t));
    L.push([bx+sway-ww, yy]); R.push([bx+sway+ww, yy]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0],L[0][1]);
  for (let i=1;i<L.length;i++) ctx.lineTo(L[i][0],L[i][1]);
  for (let i=R.length-1;i>=0;i--) ctx.lineTo(R[i][0],R[i][1]);
  ctx.closePath();
  const g=ctx.createLinearGradient(0,by-h,0,by);
  g.addColorStop(0,'rgba(34,98,88,0)'); g.addColorStop(0.5,'rgba(20,76,72,0.45)'); g.addColorStop(1,'rgba(11,52,54,0.8)');
  ctx.fillStyle=g; ctx.fill();
  // a couple of lighter fronds for detail
  ctx.strokeStyle='rgba(60,150,130,0.25)'; ctx.lineWidth=2;
  ctx.beginPath();
  for (let i=0;i<=N;i++){ const t=i/N, yy=by-t*h, sway=Math.sin(ts*1.15+ph+t*2.6)*(w*2.4)*t; i===0?ctx.moveTo(bx+sway,yy):ctx.lineTo(bx+sway,yy); }
  ctx.stroke();
}
function drawSceneFX(ts, vis){
  // glowing eyes lurking in the rocks/caves
  const EYES=[[0.94,0.70,'#ffcf3a',2.1],[0.20,0.87,'#5affd2',4.0],[0.5,0.93,'#bf7aff',1.4]];
  ctx.save();
  for (const e of EYES){
    const blink=Math.sin(ts*1.7 + e[3]*3);
    const on = blink < -0.8 ? 0 : (0.5+0.5*Math.sin(ts*2.5+e[3]));
    if (on<=0.05) continue;
    const ex=W*e[0], ey=H*e[1], er=3.0;
    ctx.globalAlpha=on*0.9*vis; ctx.shadowColor=e[2]; ctx.shadowBlur=13; ctx.fillStyle=e[2];
    ctx.beginPath(); ctx.arc(ex,ey,er,0,6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(ex+er*2.7,ey-1,er*0.92,0,6.28); ctx.fill();
  }
  ctx.shadowBlur=0; ctx.restore();
  // bubble vents rising from the reef
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const VENTS=[[0.10,0.84],[0.89,0.80],[0.30,0.92],[0.62,0.90]];
  for (let vi=0;vi<VENTS.length;vi++){
    const vx=W*VENTS[vi][0], vy=H*VENTS[vi][1];
    for (let i=0;i<5;i++){
      const prog=((ts*0.38 + i*0.2 + vi*0.17)%1+1)%1;
      const by=vy-prog*H*0.30, bx=vx+Math.sin(ts*2+i+vi)*5, br=1.3+(1-prog)*1.2;
      ctx.globalAlpha=0.16*(1-prog)*vis; ctx.fillStyle='rgba(200,240,250,0.6)';
      ctx.beginPath(); ctx.arc(bx,by,br,0,6.28); ctx.fill();
    }
  }
  ctx.restore();
  // light glints on coral
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const GL=[[0.16,0.80],[0.84,0.77],[0.42,0.90],[0.58,0.87],[0.06,0.58],[0.93,0.60]];
  for (let gi=0;gi<GL.length;gi++){
    const tt=((ts*0.6 + gi*1.7)%4);
    if (tt>0.6) continue;
    const a=Math.sin(tt/0.6*Math.PI)*0.8*vis;
    if (a<=0) continue;
    const gx=W*GL[gi][0], gy=H*GL[gi][1], r=2+a*4;
    ctx.globalAlpha=a; ctx.fillStyle='rgba(255,255,245,0.95)'; ctx.shadowColor='#fff'; ctx.shadowBlur=9;
    ctx.beginPath(); ctx.arc(gx,gy,r*0.5,0,6.28); ctx.fill();
    ctx.strokeStyle='rgba(255,255,245,'+a.toFixed(3)+')'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(gx-r*2,gy); ctx.lineTo(gx+r*2,gy); ctx.moveTo(gx,gy-r*2); ctx.lineTo(gx,gy+r*2); ctx.stroke();
  }
  ctx.shadowBlur=0; ctx.restore();
}
function drawWaterLife(ts, d){
  if (d < 0.85) return;
  const vis = Math.min(1,(d-0.85)/0.15);
  // rising bubble streams
  ctx.save();
  for (let i=0;i<18;i++){
    const sd=i*51.3;
    const colX=(Math.sin(sd)*0.5+0.5)*W;
    const prog=((ts*(0.05+0.028*(i%4)) + (Math.sin(sd*1.7)*0.5+0.5)) % 1 + 1)%1;
    const by=H - prog*H*1.04;
    const bx=colX + Math.sin(ts*1.4 + i*2.1 + prog*6)*10;
    const br=1.6 + (i%4)*1.2 + (1-prog)*1.1;
    const a=(0.12+0.10*Math.sin(prog*Math.PI))*vis;
    ctx.globalAlpha=a;
    ctx.fillStyle='rgba(170,225,240,0.16)'; ctx.strokeStyle='rgba(205,240,250,0.55)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(bx,by,br,0,6.28); ctx.fill(); ctx.stroke();
    ctx.globalAlpha=a*0.9; ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(bx-br*0.3,by-br*0.3,br*0.28,0,6.28); ctx.fill();
  }
  ctx.globalAlpha=1; ctx.restore();
  // drifting water waves through the column
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for (let i=0;i<5;i++){
    const wy=H*(0.16+0.12*i);
    ctx.globalAlpha=0.05*vis;
    ctx.strokeStyle='rgba(150,228,238,0.6)'; ctx.lineWidth=2+i*0.4;
    ctx.beginPath();
    for (let x=0;x<=W;x+=26){ const yy=wy + Math.sin(x*0.011 + ts*0.85 + i*1.4)*11 + Math.sin(x*0.028 - ts*1.15)*4; x===0?ctx.moveTo(x,yy):ctx.lineTo(x,yy); }
    ctx.stroke();
  }
  ctx.restore();
  // animated plants (mixed colours) swaying over the scene
  ctx.save(); ctx.globalAlpha = vis;
  const _PL = {green:algeAnim, purple:algePurple, orange:algeOrange, teal:algeTeal, coral:coralFan};
  for (const pi of PLANTINST){
    const img=_PL[pi[0]];
    if (!img || !img.complete || !img.naturalWidth) continue;
    const fw=img.width/4, fh=img.height/4;
    const fr=(Math.floor(ts*8 + pi[3])%16+16)%16;
    const cx=(fr%4)*fw, cy=Math.floor(fr/4)*fh;
    const _drop = (pi[0]==='purple') ? H*0.05 : 0;   // sink purple plants so their baked base-shadow goes off-screen
    const dH=H*pi[2], dW=dH*(fw/fh), dx=W*pi[1]-dW/2, dy=H-dH+12+_drop;
    ctx.drawImage(img, cx,cy,fw,fh, dx,dy,dW,dH);
  }
  ctx.globalAlpha=1; ctx.restore();
  drawSceneFX(ts, vis);
}
function drawBackground(time){
  const ts = time*0.001;
  const d = descent;

  if (sceneReady && d > 0.85){
    const ir = sceneImg.width/sceneImg.height, cr = W/H;
    let dw,dh; if (cr>ir){ dw=W; dh=W/ir; } else { dh=H; dw=H*ir; }
    ctx.drawImage(sceneImg, (W-dw)/2, (H-dh)/2, dw, dh);
    const ov = ctx.createLinearGradient(0,0,0,H);
    ov.addColorStop(0,'rgba(4,18,31,.16)'); ov.addColorStop(0.55,'rgba(2,12,22,.10)'); ov.addColorStop(1,'rgba(1,7,13,.48)');
    ctx.fillStyle = ov; ctx.fillRect(0,0,W,H);
    // drifting caustic light — living water over the scene
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for (let i=0;i<6;i++){
      const cx2 = (((Math.sin(i*2.3)*0.5+0.5) + ts*0.015*(1+i*0.22)) % 1) * W;
      const cy2 = H*(0.16+0.13*i) + Math.sin(ts*0.55+i*1.3)*16;
      const rr = 150+i*34;
      const cg = ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,rr);
      cg.addColorStop(0,`rgba(125,215,228,${(0.045+0.008*i).toFixed(3)})`); cg.addColorStop(1,'rgba(125,215,228,0)');
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(cx2,cy2,rr,0,6.28); ctx.fill();
    }
    ctx.restore();
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

  drawWaterLife(ts, d);

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
  const _fa = FISHANIM[f.spriteFrom||f.key] || (f.jackpot ? FISHANIM['golden'] : null);
  if (_fa && _fa.ready){
    const fw=_fa.img.width/_fa.cols, fh=_fa.img.height/_fa.rows;
    const fr=Math.floor(performance.now()*_fa.rate)%_fa.frames;
    const cxx=(fr%_fa.cols)*fw, cyy=Math.floor(fr/_fa.cols)*fh;
    ctx.shadowBlur=0;
    const bw=s*3.8, bh=bw*fh/fw;            // keep frame aspect -> no distortion
    ctx.drawImage(_fa.img, cxx, cyy, fw, fh, -bw/2, -bh/2, bw, bh);
    if (f.hitFlash>0){ drawFlash(_fa.img, cxx, cyy, fw, fh, bw, bh, Math.min(0.8,f.hitFlash*6)); }
    ctx.restore(); return;
  }
  // ── sprite hook (ludo.ai): use bitmap if provided ──
  const _sk = f.spriteFrom || f.key;
  const spr = (FISH_TYPES[_sk] && FISH_TYPES[_sk].sprite) || (f.jackpot && FISH_TYPES.golden ? FISH_TYPES.golden.sprite : null);
  if (spr && spr.complete){
    const _ox=-s*1.9, _oy=-s*1.2, _dw=s*3.8, _dh=s*2.4;
    ctx.shadowBlur = 0;                 // no glow
    ctx.drawImage(spr, _ox, _oy, _dw, _dh);   // static, complete sprite as-is
    // damage flash — fish turns red when hit
    if (f.hitFlash > 0){ drawFlash(spr, 0, 0, spr.width, spr.height, _dw, _dh, Math.min(0.8, f.hitFlash*6)); }
    ctx.restore(); return;
  }

  const tail = Math.sin(f.wig)*0.5;
  ctx.shadowColor = f.glow;
  ctx.shadowBlur  = f.shiny||f.boss ? 14 : 0;

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

  ctx.restore();
}

function startSeating(fmt){
  multiFormat=fmt;
  fish=[]; bullets=[]; particles=[]; pops=[]; rings=[]; powerups=[];
  score=0; credits=100000; creditsShown=credits; timeLeft=ROUND_TIME; brokeT=0;
  combo=1; comboKills=0; comboTimer=0; spawnTimer=0; elapsed=0; shake=0; flash=0; firing=false;
  cannonHome=null; chosenSeat=null;
  stats = { shots:0, hits:0, kills:0, bestCombo:1, biggest:'\u2014', biggestVal:0, coins:0 };
  setWpn(1); updateHUD();
  if (fmt==='1v1'){
    seats=[{x:W*0.16,y:H*0.82},{x:W*0.84,y:H*0.82}];
  } else {
    const per = (fmt==='8p') ? 4 : 3;                 // 6p = 3 top + 3 bottom, 8p = 4 top + 4 bottom
    const row=(n,y)=>{ const a=[]; for(let i=0;i<n;i++){ a.push({x: W*(0.14 + 0.72*(n===1?0.5:i/(n-1))), y}); } return a; };
    seats=[...row(per, H*0.20), ...row(per, H*0.82)];
  }
  descent=1; mode='multi'; phase='seating'; running=false;
  document.getElementById('overlay-start').classList.add('hidden');
  document.getElementById('overlay-end').classList.add('hidden');
  document.body.classList.add('playing');
}
function pickSeat(px,py){
  for (const sX of seats){ if (Math.hypot(sX.x-px, sX.y-py) < 60){
    chosenSeat=sX; cannonHome={x:sX.x,y:sX.y}; cannon.x=sX.x; cannon.y=sX.y;
    bots=[]; const _bn=['Sharky','DeepBlue','Kraken','FinJet','AbyssAce','TideWolf','Coralis','NeptuneX'], _bc=['#ff8a5b','#b07bff','#5affd2','#ff6f9c']; let _ni=Math.random()*_bn.length|0,_ci=0;
    for (const s2 of seats){ if (s2!==chosenSeat){ bots.push({ seat:s2, name:_bn[_ni++ % _bn.length], score:0, fireT:rand(0.3,1.0), col:_bc[_ci++ % _bc.length], aimA:(s2.y<H*0.4?Math.PI/2:-Math.PI/2) }); } }
    matchSeed=(Math.random()*1e9)|0; setSeed(matchSeed); for(let i=0;i<5;i++) spawnFish(false); phase='playing'; running=true; brokeT=0; matchStartT=performance.now(); initAudio(); return;
  } }
}
function drawBots(){
  const _cimg = (cannonReady ? cannonImg : null);   // bots use the standard cannon; skins are personal
  for (const bot of bots){
    const s=bot.seat, a=(bot.aimA!==undefined ? bot.aimA : (s.y<H*0.4?Math.PI/2:-Math.PI/2));
    if (_cimg){
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(a + Math.PI/2);
      ctx.shadowColor = bot.col; ctx.shadowBlur = 12;
      const _cw = CN_TH * ((_cimg.width/_cimg.height) || 0.756);
      ctx.drawImage(_cimg, -_cw/2, -CN_JOINT*CN_TH, _cw, CN_TH);
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(a);
      ctx.shadowColor='#28e0c8'; ctx.shadowBlur=14;
      const bg=ctx.createLinearGradient(0,-9,0,9); bg.addColorStop(0,'#2bf0d6'); bg.addColorStop(1,'#0b6f66');
      ctx.fillStyle=bg; roundRect(0,-9,cannon.len,18,8); ctx.fill(); ctx.restore();
    }
    // name + score label, clear of the cannon body
    const by = s.y<H*0.4 ? s.y + CN_TH*0.42 + 14 : s.y - CN_TH*0.42 - 6;
    ctx.save(); ctx.textAlign='center';
    ctx.font='800 12px Segoe UI,sans-serif'; ctx.shadowColor='rgba(0,0,0,.85)'; ctx.shadowBlur=4;
    ctx.fillStyle=bot.col; ctx.fillText(bot.name, s.x, by);
    ctx.fillStyle='#ffce63'; ctx.fillText(formatNum(bot.score), s.x, by+15);
    ctx.restore();
  }
}
function drawScoreboard(){
  const ps=[{n:NICK,sc:score,me:true}].concat(bots.map(b=>({n:b.name,sc:b.score})));
  ps.sort((a,b)=>b.sc-a.sc);
  const w=190, x=(W-w)/2, y=58, rh=19, h=ps.length*rh+12;
  ctx.save();
  ctx.fillStyle='rgba(4,16,24,0.72)'; ctx.strokeStyle='rgba(80,200,200,0.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.rect(x,y,w,h); ctx.fill(); ctx.stroke();
  ps.forEach((pp,i)=>{ const yy=y+14+i*rh;
    ctx.font=(pp.me?'800':'600')+' 12px Segoe UI,sans-serif';
    ctx.fillStyle=i===0?'#ffce63':(pp.me?'#aef9ec':'#cfe9ee'); ctx.textAlign='left';
    ctx.fillText((i+1)+'. '+pp.n+(pp.me?' (you)':''), x+8, yy);
    ctx.textAlign='right'; ctx.fillText(formatNum(pp.sc), x+w-8, yy);
  });
  ctx.restore();
}
function drawSeats(){
  const t=performance.now()*0.003;
  ctx.save(); ctx.fillStyle='rgba(0,0,0,0.52)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.fillStyle='#eaf7ff'; ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=10;
  ctx.font='900 32px Segoe UI,sans-serif'; ctx.fillText('PICK YOUR SEAT', W/2, H*0.46);
  ctx.font='600 16px Segoe UI,sans-serif'; ctx.fillStyle='rgba(215,238,248,0.9)';
  ctx.fillText('Tap a glowing seat to take your spot', W/2, H*0.46+26);
  ctx.shadowBlur=0;
  for (const sX of seats){
    const pulse=0.72+0.28*Math.sin(t*2.4 + sX.x*0.01);
    ctx.save(); ctx.translate(sX.x, sX.y);
    const R=50;
    const g=ctx.createRadialGradient(0,0,4,0,0,R);
    g.addColorStop(0,'rgba(40,224,200,'+(0.40*pulse).toFixed(3)+')'); g.addColorStop(1,'rgba(40,224,200,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,R,0,6.28); ctx.fill();
    ctx.globalAlpha=pulse; ctx.strokeStyle='#3affe0'; ctx.lineWidth=3.5; ctx.shadowColor='#28e0c8'; ctx.shadowBlur=22;
    ctx.beginPath(); ctx.arc(0,0,R*0.62+Math.sin(t*3)*2,0,6.28); ctx.stroke();
    ctx.lineWidth=9; ctx.lineCap='round';
    const r=21; ctx.beginPath(); ctx.moveTo(-r,0); ctx.lineTo(r,0); ctx.moveTo(0,-r); ctx.lineTo(0,r); ctx.stroke();
    ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.fillStyle='#aef9ec'; ctx.font='900 13px Segoe UI,sans-serif'; ctx.textAlign='center';
    ctx.fillText('TAP TO SIT', 0, R+20);
    ctx.restore();
  }
  ctx.restore();
}
function drawOtherSeats(){
  const t=performance.now()*0.003;
  ctx.save(); ctx.textAlign='center';
  for (const sX of seats){ if (sX===chosenSeat) continue;
    const pulse=0.6+0.4*Math.sin(t*2 + sX.x*0.01);
    ctx.save(); ctx.translate(sX.x, sX.y);
    ctx.globalAlpha=0.55*pulse; ctx.strokeStyle='#7fd4ff'; ctx.lineWidth=2.5; ctx.setLineDash([6,6]); ctx.shadowColor='#7fd4ff'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(0,0,30,0,6.28); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur=0;
    ctx.globalAlpha=1; ctx.font='800 13px Segoe UI,sans-serif';
    const lbl='WAITING\u2026', w=ctx.measureText(lbl).width+20;
    const rx=-w/2, ry=-13, rr=13;
    ctx.fillStyle='rgba(6,22,32,0.88)'; ctx.beginPath();
    ctx.moveTo(rx+rr,ry); ctx.arcTo(rx+w,ry,rx+w,ry+26,rr); ctx.arcTo(rx+w,ry+26,rx,ry+26,rr); ctx.arcTo(rx,ry+26,rx,ry,rr); ctx.arcTo(rx,ry,rx+w,ry,rr); ctx.fill();
    ctx.strokeStyle='rgba(127,212,255,0.7)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#cfeaff'; ctx.fillText(lbl, 0, 5);
    ctx.restore();
  }
  ctx.restore();
}
function drawNick(){
  ctx.save(); ctx.textAlign='center'; ctx.font='800 13px Segoe UI,sans-serif';
  ctx.fillStyle='#ffce63'; ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=4;
  ctx.fillText(NICK, cannon.x, cannon.y < H*0.4 ? cannon.y+50 : cannon.y-50);
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
    const _ac = currentBulletColor();
    const _t2 = performance.now()*0.004;
    const _pulse = 0.6 + 0.4*Math.sin(_t2);
    const _cy = cannon.y - CN_TH*0.18;
    // soft pulsing aura behind the cannon
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const _ag = ctx.createRadialGradient(cannon.x,_cy,4, cannon.x,_cy,CN_TH*0.55);
    _ag.addColorStop(0, hexA(_ac, 0.32*_pulse)); _ag.addColorStop(1, hexA(_ac, 0));
    ctx.fillStyle=_ag; ctx.beginPath(); ctx.arc(cannon.x,_cy,CN_TH*0.55,0,6.28); ctx.fill();
    // orbiting energy sparks
    for (let i=0;i<3;i++){
      const _an=_t2*1.4 + i*2.094;
      const _ox=cannon.x + Math.cos(_an)*CN_TW*0.5, _oy=_cy + Math.sin(_an)*CN_TH*0.16;
      ctx.fillStyle=hexA(_ac,0.75); ctx.beginPath(); ctx.arc(_ox,_oy,2.4+_pulse,0,6.28); ctx.fill();
    }
    ctx.restore();
    // cannon body, glow in skin colour
    ctx.save();
    ctx.translate(cannon.x, cannon.y);
    ctx.rotate(a + Math.PI/2);
    ctx.shadowColor = _ac; ctx.shadowBlur = 16;
    const _cw = CN_TH * ((_cimg.width/_cimg.height) || 0.756);
    ctx.drawImage(_cimg, -_cw/2, -CN_JOINT*CN_TH, _cw, CN_TH);
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
  if (phase==='seating') drawSeats();

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

  if (phase==='playing' && mode==='multi'){ drawBots(); drawScoreboard(); }
  if (phase !== 'seating') drawCannon();
  if (phase==='playing' && mode==='multi') drawNick();

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
  if (megAlert > 0){
    const blink = Math.sin(performance.now()*0.018) > 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 0.18; ctx.fillStyle = '#ff2020';
    ctx.fillRect(0,0,W,16); ctx.fillRect(0,H-16,W,16);
    ctx.globalAlpha = 1; ctx.textAlign='center';
    ctx.fillStyle = blink ? '#ff3838' : '#ffce63';
    ctx.font = '900 '+Math.round(Math.min(W*0.055,50))+'px Segoe UI,sans-serif';
    ctx.shadowColor='#ff2020'; ctx.shadowBlur=22;
    ctx.fillText('!  MEGALODON INCOMING  !', W/2, H*0.28);
    ctx.restore();
  }
  if (freezeT > 0){
    ctx.save(); ctx.globalAlpha = Math.min(0.22, freezeT*0.08);
    const fg = ctx.createLinearGradient(0,0,0,H);
    fg.addColorStop(0,'rgba(160,225,255,0.6)'); fg.addColorStop(1,'rgba(120,200,255,0.1)');
    ctx.fillStyle = fg; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  if (phase==='playing'){
    const act = [];
    if (freezeT>0) act.push(['FREEZE','#7fd4ff',freezeT,7.5]);
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
  score=0; credits=((mode==='free'||mode==='multi')?100000:START_CREDITS); creditsShown=credits; timeLeft=ROUND_TIME; brokeT=0; matchStartT=performance.now();
  combo=1; comboKills=0; comboTimer=0; spawnTimer=0; elapsed=0;
  shake=0; flash=0; wpnLevel=1; firing=false;
  powerups=[]; puTimer=18; freezeT=0; doubleT=0; multiT=0; cannonHome=null; bots=[];
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
  fish = []; bullets = []; particles = []; pops = []; rings = []; bots = [];
  seedAmbient();
  renderMenu();
  document.getElementById('overlay-end').classList.add('hidden');
  document.getElementById('overlay-start').classList.remove('hidden');
}

setInterval(()=>{ if (running && (mode==='tournament'||mode==='multi') && matchStartT){ if (performance.now()-matchStartT >= ROUND_TIME*1000){ timeLeft=0; endGame(); } } }, 1000);
function endGame(){
  if (phase === 'over') return;            // guard: never settle a match twice
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
  const _mxp = Math.round(score/500) + Math.floor(stats.kills/2);
  xpAdd(_mxp); questProgress('play', 1);

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

  // ── multiplayer settlement: winner (highest score) takes the prize ──
  if (mode==='multi'){
    const topBot = bots.length ? Math.max(...bots.map(b=>b.score)) : 0;
    const won = score >= topBot;
    if (won){ wallet += roomPrize; questProgress('win',1); }
    saveWallet();
    pbEl.innerHTML = won
      ? `<span class="end-pb-hit">\u{1F3C6} YOU WON +$${roomPrize.toFixed(2)}</span>`
      : `Not 1st this time — entry $${roomEntry.toFixed(2)} lost`;
    dEl.textContent = `Balance: $${formatNum(wallet)}  \u00b7  +${_mxp} XP earned`;
    if (won){ const _c=document.querySelector('#overlay-end .ov-card'); if(_c) _c.classList.add('record'); celebrate(); }
  }

  { const _c=document.querySelector('#overlay-end .ov-card'); if(_c && mode!=='multi') _c.classList.toggle('record', isPB); }
  if (isPB && mode!=='multi') celebrate();
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
{ const b=document.getElementById('btn-start'); if(b) b.onclick=()=>{ mode='tournament'; startGame(); }; }
const _sm = document.getElementById('soon-msg');
function showSoon(w){ if(_sm){ _sm.textContent = w + ' - coming soon'; _sm.classList.add('show'); clearTimeout(showSoon._t); showSoon._t=setTimeout(()=>_sm.classList.remove('show'),1900); } }
{ const b=document.getElementById('btn-multi'); if(b) b.onclick=()=>{ const ll=document.getElementById('lobby-landing'), rv=document.getElementById('rooms-view'); if(ll)ll.classList.add('hidden'); if(rv)rv.classList.remove('hidden'); renderRooms(); }; }
document.querySelectorAll('#multi-mode .mode-btn').forEach(b=>{ b.onclick=()=>{ multiFormat=b.dataset.fmt; const _om=document.getElementById('overlay-multi'); if(_om) _om.classList.add('hidden'); startSeating(multiFormat); }; });
function openSeats(fmt){
  const table=document.getElementById('seat-table'); if(!table) return; table.innerHTML='';
  const sub=document.getElementById('seat-sub'); if(sub) sub.textContent = fmt==='1v1' ? '1v1 Duel - pick your side' : '4-Player table - pick your seat';
  const seats = fmt==='1v1' ? ['left','right'] : ['tl','tr','bl','br'];
  seats.forEach((pos,i)=>{ const el=document.createElement('div'); el.className='seat '+pos;
    el.innerHTML='<div class="seat-ico">\u{1FA91}</div><div class="seat-lbl">SEAT '+(i+1)+'</div>';
    el.onclick=()=>takeSeat(i,el); table.appendChild(el); });
  const om=document.getElementById('overlay-multi'); if(om) om.classList.add('hidden');
  const os=document.getElementById('overlay-seat'); if(os) os.classList.remove('hidden');
}
function takeSeat(i,el){
  document.querySelectorAll('#seat-table .seat').forEach(sx=>{ sx.style.pointerEvents='none'; if(sx!==el){ const l=sx.querySelector('.seat-lbl'); if(l) l.textContent='WAITING...'; } });
  el.classList.add('taken'); const l=el.querySelector('.seat-lbl'); if(l) l.textContent='YOU'; const ic=el.querySelector('.seat-ico'); if(ic) ic.textContent='\u{1F7E2}';
  multiSeat=i;
  setTimeout(()=>{ const os=document.getElementById('overlay-seat'); if(os) os.classList.add('hidden'); mode='multi'; startGame(); }, 900);
}
{ const b=document.getElementById('seat-close'); if(b) b.onclick=()=>{ const os=document.getElementById('overlay-seat'); if(os) os.classList.add('hidden'); const om=document.getElementById('overlay-multi'); if(om) om.classList.remove('hidden'); }; }
{ const b=document.getElementById('multi-close'); if(b) b.onclick=()=>{ const o=document.getElementById('overlay-multi'); if(o) o.classList.add('hidden'); }; }
{ const b=document.getElementById('btn-demo'); if(b) b.onclick=()=>{ mode='free'; startGame(); }; }
{ const b=document.getElementById('btn-credits'); if(b) b.onclick=()=>{ renderCredits(); const o=document.getElementById('overlay-credits'); if(o) o.classList.remove('hidden'); }; }
{ const b=document.getElementById('btn-practice'); if(b) b.onclick=()=>{ document.getElementById('overlay-start').classList.add('hidden'); mode='free'; startGame(); }; }
{ const b=document.getElementById('btn-go-multi'); if(b) b.onclick=()=>{ const ll=document.getElementById('lobby-landing'), rv=document.getElementById('rooms-view'); if(ll)ll.classList.add('hidden'); if(rv)rv.classList.remove('hidden'); renderRooms(); }; }
{ const b=document.getElementById('btn-rooms-back'); if(b) b.onclick=()=>{ const ll=document.getElementById('lobby-landing'), rv=document.getElementById('rooms-view'); if(rv)rv.classList.add('hidden'); if(ll)ll.classList.remove('hidden'); }; }
{ const b=document.getElementById('btn-skins'); if(b) b.onclick=()=>{ renderShop(); const o=document.getElementById('overlay-shop'); if(o) o.classList.remove('hidden'); }; }
{ const b=document.getElementById('shop-close'); if(b) b.onclick=()=>{ const o=document.getElementById('overlay-shop'); if(o) o.classList.add('hidden'); }; }
{ const b=document.getElementById('btn-daily'); if(b) b.onclick=()=>{ renderQuests(); const o=document.getElementById('overlay-daily'); if(o) o.classList.remove('hidden'); }; }
{ const b=document.getElementById('daily-close'); if(b) b.onclick=()=>{ const o=document.getElementById('overlay-daily'); if(o) o.classList.add('hidden'); }; }
{ const b=document.getElementById('credits-close'); if(b) b.onclick=()=>{ const o=document.getElementById('overlay-credits'); if(o) o.classList.add('hidden'); }; }
document.getElementById('btn-again').onclick = () => {
  if (mode === 'multi'){
    // multiplayer: send the player back to the rooms tab to pick a room again
    exitToMenu();
    const ll=document.getElementById('lobby-landing'), rv=document.getElementById('rooms-view');
    if (ll) ll.classList.add('hidden'); if (rv) rv.classList.remove('hidden');
    renderRooms();
  } else {
    startGame();
  }
};
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
