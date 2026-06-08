/* ============================================================
   TOWER RUSH — game.js  (full rewrite with tier/merge/shop/100-wave systems)
   ============================================================ */

// ── Constants ─────────────────────────────────────────────
const W = 1200, H = 700;

const PATH = [
  {x: -40,  y: 210},
  {x: 270,  y: 210},
  {x: 270,  y: 510},
  {x: 580,  y: 510},
  {x: 580,  y: 160},
  {x: 880,  y: 160},
  {x: 880,  y: 510},
  {x: 1190, y: 510},
];

// Precompute path segment lengths + cumulative distance
const PATH_SEGS = [];
let totalPathLen = 0;
for (let i = 0; i < PATH.length - 1; i++) {
  const dx = PATH[i+1].x - PATH[i].x;
  const dy = PATH[i+1].y - PATH[i].y;
  const len = Math.hypot(dx, dy);
  PATH_SEGS.push({ dx, dy, len, startDist: totalPathLen });
  totalPathLen += len;
}

// Convert distance-traveled to canvas (x,y)
function distToXY(dist) {
  let d = Math.max(0, Math.min(dist, totalPathLen));
  for (let i = 0; i < PATH_SEGS.length; i++) {
    const seg = PATH_SEGS[i];
    if (d <= seg.len + 0.001) {
      const t = d / seg.len;
      return {
        x: PATH[i].x + seg.dx * t,
        y: PATH[i].y + seg.dy * t,
      };
    }
    d -= seg.len;
  }
  return { x: PATH[PATH.length-1].x, y: PATH[PATH.length-1].y };
}

// ── Tier system ───────────────────────────────────────────
const TIER_NAMES  = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const TIER_COLORS = ['', '#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24'];
const TIER_MULT   = [0, 1, 2.5, 5.5, 11, 22];

// ── Tower definitions (T1 base stats) ────────────────────
const TOWER_DEFS = {
  fire:   { name:'Fire Tower',   emoji:'🔥', cost:50,  dmg:25, spd:1.5, range:120, color:'#ef4444', special:'burn',    burnDmg:5,   burnDur:3000 },
  ice:    { name:'Ice Tower',    emoji:'❄️', cost:60,  dmg:15, spd:1.0, range:140, color:'#60a5fa', special:'slow',    slowAmt:0.5, slowDur:2000 },
  storm:  { name:'Storm Tower',  emoji:'⚡', cost:75,  dmg:20, spd:2.0, range:100, color:'#fbbf24', special:'chain',   chainCount:3 },
  shadow: { name:'Shadow Tower', emoji:'🌑', cost:80,  dmg:40, spd:0.8, range:160, color:'#7c3aed', special:'poison',  poisonDmg:8, poisonDur:5000 },
  light:  { name:'Light Tower',  emoji:'✨', cost:90,  dmg:30, spd:1.2, range:130, color:'#f9fafb', special:'stun',    stunDur:1500 },
  nova:   { name:'Nova Tower',   emoji:'💥', cost:150, dmg:80, spd:0.5, range:180, color:'#c084fc', special:'explode', explodeR:100, explodeDmg:40 },
};

const TOWER_TYPES = Object.keys(TOWER_DEFS);

// ── Enemy definitions ─────────────────────────────────────
const ENEMY_DEFS = {
  fire_grunt:    { name:'Fire Grunt',     emoji:'🔴', hp:180,  spd:70,  reward:10,  element:'fire',   color:'#ef4444' },
  ice_grunt:     { name:'Ice Grunt',      emoji:'🔵', hp:150,  spd:85,  reward:10,  element:'ice',    color:'#60a5fa' },
  storm_grunt:   { name:'Storm Grunt',    emoji:'🟡', hp:160,  spd:100, reward:10,  element:'storm',  color:'#fbbf24' },
  shadow_walker: { name:'Shadow Walker',  emoji:'🟣', hp:380,  spd:60,  reward:25,  element:'shadow', color:'#7c3aed', special:'stealth' },
  light_sprite:  { name:'Light Sprite',   emoji:'⚪', hp:280,  spd:145, reward:25,  element:'light',  color:'#f9fafb', special:'speedup' },
  armored_brute: { name:'Armored Brute',  emoji:'🟠', hp:700,  spd:38,  reward:50,  element:'fire',   color:'#f97316', special:'armor' },
  void_shifter:  { name:'Void Shifter',   emoji:'🌀', hp:550,  spd:82,  reward:50,  element:'shadow', color:'#a855f7', special:'teleport' },
  thunder_dasher:{ name:'Thunder Dasher', emoji:'⚡', hp:450,  spd:210, reward:50,  element:'storm',  color:'#eab308' },
  tidal_giant:   { name:'Tidal Giant',    emoji:'🌊', hp:1400, spd:32,  reward:75,  element:'ice',    color:'#06b6d4', special:'spawn_on_death' },
  mini_boss:     { name:'Mini Boss',      emoji:'👹', hp:1500, spd:55,  reward:100, element:'multi',  color:'#f97316', special:'miniboss', size:1.8 },
  boss:          { name:'Elemental Lord', emoji:'💀', hp:2000, spd:50,  reward:200, element:'multi',  color:'#dc2626', special:'boss', size:2.5 },
};

// Element weakness table
const WEAKNESSES = {
  fire:   'ice',
  ice:    'fire',
  storm:  'shadow',
  shadow: 'light',
  light:  'shadow',
};

// ── Slot positions ─────────────────────────────────────────
const SLOT_SIZE = 50;
const SLOTS_DEF = [
  {x:80,  y:140}, {x:130, y:140}, {x:180, y:140}, {x:230, y:140},
  {x:80,  y:270}, {x:130, y:270}, {x:180, y:270},
  {x:190, y:310}, {x:190, y:390}, {x:190, y:460},
  {x:350, y:310}, {x:350, y:390}, {x:350, y:460},
  {x:400, y:430}, {x:470, y:430},
  {x:400, y:580}, {x:470, y:580},
  {x:500, y:270}, {x:500, y:350},
  {x:660, y:270}, {x:660, y:350},
  {x:680, y:90},  {x:750, y:90},  {x:810, y:90},
  {x:680, y:230}, {x:750, y:230},
  {x:800, y:230}, {x:800, y:310}, {x:800, y:390}, {x:800, y:470},
  {x:960, y:230}, {x:960, y:310}, {x:960, y:390}, {x:960, y:470},
];

// ── Pull rates (Gacha) ────────────────────────────────────
const PULL_RATES = [
  {tier:1, weight:55},
  {tier:2, weight:28},
  {tier:3, weight:12},
  {tier:4, weight:4},
  {tier:5, weight:1},
];
const PULL_TOTAL_WEIGHT = PULL_RATES.reduce((s, r) => s + r.weight, 0);

// ── Global state ──────────────────────────────────────────
let nick = '';
let coins = 300;
let baseHP = 1000;
let baseMaxHP = 1000;

// Wave / Level tracking
let currentLevel = 1;    // 1-10
let currentWave  = 1;    // 1-10 within level
let waveIndex    = 0;    // total absolute wave number (1-100), for best wave tracking
let waveActive   = false;
let waveSpawners = [];
let waveEnemiesLeft = 0;
let waveScale    = { hpMult: 1, spdMult: 1, countMult: 1 };
let pendingLevelComplete = false;
let waveStartGameTime = 0;    // scaled gameTime ms when current wave started
const EARLY_WAVE_DELAY = 7000; // scaled ms before next-wave button unlocks

let enemies    = [];
let towers     = [];
let projectiles= [];
let particles  = [];
let floatTexts = [];

let slots = SLOTS_DEF.map((s,i) => ({ ...s, id: i, towerId: null }));

let selectedTowerType = null;  // 'fire','ice',... or null (for buying)
let selectedTowerId   = null;  // id of clicked placed tower
let inventoryPlaceItem = null; // {type, tier, invIndex} when placing from inventory

// Merge system
let mergeMode     = false;
let mergeSelected = []; // array of tower ids

// Shop / inventory
let inventory  = [];  // [{type, tier}]
let pityCount  = 0;

// Abilities
const ABILITIES = {
  tornado:   { name:'Tornado',   emoji:'🌪️', cooldown:45000, lastUsed: -Infinity },
  freeze:    { name:'Freeze All',emoji:'❄️', cooldown:60000, lastUsed: -Infinity },
  airstrike: { name:'Airstrike', emoji:'💣', cooldown:90000, lastUsed: -Infinity },
};
let airstrikeMode = false;
let autoSkip      = false;   // auto-sends next wave after delay
let gameSpeed     = 1;       // 1 = normal, 2 = double speed
let gameTime      = 0;       // scaled game clock in ms (advances faster at 2× speed)

// Screen shake
let shakeFrames = 0;
let shakeAmt = 0;

let enemyIdCounter = 0;
let towerIdCounter = 0;

// Session stats
let sessionKills = 0;
let sessionCoinsEarned = 0;
let bossesKilled = 0;

let lastTime = 0;
let animId = null;
let canvas, ctx;

// ── Level scaling ─────────────────────────────────────────
function levelScale(level) {
  return {
    hpMult:    1 + (level-1) * 0.45,
    spdMult:   1 + (level-1) * 0.08,
    countMult: 1 + (level-1) * 0.5,
  };
}

// ── Wave generation ───────────────────────────────────────
function generateWave(level, waveInLevel) {
  const sc = levelScale(level);
  const isMidBoss   = (waveInLevel === 5);
  const isFinalBoss = (waveInLevel === 10);

  // Enemy pool unlocks per level
  const pool = ['fire_grunt', 'ice_grunt'];
  if (level >= 2) pool.push('storm_grunt');
  if (level >= 3) pool.push('shadow_walker');
  if (level >= 4) pool.push('light_sprite');
  if (level >= 5) pool.push('armored_brute');
  if (level >= 6) pool.push('void_shifter');
  if (level >= 7) pool.push('thunder_dasher');
  if (level >= 8) pool.push('tidal_giant');

  const baseCount = Math.max(3, Math.floor((3 + waveInLevel * 1.5) * sc.countMult));
  const groups = [];

  if (isFinalBoss) {
    groups.push({ type:'boss', count:1, interval:5000 });
    const supportType = pool[Math.floor(Math.random() * pool.length)];
    groups.push({ type:supportType, count:Math.floor(baseCount * 0.5), interval:900 });
  } else if (isMidBoss) {
    groups.push({ type:'mini_boss', count:1, interval:4000 });
    const supportType = pool[Math.floor(Math.random() * pool.length)];
    groups.push({ type:supportType, count:Math.floor(baseCount * 0.6), interval:1000 });
  } else {
    // 1-2 groups of random enemies from pool
    const numGroups = waveInLevel <= 3 ? 1 : 2;
    for (let g = 0; g < numGroups; g++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const cnt  = Math.max(2, Math.floor(baseCount / numGroups));
      const ivl  = ENEMY_DEFS[type].spd > 100 ? 700 : 1200;
      groups.push({ type, count:cnt, interval:ivl });
    }
  }
  return groups;
}

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  nick = localStorage.getItem('portal_nickname') || '';
  if (!nick) {
    document.getElementById('nickname-overlay').classList.remove('hidden');
    document.getElementById('nick-submit').addEventListener('click', submitNick);
    document.getElementById('nick-input').addEventListener('keydown', e => { if(e.key==='Enter') submitNick(); });
  } else {
    startGame();
  }
});

function submitNick() {
  const val = document.getElementById('nick-input').value.trim();
  if (!val) return;
  nick = val;
  localStorage.setItem('portal_nickname', nick);
  document.getElementById('nickname-overlay').classList.add('hidden');
  startGame();
}

function startGame() {
  const saved = localStorage.getItem(`tower_coins_${nick}`);
  // Always start with at least 300 coins so the player can buy towers
  coins = Math.max(300, saved !== null ? parseInt(saved) : 300);

  // Load inventory and pity
  try {
    const invSaved = localStorage.getItem(`tower_inventory_${nick}`);
    inventory = invSaved ? JSON.parse(invSaved) : [];
  } catch(e) { inventory = []; }
  pityCount = parseInt(localStorage.getItem(`tower_pity_${nick}`)) || 0;

  baseHP     = 1000;
  baseMaxHP  = 1000;
  currentLevel = 1;
  currentWave  = 1;
  waveIndex    = 0;
  waveActive   = false;
  pendingLevelComplete = false;
  enemies    = [];
  towers     = [];
  projectiles= [];
  particles  = [];
  floatTexts = [];
  slots = SLOTS_DEF.map((s,i) => ({ ...s, id: i, towerId: null }));
  selectedTowerType  = null;
  selectedTowerId    = null;
  inventoryPlaceItem = null;
  mergeMode         = false;
  mergeSelected     = [];
  airstrikeMode     = false;
  autoSkip          = false;
  gameSpeed         = 1;
  gameTime          = 0;
  waveStartGameTime = 0;
  shakeFrames       = 0;
  sessionKills  = 0;
  sessionCoinsEarned = 0;
  bossesKilled  = 0;
  earlyWaveStreak   = 0;
  waveBaseHpStart   = 1000;
  loadAchievements();
  waveScale     = levelScale(1);
  Object.values(ABILITIES).forEach(a => a.lastUsed = -Infinity);

  const gamesKey = `tower_games_${nick}`;
  localStorage.setItem(gamesKey, (parseInt(localStorage.getItem(gamesKey))||0)+1);

  buildHUD();
  buildWavePreview(currentLevel, currentWave);
  updateHUD();
  document.getElementById('end-overlay').classList.add('hidden');
  document.getElementById('level-overlay').classList.add('hidden');
  document.getElementById('shop-overlay').classList.add('hidden');

  if (animId) cancelAnimationFrame(animId);
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

// ── HUD construction ──────────────────────────────────────
function buildHUD() {
  // Tower buttons
  const tb = document.getElementById('tower-btns');
  tb.innerHTML = '';
  Object.entries(TOWER_DEFS).forEach(([type, def]) => {
    const btn = document.createElement('button');
    btn.className = 'tower-btn';
    btn.dataset.type = type;
    btn.innerHTML = `
      <span class="tb-emoji">${def.emoji}</span>
      <span class="tb-name">${def.name.toUpperCase()}</span>
      <span class="tb-cost">🪙${def.cost}</span>
      <div class="tb-tooltip">
        <div class="tb-tooltip-title">${def.emoji} ${def.name} (T1)</div>
        <div class="tb-tooltip-row"><span>COST</span><span>🪙${def.cost}</span></div>
        <div class="tb-tooltip-row"><span>DAMAGE</span><span>${def.dmg}</span></div>
        <div class="tb-tooltip-row"><span>RANGE</span><span>${def.range}px</span></div>
        <div class="tb-tooltip-row"><span>SPEED</span><span>${def.spd}/s</span></div>
        <div class="tb-tooltip-row"><span>SPECIAL</span><span>${def.special.toUpperCase()}</span></div>
      </div>`;
    btn.addEventListener('click', () => selectTowerType(type));
    tb.appendChild(btn);
  });

  // Ability buttons
  const ab = document.getElementById('ability-btns');
  ab.innerHTML = '';
  Object.entries(ABILITIES).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.className = 'ability-btn';
    btn.id = `ab-${key}`;
    btn.dataset.ability = key;
    btn.innerHTML = `
      <span class="ab-emoji">${def.emoji}</span>
      <span class="ab-name">${def.name.toUpperCase()}</span>
      <span class="ab-cd" id="ab-cd-${key}">READY</span>
      <canvas class="cd-ring" id="cd-ring-${key}" width="90" height="100"></canvas>`;
    btn.addEventListener('click', () => useAbility(key));
    ab.appendChild(btn);
  });

  // Start wave button
  document.getElementById('start-wave-btn').addEventListener('click', startWave);

  // Merge button
  const mergeBtn = document.getElementById('merge-btn');
  mergeBtn.addEventListener('click', toggleMergeMode);

  // Merge confirm button
  document.getElementById('merge-confirm-btn').addEventListener('click', doMerge);

  // Auto-skip button
  document.getElementById('auto-skip-btn').addEventListener('click', toggleAutoSkip);

  // Speed button
  document.getElementById('speed-btn').addEventListener('click', toggleSpeed);

  // Shop button
  document.getElementById('shop-btn').addEventListener('click', openShop);
  document.getElementById('shop-close-btn').addEventListener('click', closeShop);
  document.getElementById('pull-1-btn').addEventListener('click', () => doPull(1));
  document.getElementById('pull-10-btn').addEventListener('click', () => doPull(10));

  // Next level button
  document.getElementById('next-level-btn').addEventListener('click', startNextLevel);

  // Canvas events
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onCanvasHover);
  // Touch support: tap = click, finger hover shows range preview
  canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      onCanvasClick({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      onCanvasHover({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  }, { passive: false });
}

function updateHUD() {
  document.getElementById('hud-wave').textContent  = `LEVEL ${currentLevel}/10 · WAVE ${currentWave}/10`;
  document.getElementById('hud-status').textContent = waveActive ? 'ACTIVE' : 'PREPARING';
  document.getElementById('hud-enemies').textContent = `ENEMIES: ${waveActive ? waveEnemiesLeft : '—'}`;
  document.getElementById('hud-hp').textContent    = `🏰 HP: ${baseHP}`;
  document.getElementById('hud-coins').textContent = `🪙 ${coins}`;

  const isBossWave = waveActive && (currentWave === 10);
  document.getElementById('boss-warning').classList.toggle('hidden', !isBossWave);

  // Tower btn affordability
  document.querySelectorAll('.tower-btn').forEach(btn => {
    const cost = TOWER_DEFS[btn.dataset.type].cost;
    btn.classList.toggle('cannot-afford', coins < cost);
    btn.classList.toggle('selected', btn.dataset.type === selectedTowerType && !inventoryPlaceItem);
  });

  // Start wave button — also handles early-wave unlock
  const swb = document.getElementById('start-wave-btn');
  if (pendingLevelComplete) {
    swb.disabled    = true;
    swb.textContent = '✅ LEVEL DONE';
    swb.className   = 'wave-btn';
  } else if (waveActive) {
    const earlyReady = canStartEarlyWave();
    swb.disabled    = !earlyReady || currentWave >= 10;
    swb.textContent = earlyReady && currentWave < 10
      ? `⚡ SEND WAVE ${currentWave + 1}`
      : '⚔️ WAVE ACTIVE';
    swb.className   = earlyReady && currentWave < 10 ? 'wave-btn early' : 'wave-btn';
  } else {
    swb.disabled    = false;
    swb.textContent = `▶ START W${currentWave}`;
    swb.className   = 'wave-btn';
  }

  document.getElementById('wave-label').textContent =
    `NEXT: LEVEL ${currentLevel} · WAVE ${currentWave} / 10`;

  // Merge mode visual
  const mergeBtn = document.getElementById('merge-btn');
  mergeBtn.classList.toggle('active', mergeMode);
  updateMergeStatus();

  updateAbilityHUD();
}

function updateMergeStatus() {
  const statusEl  = document.getElementById('merge-status');
  const confirmEl = document.getElementById('merge-confirm-btn');
  if (!mergeMode) {
    statusEl.textContent = '';
    confirmEl.style.display = 'none';
    return;
  }
  if (mergeSelected.length === 0) {
    statusEl.textContent = 'SELECT 3 TOWERS OF SAME TYPE & TIER';
    confirmEl.style.display = 'none';
  } else if (mergeSelected.length < 3) {
    const t = getTowerById(mergeSelected[0]);
    const need = 3 - mergeSelected.length;
    statusEl.textContent = t
      ? `SELECT ${need} MORE [${TOWER_DEFS[t.type].name} T${t.tier}]`
      : `SELECT ${need} MORE`;
    confirmEl.style.display = 'none';
  } else {
    // Check compatibility
    const ts = mergeSelected.map(id => getTowerById(id)).filter(Boolean);
    const allSame = ts.every(t => t.type === ts[0].type && t.tier === ts[0].tier);
    if (allSame && ts[0].tier < 5) {
      const nextTier = ts[0].tier + 1;
      statusEl.textContent = `MERGE → ${TIER_NAMES[nextTier]} ✓`;
      statusEl.style.color = '#4ade80';
      confirmEl.style.display = 'inline-block';
      confirmEl.textContent = `MERGE → T${nextTier} ✓`;
    } else {
      statusEl.textContent = 'INCOMPATIBLE SELECTION';
      statusEl.style.color = '#ef4444';
      confirmEl.style.display = 'none';
    }
  }
  // Reset color if not error
  if (mergeSelected.length < 3) statusEl.style.color = '#fb923c';
}

function updateAbilityHUD() {
  const now = performance.now();
  Object.entries(ABILITIES).forEach(([key, def]) => {
    const btn  = document.getElementById(`ab-${key}`);
    const cdEl = document.getElementById(`ab-cd-${key}`);
    const ring = document.getElementById(`cd-ring-${key}`);
    if (!btn || !cdEl || !ring) return;
    const elapsed   = now - def.lastUsed;
    const remaining = Math.max(0, def.cooldown - elapsed);
    const progress  = remaining / def.cooldown;

    if (remaining > 0) {
      btn.classList.add('on-cooldown');
      cdEl.textContent = (remaining / 1000).toFixed(1) + 's';
      const rc = ring.getContext('2d');
      rc.clearRect(0, 0, ring.width, ring.height);
      rc.fillStyle = 'rgba(0,0,0,0.45)';
      rc.fillRect(0, 0, ring.width, ring.height);
      rc.beginPath();
      rc.moveTo(ring.width/2, ring.height/2);
      rc.arc(ring.width/2, ring.height/2, Math.max(ring.width, ring.height),
             -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2);
      rc.closePath();
      rc.fillStyle = 'rgba(0,0,0,0.55)';
      rc.fill();
    } else {
      btn.classList.remove('on-cooldown');
      cdEl.textContent = 'READY';
      const rc = ring.getContext('2d');
      rc.clearRect(0, 0, ring.width, ring.height);
    }
  });
}

// ── Wave logic ────────────────────────────────────────────
function canStartEarlyWave() {
  // Allow next wave while current is active if ≥7s (scaled) have passed
  return waveActive && !pendingLevelComplete &&
         (gameTime - waveStartGameTime >= EARLY_WAVE_DELAY) &&
         currentWave < 10;
}

function startWave() {
  if (pendingLevelComplete) return;

  // Must be either: not active, OR active+early-wave unlocked
  const early = waveActive && canStartEarlyWave();
  if (!waveActive && waveActive !== false) return; // safety
  if (waveActive && !early) return;

  // ── Helper: coins bonus given at the START of every wave ──
  function waveStartBonus(level, wave) {
    // Base bonus scales with level+wave so player can always afford upgrades
    return 80 + level * 20 + wave * 10;
  }

  // If early (wave-in-wave): don't reset waveActive, just bolt on new spawners
  if (early) {
    earlyWaveStreak++;
    if (earlyWaveStreak >= 3) unlockAchievement('speed_run');
    playSound('early_wave');

    // Advance wave counter BEFORE generating
    currentWave++;
    waveIndex++;
    waveScale = levelScale(currentLevel);
    const waveDef = generateWave(currentLevel, currentWave);
    const newCount = waveDef.reduce((s, g) => s + g.count, 0);
    waveEnemiesLeft += newCount;

    // Bonus coins for sending next wave
    const bonus = waveStartBonus(currentLevel, currentWave);
    addCoins(bonus);

    // Append new spawners to existing (already-active) list
    waveDef.forEach(group => {
      waveSpawners.push({
        type:               group.type,
        count:              group.count,
        spawned:            0,
        interval:           group.interval,
        lastSpawnGameTime:  gameTime,
      });
    });

    waveStartGameTime = gameTime; // reset timer so next early-wave needs another 7s
    addFloatText(`⚡ WAVE ${currentWave}! +${bonus}🪙`, W/2, 100, '#fbbf24', 22);
    savePortalStats();
    buildWavePreview(currentLevel, currentWave + 1);
    updateHUD();
    return;
  }

  // Normal wave start (not active)
  earlyWaveStreak = 0; // only count consecutive early sends
  waveBaseHpStart = baseHP;
  waveScale = levelScale(currentLevel);
  const waveDef = generateWave(currentLevel, currentWave);
  waveIndex++;
  waveActive        = true;
  waveStartGameTime = gameTime;
  waveEnemiesLeft   = waveDef.reduce((s, g) => s + g.count, 0);

  waveSpawners = waveDef.map(group => ({
    type:               group.type,
    count:              group.count,
    spawned:            0,
    interval:           group.interval,
    lastSpawnGameTime:  gameTime,
  }));

  // Bonus coins at wave start
  const startBonus = waveStartBonus(currentLevel, currentWave);
  addCoins(startBonus);
  addFloatText(`▶ WAVE ${currentWave}! +${startBonus}🪙`, W/2, 100, '#86efac', 20);
  playSound('wave_start');

  // Boss warning sound for wave 5 and 10
  if (currentWave === 5 || currentWave === 10) {
    setTimeout(() => playSound('boss_warning'), 400);
  }

  // Wave announcement banner
  {
    const isBoss     = currentWave === 10;
    const isMidBoss  = currentWave === 5;
    const label      = `LEVEL ${currentLevel} · WAVE ${currentWave}/10`;
    const title      = isBoss    ? `💀 BOSS WAVE!`
                     : isMidBoss ? `👹 MINI BOSS INCOMING!`
                     : `⚔️ WAVE ${currentWave}`;
    const sub        = isBoss    ? 'Elemental Lord approaches...'
                     : isMidBoss ? 'Mini Boss with support!'
                     : `${waveEnemiesLeft} enemies incoming`;
    const color      = isBoss ? '#ef4444' : isMidBoss ? '#f97316' : '#4ade80';
    const glow       = isBoss ? 'rgba(239,68,68,0.5)' : isMidBoss ? 'rgba(249,115,22,0.5)' : 'rgba(74,222,128,0.4)';
    showWaveAnnounce(label, title, sub, color, glow);
  }

  // Disable merge mode during wave
  if (mergeMode) toggleMergeMode();

  savePortalStats();
  buildWavePreview(currentLevel, currentWave + 1);
  updateHUD();
}

function processSpawners(now) {
  if (!waveActive) return;
  let allDone = true;
  waveSpawners.forEach(sp => {
    if (sp.spawned < sp.count) {
      allDone = false;
      if (gameTime - sp.lastSpawnGameTime >= sp.interval) {
        spawnEnemy(sp.type);
        sp.spawned++;
        sp.lastSpawnGameTime = gameTime;
      }
    }
  });
  if (allDone && enemies.length === 0 && waveActive) {
    endWave();
  }
}

function endWave() {
  waveActive = false;

  // No-damage wave achievement
  if (baseHP >= waveBaseHpStart) unlockAchievement('no_dmg_wave');

  // Wave 10 achievement
  if (currentWave === 10) unlockAchievement('wave_10');

  // Wave-end bonus coins
  const bonus = currentLevel * currentWave * 20;
  addCoins(bonus);
  addFloatText(`WAVE CLEAR! +${bonus}🪙`, W/2, H/2 - 40, '#fbbf24', 28);
  playSound('wave_clear');

  savePortalStats();

  if (currentWave >= 10) {
    // Level complete
    if (currentLevel >= 10) {
      unlockAchievement('level_10');
      setTimeout(() => showVictory(), 1200);
    } else {
      setTimeout(() => showLevelComplete(), 1200);
    }
  } else {
    currentWave++;
    buildWavePreview(currentLevel, currentWave);
    updateHUD();
  }
}

function showLevelComplete() {
  pendingLevelComplete = true;
  const bonus = currentLevel * 100;
  addCoins(bonus);

  const lvlEl    = document.getElementById('level-title');
  const statsEl  = document.getElementById('level-stats');
  lvlEl.textContent = `LEVEL ${currentLevel} COMPLETE!`;
  statsEl.innerHTML = `
    Level Bonus: <strong>+${bonus}🪙</strong><br>
    Enemies Killed: <strong>${sessionKills}</strong><br>
    Remaining Coins: <strong>${coins}🪙</strong>
  `;
  document.getElementById('level-overlay').classList.remove('hidden');
  playSound('level_complete');
  updateHUD();
}

function startNextLevel() {
  document.getElementById('level-overlay').classList.add('hidden');
  currentLevel++;
  currentWave = 1;
  pendingLevelComplete = false;
  waveScale = levelScale(currentLevel);
  earlyWaveStreak = 0;
  waveBaseHpStart = baseHP;

  // ── FRESH START per level: reset coins + clear all towers ──
  coins = 300;
  localStorage.setItem(`tower_coins_${nick}`, coins);
  towers = [];
  projectiles = [];
  particles = [];
  enemies = [];
  floatTexts = [];
  slots = SLOTS_DEF.map((s, i) => ({ ...s, id: i, towerId: null }));
  mergeSelected = [];
  if (mergeMode) toggleMergeMode();

  checkAchievements(); // level_3, level_5
  savePortalStats();
  buildWavePreview(currentLevel, currentWave);
  addFloatText('🆕 NEW LEVEL! Fresh start — 300🪙', W/2, H/2 - 30, '#86efac', 22);
  updateHUD();
}

// ── Enemy spawning ────────────────────────────────────────
function spawnEnemy(type, distOverride) {
  const def = ENEMY_DEFS[type];
  if (!def) return;
  const id = enemyIdCounter++;
  const sc = waveScale;

  // Scale HP and speed
  let scaledHp  = def.hp  * sc.hpMult;
  let scaledSpd = def.spd * sc.spdMult;

  // Boss HP further scaled by level
  if (type === 'boss') {
    scaledHp = (2000 + (currentLevel-1) * 1500) * sc.hpMult;
  } else if (type === 'mini_boss') {
    scaledHp = 1500 * currentLevel * sc.hpMult;
  }

  const e = {
    id,
    type,
    name:        def.name,
    emoji:       def.emoji,
    hp:          scaledHp,
    maxHp:       scaledHp,
    spd:         scaledSpd,
    reward:      type === 'boss'
                   ? 200 + currentLevel * 50
                   : type === 'mini_boss'
                     ? 80 + currentLevel * 20
                     : def.reward,
    element:     def.element,
    color:       def.color,
    special:     def.special || null,
    size:        (def.size || 1),
    distTraveled: distOverride || 0,
    statuses:    [],
    shield:      (type === 'boss') ? 300 : (type === 'mini_boss' ? 300 : 0),
    shieldMax:   (type === 'boss') ? 300 : (type === 'mini_boss' ? 300 : 0),
    shieldTimer: 0,
    elementTimer: (type === 'boss' || type === 'mini_boss') ? performance.now() + 20000 : 0,
    elementChangeInterval: type === 'mini_boss' ? 15000 : 20000,
    stealthTimer: def.special === 'stealth' ? performance.now() + 10000 : 0,
    stealthActive: false,
    speedupped: false,
    teleportTimer: def.special === 'teleport' ? performance.now() + 8000 : 0,
    alpha: 1,
    animT: Math.random() * Math.PI * 2,
    alive: true,
  };
  enemies.push(e);
}

// ── Update enemies ─────────────────────────────────────────
function updateEnemies(dt, now) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive) {
      enemies.splice(i, 1);
      continue;
    }

    e.animT += dt * 3;

    let speedMult = 1;
    let stunned = false;
    for (let si = e.statuses.length - 1; si >= 0; si--) {
      const st = e.statuses[si];
      if (now > st.endTime) { e.statuses.splice(si, 1); continue; }
      if (st.type === 'slow')   speedMult = Math.min(speedMult, st.value);
      if (st.type === 'stun')   stunned = true;
      if (st.type === 'burn' || st.type === 'poison') {
        if (!st.lastTick || now - st.lastTick >= 500) {
          applyDamage(e, st.value * (dt / 0.5), null, now);
          st.lastTick = now;
        }
      }
    }

    // Stealth mechanic
    if (e.special === 'stealth') {
      if (!e.stealthActive && now >= e.stealthTimer) {
        e.stealthActive  = true;
        e.stealthEndTime = now + 2000;
      }
      if (e.stealthActive && now >= e.stealthEndTime) {
        e.stealthActive = false;
        e.stealthTimer  = now + 10000;
      }
      e.alpha = e.stealthActive ? 0.3 : 1;
    }

    // Speedup mechanic
    if (e.special === 'speedup' && !e.speedupped && e.hp < e.maxHp * 0.5) {
      e.spd       *= 2;
      e.speedupped = true;
    }

    // Teleport mechanic
    if (e.special === 'teleport' && now >= e.teleportTimer) {
      e.distTraveled  = Math.min(e.distTraveled + 150, totalPathLen);
      e.teleportTimer = now + 8000;
      spawnParticles(distToXY(e.distTraveled), e.color, 8);
    }

    // Boss / miniboss: shield regen, element change, speed burst at 50%
    if (e.special === 'boss' || e.special === 'miniboss') {
      if (e.shield < e.shieldMax) {
        e.shieldTimer -= dt;
        if (e.shieldTimer <= 0) {
          e.shield = Math.min(e.shieldMax, e.shield + 5);
          e.shieldTimer = 0.1;
        }
      }
      if (now >= e.elementTimer) {
        const elems = ['fire','ice','storm','shadow','light'];
        e.element    = elems[Math.floor(Math.random() * elems.length)];
        e.elementTimer = now + e.elementChangeInterval;
        const pos = distToXY(e.distTraveled);
        addFloatText('ELEMENT SHIFT!', pos.x, pos.y - 40, '#dc2626', 18);
      }
      if (e.special === 'boss' && !e.speedupped && e.hp < e.maxHp * 0.5) {
        e.spd       *= 2;
        e.speedupped = true;
      }
    }

    if (stunned) continue;

    const actualSpd = e.spd * speedMult;
    e.distTraveled += actualSpd * dt;

    if (e.distTraveled >= totalPathLen) {
      const dmgAmt = e.special === 'boss' ? 200
                   : e.special === 'miniboss' ? 100
                   : (e.type === 'tidal_giant' || e.type === 'armored_brute') ? 50 : 25;
      damageBase(dmgAmt);
      if (e.special === 'spawn_on_death') spawnOnDeath(e);
      e.alive = false;
      waveEnemiesLeft = Math.max(0, waveEnemiesLeft - 1);
    }
  }
}

function spawnOnDeath(e) {
  const pos = e.distTraveled;
  for (let k = 0; k < 3; k++) {
    spawnEnemy('ice_grunt', Math.max(0, pos - k * 20));
    waveEnemiesLeft++;
  }
}

function applyDamage(enemy, amount, towerType, now) {
  let dmg = amount;
  if (towerType) {
    const tElem = towerType;
    if (WEAKNESSES[tElem] === enemy.element) dmg *= 2;
  }
  if (enemy.special === 'armor') {
    if (towerType !== 'fire' && towerType !== 'storm') dmg *= 0.5;
  }
  if (enemy.shield > 0) {
    const shd = Math.min(enemy.shield, dmg);
    enemy.shield -= shd;
    dmg -= shd;
  }
  if (dmg <= 0) return;
  enemy.hp -= dmg;

  const pos = distToXY(enemy.distTraveled);
  addFloatText(`-${Math.round(dmg)}`, pos.x + (Math.random()-0.5)*20, pos.y - 20, '#f1f5f9', 12);

  // Check elemental synergy bonus
  if (towerType && enemy.alive) {
    checkSynergy(enemy, towerType, dmg, now);
  }

  if (enemy.hp <= 0 && enemy.alive) {
    killEnemy(enemy, now);
  }
}

function killEnemy(e, now) {
  e.alive = false;
  sessionKills++;
  if (e.type === 'boss' || e.special === 'boss') bossesKilled++;
  playSound(e.special === 'boss' ? 'boss_kill' : 'enemy_kill');
  addCoins(e.reward);
  sessionCoinsEarned += e.reward;
  waveEnemiesLeft = Math.max(0, waveEnemiesLeft - 1);

  const pos = distToXY(e.distTraveled);
  spawnParticles(pos, e.color, 12);
  addFloatText(`+${e.reward}🪙`, pos.x, pos.y - 30, '#fbbf24', 14);

  const tk = `tower_total_kills_${nick}`;
  localStorage.setItem(tk, (parseInt(localStorage.getItem(tk))||0)+1);
  if (e.special === 'boss') {
    const bk = `tower_bosses_killed_${nick}`;
    localStorage.setItem(bk, (parseInt(localStorage.getItem(bk))||0)+1);
  }

  checkAchievements();
  if (e.special === 'spawn_on_death') spawnOnDeath(e);
}

function damageBase(amount) {
  baseHP = Math.max(0, baseHP - amount);
  shakeFrames = 20;
  shakeAmt    = 8;
  playSound('base_hit');
  addFloatText(`BASE -${amount}!`, W/2, H/2, '#ef4444', 22);
  updateHUD();
  if (baseHP <= 0) {
    setTimeout(() => showGameOver(), 400);
  }
}

function addCoins(amount) {
  coins += amount;
  localStorage.setItem(`tower_coins_${nick}`, coins);
  updateHUD();
  if (amount > 0) {
    if (amount >= 100) playSound('coin'); // only play for significant rewards
    if (coins >= 2000) checkAchievements();
  }
}

// ── Towers ────────────────────────────────────────────────
function computeTowerStats(type, tier) {
  const def = TOWER_DEFS[type];
  const m   = TIER_MULT[tier];
  return {
    dmg:   def.dmg   * m,
    range: def.range * (1 + (tier-1) * 0.08),
    spd:   def.spd   * (1 + (tier-1) * 0.15),
  };
}

function placeTower(slotId, type, tier, fromInventory) {
  tier = tier || 1;
  const def  = TOWER_DEFS[type];
  if (!def) return;
  const slot = slots[slotId];
  if (slot.towerId !== null) return;

  const effectiveCost = fromInventory ? 0 : def.cost;  // pulls are "free" to place
  if (!fromInventory && coins < effectiveCost) return;
  if (!fromInventory) addCoins(-effectiveCost);

  const stats = computeTowerStats(type, tier);
  const id    = towerIdCounter++;
  const t = {
    id,
    type,
    tier,
    slotId,
    x:       slot.x + SLOT_SIZE/2,
    y:       slot.y + SLOT_SIZE/2,
    level:   1,
    dmg:     stats.dmg,
    range:   stats.range,
    spd:     stats.spd,
    cooldown: 0,
    color:   def.color,
    special: def.special,
    invested: effectiveCost,  // pull towers have 0 invested
    animT:   0,
  };
  towers.push(t);
  slot.towerId = id;
  selectedTowerType  = null;
  inventoryPlaceItem = null;
  playSound('buy');
  checkAchievements();
  updateHUD();
}

function getTowerById(id) {
  return towers.find(t => t.id === id);
}

function upgradeTower(id) {
  const t = getTowerById(id);
  if (!t || t.level >= 3) return;
  const def     = TOWER_DEFS[t.type];
  const baseCost = def.cost * TIER_MULT[t.tier];
  const cost    = t.level === 1
    ? Math.floor(baseCost * 1.5)
    : Math.floor(baseCost * 3.0);
  if (coins < cost) return;
  addCoins(-cost);
  t.invested += cost;
  t.level++;
  t.dmg   = Math.round(t.dmg   * 1.4);
  t.range = Math.round(t.range * 1.12);
  t.spd   = parseFloat((t.spd  * 1.25).toFixed(3));
  playSound('upgrade');
  updateTowerPanel(id);
}

function sellTower(id) {
  const t = getTowerById(id);
  if (!t) return;
  const refund = Math.floor(t.invested * 0.6);
  playSound('sell');
  addCoins(refund);
  const slot = slots[t.slotId];
  if (slot) slot.towerId = null;
  towers = towers.filter(x => x.id !== id);
  if (selectedTowerId === id) closeTowerPanel();
  mergeSelected = mergeSelected.filter(mid => mid !== id);
  updateMergeStatus();
}

function freeTowerSlot(id) {
  const t = getTowerById(id);
  if (!t) return;
  const slot = slots[t.slotId];
  if (slot) slot.towerId = null;
  towers = towers.filter(x => x.id !== id);
  mergeSelected = mergeSelected.filter(mid => mid !== id);
}

// ── Auto-skip ─────────────────────────────────────────────
function toggleAutoSkip() {
  autoSkip = !autoSkip;
  const btn = document.getElementById('auto-skip-btn');
  if (btn) {
    btn.classList.toggle('active', autoSkip);
    btn.textContent = autoSkip ? '⚡ AUTO ON' : '⚡ AUTO SKIP';
  }
}

function toggleSpeed() {
  gameSpeed = gameSpeed === 1 ? 2 : 1;
  const btn = document.getElementById('speed-btn');
  if (btn) {
    btn.classList.toggle('active', gameSpeed === 2);
    btn.textContent = gameSpeed === 2 ? '⏩ 2× ON' : '⏩ 2×';
  }
}

// ── Merge system ──────────────────────────────────────────
function toggleMergeMode() {
  mergeMode = !mergeMode;
  mergeSelected = [];
  if (mergeMode) {
    canvas.classList.add('merge-targeting');
    document.getElementById('merge-hint').classList.remove('hidden');
    closeTowerPanel();
    selectedTowerType  = null;
    inventoryPlaceItem = null;
  } else {
    canvas.classList.remove('merge-targeting');
    document.getElementById('merge-hint').classList.add('hidden');
  }
  updateMergeStatus();
  updateHUD();
}

function doMerge() {
  if (mergeSelected.length < 3) return;
  const ts = mergeSelected.map(id => getTowerById(id)).filter(Boolean);
  if (ts.length < 3) return;
  const allSame = ts.every(t => t.type === ts[0].type && t.tier === ts[0].tier);
  if (!allSame || ts[0].tier >= 5) return;

  const baseTower = ts[0];
  const newTier   = baseTower.tier + 1;

  // Free the other two slots
  freeTowerSlot(ts[1].id);
  freeTowerSlot(ts[2].id);

  // Upgrade base tower to new tier, reset to level 1
  const def    = TOWER_DEFS[baseTower.type];
  const stats  = computeTowerStats(baseTower.type, newTier);
  baseTower.tier     = newTier;
  baseTower.level    = 1;
  baseTower.dmg      = stats.dmg;
  baseTower.range    = stats.range;
  baseTower.spd      = stats.spd;
  baseTower.invested = 0; // merged cost is sunk

  spawnParticles({ x: baseTower.x, y: baseTower.y }, TIER_COLORS[newTier], 30);
  addFloatText(`✨ ${TIER_NAMES[newTier]}!`, baseTower.x, baseTower.y - 40, TIER_COLORS[newTier], 20);
  playSound('merge');

  unlockAchievement('first_merge');
  if (newTier === 5) unlockAchievement('legend_tower');
  checkAchievements();

  mergeSelected = [];
  toggleMergeMode();
  updateHUD();
}

// ── Shop / Gacha ──────────────────────────────────────────
function openShop() {
  renderShopInventory();
  document.getElementById('pity-count').textContent = pityCount;
  document.getElementById('shop-overlay').classList.remove('hidden');
}

function closeShop() {
  document.getElementById('shop-overlay').classList.add('hidden');
}

function renderShopInventory() {
  const container = document.getElementById('tower-inventory');
  container.innerHTML = '';
  if (inventory.length === 0) {
    container.innerHTML = '<div class="inv-empty">NO TOWERS IN INVENTORY</div>';
    return;
  }
  inventory.forEach((item, idx) => {
    const def  = TOWER_DEFS[item.type];
    const card = document.createElement('div');
    card.className = 'inv-card';
    card.innerHTML = `
      <span class="inv-emoji">${def.emoji}</span>
      <span class="inv-name">${def.name.toUpperCase()}</span>
      <span class="inv-tier" style="color:${TIER_COLORS[item.tier]}">${TIER_NAMES[item.tier].toUpperCase()}</span>`;
    card.addEventListener('click', () => selectInventoryItem(idx));
    container.appendChild(card);
  });
}

function selectInventoryItem(idx) {
  const item = inventory[idx];
  if (!item) return;
  closeShop();
  inventoryPlaceItem = { type: item.type, tier: item.tier, invIndex: idx };
  selectedTowerType  = null;
  mergeMode = false;
  canvas.classList.remove('merge-targeting');
  document.getElementById('merge-hint').classList.add('hidden');
  updateHUD();
}

function rollTier() {
  let roll = Math.random() * PULL_TOTAL_WEIGHT;
  for (const r of PULL_RATES) {
    roll -= r.weight;
    if (roll <= 0) return r.tier;
  }
  return 1;
}

function doPull(count) {
  const cost = count === 1 ? 150 : 1200;
  if (coins < cost) {
    addFloatText('NOT ENOUGH COINS!', W/2, H/3, '#ef4444', 18);
    return;
  }
  if (inventory.length >= 30) {
    alert('INVENTORY FULL! Place or manage your towers first.');
    return;
  }

  addCoins(-cost);
  const results = [];
  for (let i = 0; i < count; i++) {
    if (inventory.length >= 30) break;
    let tier = rollTier();
    pityCount++;
    totalGachaPulls++;
    // Pity: force Rare+ at 10
    if (pityCount >= 10 && tier < 3) tier = 3;
    if (tier >= 3) pityCount = 0;
    const type = TOWER_TYPES[Math.floor(Math.random() * TOWER_TYPES.length)];
    inventory.push({ type, tier });
    results.push({ type, tier });
  }

  localStorage.setItem(`tower_inventory_${nick}`, JSON.stringify(inventory));
  localStorage.setItem(`tower_pity_${nick}`, pityCount);
  localStorage.setItem(`tower_total_pulls_${nick}`, totalGachaPulls);
  if (totalGachaPulls >= 10) unlockAchievement('gacha_10');
  if (results.some(r => r.tier === 5)) unlockAchievement('legend_tower');

  document.getElementById('pity-count').textContent = pityCount;
  renderShopInventory();

  // Show result summary
  let resultHtml = '';
  if (results.length === 1) {
    const r   = results[0];
    const def = TOWER_DEFS[r.type];
    resultHtml = `<span style="color:${TIER_COLORS[r.tier]}">${def.emoji} ${def.name} — ${TIER_NAMES[r.tier]}</span>`;
  } else {
    const counts = {};
    results.forEach(r => {
      const key = `${r.type}_${r.tier}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    resultHtml = Object.entries(counts).map(([k, cnt]) => {
      const [type, tier] = k.split('_');
      const def = TOWER_DEFS[type];
      return `<span style="color:${TIER_COLORS[parseInt(tier)]}">${def.emoji} ${TIER_NAMES[parseInt(tier)]} x${cnt}</span>`;
    }).join(' · ');
  }

  // Show or create pull result element
  let pullResult = document.getElementById('pull-result');
  if (!pullResult) {
    pullResult = document.createElement('div');
    pullResult.id = 'pull-result';
    pullResult.className = 'pull-result';
    document.querySelector('.shop-banner').appendChild(pullResult);
  }
  pullResult.innerHTML = resultHtml;
}

// ── Shooting ──────────────────────────────────────────────
function updateTowers(dt, now) {
  towers.forEach(t => {
    t.animT += dt * 2;
    if (t.cooldown > 0) { t.cooldown -= dt; return; }

    let target = null;
    let bestDist = -1;
    enemies.forEach(e => {
      if (!e.alive) return;
      const pos = distToXY(e.distTraveled);
      const d   = Math.hypot(pos.x - t.x, pos.y - t.y);
      if (d <= t.range && e.distTraveled > bestDist) {
        bestDist = e.distTraveled;
        target   = e;
      }
    });
    if (!target) return;

    t.cooldown = 1 / t.spd;
    fireProjectile(t, target);
  });
}

function fireProjectile(tower, target) {
  const tPos = distToXY(target.distTraveled);
  projectiles.push({
    x:      tower.x,
    y:      tower.y,
    tx:     tPos.x,
    ty:     tPos.y,
    targetId: target.id,
    tower:  tower,
    color:  tower.color,
    spd:    300,
    alive:  true,
  });
  playSound(`shot_${tower.type}`);
}

function updateProjectiles(dt, now) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p.alive) { projectiles.splice(i, 1); continue; }

    const te = enemies.find(e => e.id === p.targetId);
    if (te && te.alive) {
      const tp = distToXY(te.distTraveled);
      p.tx = tp.x;
      p.ty = tp.y;
    }

    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 8) {
      p.alive = false;
      projectiles.splice(i, 1);
      hitTarget(p, te, now);
      continue;
    }

    const move = p.spd * dt;
    p.x += (dx / dist) * move;
    p.y += (dy / dist) * move;
  }
}

function hitTarget(proj, enemy, now) {
  const tower = proj.tower;
  const def   = TOWER_DEFS[tower.type];
  const tPos  = { x: proj.tx, y: proj.ty };

  spawnParticles(tPos, tower.color, 6);

  if (!enemy || !enemy.alive) {
    if (tower.special === 'explode') doExplosion(tower, tPos, now);
    return;
  }

  if (tower.special === 'chain') {
    const targets = [enemy];
    enemies.forEach(e2 => {
      if (!e2.alive || e2.id === enemy.id) return;
      const p2 = distToXY(e2.distTraveled);
      if (Math.hypot(p2.x - tPos.x, p2.y - tPos.y) < 120 && targets.length < (def.chainCount || 3)) {
        targets.push(e2);
      }
    });
    targets.forEach(e2 => applyDamage(e2, tower.dmg, tower.type, now));
  } else if (tower.special === 'explode') {
    applyDamage(enemy, tower.dmg, tower.type, now);
    doExplosion(tower, tPos, now);
  } else {
    applyDamage(enemy, tower.dmg, tower.type, now);
  }

  if (!enemy.alive) return;
  applyStatus(enemy, tower, now);
}

function doExplosion(tower, pos, now) {
  const def = TOWER_DEFS[tower.type];
  const r   = def.explodeR || 100;
  spawnParticles(pos, tower.color, 20);
  enemies.forEach(e => {
    if (!e.alive) return;
    const ep = distToXY(e.distTraveled);
    if (Math.hypot(ep.x - pos.x, ep.y - pos.y) < r) {
      applyDamage(e, def.explodeDmg || 40, tower.type, now);
    }
  });
}

function applyStatus(enemy, tower, now) {
  const def = TOWER_DEFS[tower.type];
  if (tower.special === 'burn') {
    enemy.statuses.push({ type:'burn',   endTime: now + def.burnDur,   value: def.burnDmg });
  } else if (tower.special === 'slow') {
    enemy.statuses = enemy.statuses.filter(s => s.type !== 'slow');
    enemy.statuses.push({ type:'slow',   endTime: now + def.slowDur,   value: def.slowAmt });
  } else if (tower.special === 'poison') {
    enemy.statuses.push({ type:'poison', endTime: now + def.poisonDur, value: def.poisonDmg });
  } else if (tower.special === 'stun') {
    enemy.statuses.push({ type:'stun',   endTime: now + def.stunDur });
  } else if (tower.special === 'chain') {
    // Storm tower leaves a static-charge status for synergy checks
    enemy.statuses = enemy.statuses.filter(s => s.type !== 'chain');
    enemy.statuses.push({ type:'chain', endTime: now + 2000 });
  }
}

// ── Abilities ─────────────────────────────────────────────
function useAbility(key) {
  const ab  = ABILITIES[key];
  const now = performance.now();
  if (now - ab.lastUsed < ab.cooldown) return;

  if (key === 'tornado') {
    ab.lastUsed = now;
    enemies.forEach(e => {
      e.distTraveled = Math.max(0, e.distTraveled - 200);
    });
    addFloatText('🌪️ TORNADO!', W/2, 120, '#86efac', 24);
  } else if (key === 'freeze') {
    ab.lastUsed = now;
    enemies.forEach(e => {
      e.statuses = e.statuses.filter(s => s.type !== 'stun');
      e.statuses.push({ type:'stun', endTime: now + 3000 });
    });
    addFloatText('❄️ FREEZE ALL!', W/2, 120, '#60a5fa', 24);
  } else if (key === 'airstrike') {
    airstrikeMode = true;
    canvas.classList.add('targeting');
    document.getElementById('target-hint').classList.remove('hidden');
    ab.lastUsed = now;
  }
}

function triggerAirstrike(cx, cy, now) {
  airstrikeMode = false;
  canvas.classList.remove('targeting');
  document.getElementById('target-hint').classList.add('hidden');
  spawnParticles({x:cx, y:cy}, '#fb7185', 30);
  addFloatText('💣 AIRSTRIKE!', cx, cy - 60, '#fb7185', 22);
  enemies.forEach(e => {
    const pos = distToXY(e.distTraveled);
    if (Math.hypot(pos.x - cx, pos.y - cy) < 150) {
      applyDamage(e, 500, null, now);
    }
  });
}

// ── Particles ─────────────────────────────────────────────
function spawnParticles(pos, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 40 + Math.random() * 120;
    particles.push({
      x: pos.x, y: pos.y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: 0.6 + Math.random() * 0.8,
      r:   2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vx   *= 0.9;
    p.vy   *= 0.9;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function addFloatText(text, x, y, color, size) {
  floatTexts.push({ text, x, y, vy: -40, life: 1.2, color, size: size || 14 });
}

function updateFloatTexts(dt) {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.y    += f.vy * dt;
    f.life -= dt * 0.8;
    if (f.life <= 0) floatTexts.splice(i, 1);
  }
}

// ── Canvas interaction ────────────────────────────────────
let hoverSlotId = null;

function onCanvasHover(e) {
  const { cx, cy } = canvasCoords(e);
  hoverSlotId = null;
  if (selectedTowerType || inventoryPlaceItem) {
    slots.forEach(s => {
      if (s.towerId === null &&
          cx >= s.x && cx <= s.x + SLOT_SIZE &&
          cy >= s.y && cy <= s.y + SLOT_SIZE) {
        hoverSlotId = s.id;
      }
    });
  }
}

function onCanvasClick(e) {
  const { cx, cy } = canvasCoords(e);
  const now = performance.now();

  if (airstrikeMode) {
    triggerAirstrike(cx, cy, now);
    return;
  }

  // Merge mode: select towers
  if (mergeMode) {
    let clickedTower = null;
    towers.forEach(t => {
      if (Math.hypot(cx - t.x, cy - t.y) <= 22 * (1 + (t.level-1)*0.15) + 5) clickedTower = t;
    });
    if (clickedTower) {
      const idx = mergeSelected.indexOf(clickedTower.id);
      if (idx >= 0) {
        mergeSelected.splice(idx, 1);
      } else if (mergeSelected.length < 3) {
        mergeSelected.push(clickedTower.id);
      }
      updateMergeStatus();
    }
    return;
  }

  // Click on placed tower?
  let clickedTower = null;
  towers.forEach(t => {
    if (Math.hypot(cx - t.x, cy - t.y) <= 22 * (1 + (t.level-1)*0.15) + 4) clickedTower = t;
  });

  if (clickedTower && !selectedTowerType && !inventoryPlaceItem) {
    showTowerPanel(clickedTower);
    updateHUD();
    return;
  }

  // Place from inventory
  if (inventoryPlaceItem) {
    slots.forEach(s => {
      if (s.towerId === null &&
          cx >= s.x && cx <= s.x + SLOT_SIZE &&
          cy >= s.y && cy <= s.y + SLOT_SIZE) {
        const { type, tier, invIndex } = inventoryPlaceItem;
        // Remove from inventory
        inventory.splice(invIndex, 1);
        localStorage.setItem(`tower_inventory_${nick}`, JSON.stringify(inventory));
        placeTower(s.id, type, tier, true);
      }
    });
    return;
  }

  // Click on empty slot to place from buy
  if (selectedTowerType) {
    slots.forEach(s => {
      if (s.towerId === null &&
          cx >= s.x && cx <= s.x + SLOT_SIZE &&
          cy >= s.y && cy <= s.y + SLOT_SIZE) {
        placeTower(s.id, selectedTowerType, 1, false);
      }
    });
    return;
  }

  // Click elsewhere: close panel, deselect
  closeTowerPanel();
  selectedTowerType  = null;
  inventoryPlaceItem = null;
  updateHUD();
}

function selectTowerType(type) {
  if (selectedTowerType === type) {
    selectedTowerType = null;
  } else {
    selectedTowerType = type;
    inventoryPlaceItem = null;
    closeTowerPanel();
  }
  updateHUD();
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    cx: e.clientX - rect.left,
    cy: e.clientY - rect.top,
  };
}

// ── Tower info panel ──────────────────────────────────────
function showTowerPanel(t) {
  selectedTowerId = t.id;
  const panel = document.getElementById('tower-panel');
  panel.classList.remove('hidden');

  const pw = 220, ph = 290;
  let px = t.x + 28, py = t.y - 60;
  if (px + pw > W - 10) px = t.x - pw - 28;
  if (py < 0) py = 10;
  if (py + ph > H) py = H - ph - 10;
  panel.style.left = px + 'px';
  panel.style.top  = py + 'px';

  updateTowerPanel(t.id);
}

function updateTowerPanel(id) {
  const t = getTowerById(id);
  if (!t) return;
  const def   = TOWER_DEFS[t.type];
  const panel = document.getElementById('tower-panel');
  if (panel.classList.contains('hidden')) return;

  const baseCost = def.cost * TIER_MULT[t.tier];
  const upgCost  = t.level === 1 ? Math.floor(baseCost * 1.5)
                 : t.level === 2 ? Math.floor(baseCost * 3.0) : 0;
  const sellVal  = Math.floor(t.invested * 0.6);

  panel.querySelector('h3').textContent = `${def.emoji} ${def.name}`;
  panel.querySelector('h3').style.color = t.color;

  const tierRow = panel.querySelector('.tp-tier-row');
  tierRow.textContent = `■ ${TIER_NAMES[t.tier].toUpperCase()}`;
  tierRow.style.color = TIER_COLORS[t.tier];

  panel.querySelector('.tp-rows').innerHTML = `
    <div class="tp-row"><span>LEVEL</span><span>${t.level} / 3</span></div>
    <div class="tp-row"><span>DAMAGE</span><span>${Math.round(t.dmg)}</span></div>
    <div class="tp-row"><span>RANGE</span><span>${Math.round(t.range)}px</span></div>
    <div class="tp-row"><span>SPEED</span><span>${t.spd.toFixed(1)}/s</span></div>
    <div class="tp-row"><span>INVESTED</span><span>🪙${t.invested}</span></div>
    <div class="tp-row"><span>SPECIAL</span><span>${def.special.toUpperCase()}</span></div>`;

  const dots = panel.querySelector('.tp-level-dots');
  dots.innerHTML = [1,2,3].map(l => `<div class="tp-dot${l<=t.level?' filled':''}"></div>`).join('');

  const upgradeBtn = panel.querySelector('.tp-upgrade-btn');
  if (t.level >= 3) {
    upgradeBtn.textContent = 'MAX LEVEL';
    upgradeBtn.disabled    = true;
  } else {
    upgradeBtn.textContent = `⬆ UPGRADE 🪙${upgCost}`;
    upgradeBtn.disabled    = coins < upgCost;
  }

  panel.querySelector('.tp-sell-btn').textContent = `💰 SELL (+${sellVal}🪙)`;
}

function closeTowerPanel() {
  document.getElementById('tower-panel').classList.add('hidden');
  selectedTowerId = null;
}

// ── Game Over / Victory ───────────────────────────────────
function showGameOver() {
  waveActive = false;
  playSound('game_over');
  saveStats();
  const overlay = document.getElementById('end-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="end-box">
      <div class="end-icon">💀</div>
      <div class="end-title loss">GAME OVER</div>
      <div class="end-stats">
        Level Reached: <strong>${currentLevel} / 10</strong><br>
        Wave Reached: <strong>${currentWave} / 10</strong><br>
        Total Wave: <strong>${waveIndex} / 100</strong><br>
        Enemies Killed: <strong>${sessionKills}</strong><br>
        Bosses Slain: <strong>${bossesKilled}</strong><br>
        Coins Earned: <strong>${sessionCoinsEarned}🪙</strong><br>
        Remaining Coins: <strong>${coins}🪙</strong>
      </div>
      <div class="end-btns">
        <button class="end-btn primary" onclick="startGame()">▶ PLAY AGAIN</button>
        <button class="end-btn secondary" onclick="window.location.href='/'">🏠 PORTAL</button>
      </div>
    </div>`;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
}

function showVictory() {
  waveActive = false;
  playSound('victory');
  const bonus = 1000;
  addCoins(bonus);
  saveStats();
  const overlay = document.getElementById('end-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="end-box">
      <div class="end-icon">🏆</div>
      <div class="end-title victory">VICTORY!</div>
      <div class="end-achievement">🌟 TOWER GRANDMASTER — ALL 100 WAVES!</div>
      <div class="end-stats">
        All 10 Levels & 100 Waves Cleared!<br>
        Enemies Killed: <strong>${sessionKills}</strong><br>
        Bosses Slain: <strong>${bossesKilled}</strong><br>
        Coins Earned: <strong>${sessionCoinsEarned + bonus}🪙</strong><br>
        Victory Bonus: <strong>+1000🪙</strong><br>
        Total Coins: <strong>${coins}🪙</strong>
      </div>
      <div class="end-btns">
        <button class="end-btn primary" onclick="startGame()">▶ PLAY AGAIN</button>
        <button class="end-btn secondary" onclick="window.location.href='/'">🏠 PORTAL</button>
      </div>
    </div>`;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
}

function saveStats() {
  localStorage.setItem(`tower_coins_${nick}`, coins);
  const bk = `tower_best_wave_${nick}`;
  const prev = parseInt(localStorage.getItem(bk)) || 0;
  if (waveIndex > prev) localStorage.setItem(bk, waveIndex);
  const tk = `tower_total_kills_${nick}`;
  localStorage.setItem(tk, (parseInt(localStorage.getItem(tk))||0) + sessionKills);
  savePortalStats();
}

// ── Main loop ─────────────────────────────────────────────
function loop(now) {
  animId = requestAnimationFrame(loop);
  const rawDt = Math.min((now - lastTime) / 1000, 0.05);
  const dt = rawDt * gameSpeed;
  gameTime += dt * 1000; // scaled ms
  lastTime = now;

  processSpawners(now);
  updateEnemies(dt, now);
  updateTowers(dt, now);
  updateProjectiles(dt, now);
  updateParticles(dt);
  updateFloatTexts(dt);
  updateAbilityHUD();
  if (selectedTowerId !== null) updateTowerPanel(selectedTowerId);

  // Auto-skip: fire next wave automatically after AUTO_SKIP_DELAY ms
  if (autoSkip && canStartEarlyWave()) {
    startWave(true); // true = early
  }

  if (shakeFrames > 0) { shakeFrames--; if (shakeFrames === 0) shakeAmt = 0; }

  draw(now);
}

// ── Drawing ───────────────────────────────────────────────
function draw(now) {
  ctx.save();

  if (shakeFrames > 0) {
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;
    ctx.translate(sx, sy);
  }

  drawBackground(now);
  drawPath();
  drawSlots();
  towers.forEach(t => drawTower(t, now));
  enemies.forEach(e => { if (e.alive) drawEnemy(e, now); });
  projectiles.forEach(p => drawProjectile(p));
  particles.forEach(p => drawParticle(p));
  floatTexts.forEach(f => drawFloatText(f));

  if (airstrikeMode) {
    ctx.strokeStyle = 'rgba(220,38,38,0.7)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6,5]);
    ctx.strokeRect(0, 0, W, H);
    ctx.setLineDash([]);
    // Red vignette tint
    const vgrd = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
    vgrd.addColorStop(0, 'transparent');
    vgrd.addColorStop(1, 'rgba(220,38,38,0.12)');
    ctx.fillStyle = vgrd;
    ctx.fillRect(0, 0, W, H);
  }

  drawBase(now);

  // Range circle for selected tower
  if (selectedTowerId !== null) {
    const t = getTowerById(selectedTowerId);
    if (t) {
      ctx.beginPath();
      ctx.arc(t.x + SLOT_SIZE/2, t.y + SLOT_SIZE/2, t.range, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(45,110,58,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(45,110,58,0.05)';
      ctx.fill();
    }
  }

  // Range preview for hover slot (buying)
  if ((selectedTowerType || inventoryPlaceItem) && hoverSlotId !== null) {
    const type = selectedTowerType || inventoryPlaceItem.type;
    const tier = inventoryPlaceItem ? inventoryPlaceItem.tier : 1;
    const def  = TOWER_DEFS[type];
    const slot = slots[hoverSlotId];
    const rng  = def.range * (1 + (tier-1) * 0.08);
    ctx.beginPath();
    ctx.arc(slot.x + SLOT_SIZE/2, slot.y + SLOT_SIZE/2, rng, 0, Math.PI * 2);
    ctx.strokeStyle = `${def.color}55`;
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillStyle   = `${def.color}0a`;
    ctx.fill();
  }

  // Inventory place mode indicator
  if (inventoryPlaceItem) {
    const def = TOWER_DEFS[inventoryPlaceItem.type];
    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor  = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur   = 5;
    ctx.fillStyle = TIER_COLORS[inventoryPlaceItem.tier];
    ctx.fillText(
      `PLACING: ${def.emoji} ${def.name} [${TIER_NAMES[inventoryPlaceItem.tier]}]`,
      W/2, 56
    );
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ── Fantasy Day background & clouds ──────────────────────
const CLOUDS = (function() {
  const c = []; let x = 7;
  function rng() { x = (x * 1103515245 + 12345) & 0x7fffffff; return (x & 0xffff) / 0xffff; }
  for (let i = 0; i < 14; i++) c.push({
    x: rng() * 1400 - 100,
    y: rng() * 280 + 20,
    w: rng() * 80 + 60,
    h: rng() * 28 + 18,
    speed: rng() * 0.012 + 0.005,
    alpha: rng() * 0.35 + 0.55,
  });
  return c;
})();

function drawBackground(now) {
  // Sky gradient — soft blue top → warm yellow-green horizon → grass green bottom
  const skyGrd = ctx.createLinearGradient(0, 0, 0, H);
  skyGrd.addColorStop(0,   '#c8e8f8');
  skyGrd.addColorStop(0.45,'#daf0e8');
  skyGrd.addColorStop(0.72,'#c8e8d0');
  skyGrd.addColorStop(1,   '#a8d4b8');
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, W, H);

  // Grass strip at bottom
  const grassGrd = ctx.createLinearGradient(0, H * 0.68, 0, H);
  grassGrd.addColorStop(0, '#7cc88c');
  grassGrd.addColorStop(1, '#5aaa6a');
  ctx.fillStyle = grassGrd;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);

  // Subtle grass texture lines
  ctx.strokeStyle = 'rgba(80,160,90,0.15)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 18) {
    ctx.beginPath();
    ctx.moveTo(gx, H * 0.68);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }

  // Drifting clouds
  const t = now * 0.001;
  CLOUDS.forEach(cl => {
    const cx = ((cl.x + t * cl.speed * 60) % (W + 200)) - 100;
    ctx.globalAlpha = cl.alpha;
    ctx.fillStyle = '#ffffff';
    // Main cloud body
    ctx.beginPath();
    ctx.ellipse(cx, cl.y, cl.w, cl.h, 0, 0, Math.PI * 2);
    ctx.fill();
    // Puff 1
    ctx.beginPath();
    ctx.ellipse(cx - cl.w * 0.38, cl.y + cl.h * 0.12, cl.w * 0.55, cl.h * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    // Puff 2
    ctx.beginPath();
    ctx.ellipse(cx + cl.w * 0.42, cl.y + cl.h * 0.08, cl.w * 0.52, cl.h * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Distant trees silhouette on horizon
  ctx.fillStyle = 'rgba(80,148,90,0.28)';
  for (let tx = 0; tx < W; tx += 55) {
    const th = 38 + Math.sin(tx * 0.13) * 12;
    ctx.beginPath();
    ctx.moveTo(tx, H * 0.68);
    ctx.lineTo(tx + 27, H * 0.68 - th);
    ctx.lineTo(tx + 54, H * 0.68);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPath() {
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  // Outer shadow / soft edge
  ctx.beginPath(); movePath();
  ctx.strokeStyle = 'rgba(100,70,30,0.25)';
  ctx.lineWidth   = 52;
  ctx.stroke();

  // Dark dirt border
  ctx.beginPath(); movePath();
  ctx.strokeStyle = '#a0784a';
  ctx.lineWidth   = 44;
  ctx.stroke();

  // Mid dirt
  ctx.beginPath(); movePath();
  ctx.strokeStyle = '#c49a5a';
  ctx.lineWidth   = 38;
  ctx.stroke();

  // Main sandy path
  ctx.beginPath(); movePath();
  ctx.strokeStyle = '#ddb96a';
  ctx.lineWidth   = 32;
  ctx.stroke();

  // Inner highlight
  ctx.beginPath(); movePath();
  ctx.strokeStyle = '#e8ca82';
  ctx.lineWidth   = 20;
  ctx.stroke();

  // Centre dashed lane marking
  ctx.beginPath(); movePath();
  ctx.strokeStyle = 'rgba(180,130,50,0.45)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([22, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function movePath() {
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
}

function drawSlots() {
  slots.forEach(s => {
    if (s.towerId !== null) return;

    const isHover = hoverSlotId === s.id;
    let canAfford = false;
    if (selectedTowerType) canAfford = coins >= TOWER_DEFS[selectedTowerType].cost;
    else if (inventoryPlaceItem) canAfford = true;

    // Merge mode: tint empty slots orange
    if (mergeMode) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle   = 'rgba(251,146,60,0.15)';
      ctx.strokeStyle = 'rgba(251,146,60,0.3)';
    } else {
      ctx.globalAlpha = isHover ? 0.7 : 0.3;
      ctx.fillStyle   = isHover
        ? (canAfford ? 'rgba(134,239,172,0.25)' : 'rgba(239,68,68,0.2)')
        : 'rgba(34,197,94,0.1)';
      ctx.strokeStyle = isHover
        ? (canAfford ? '#86efac' : '#ef4444')
        : 'rgba(34,197,94,0.4)';
    }
    ctx.lineWidth = isHover ? 2 : 1;

    ctx.beginPath();
    const sr = 6, sx2 = s.x, sy2 = s.y, sw = SLOT_SIZE, sh = SLOT_SIZE;
    ctx.moveTo(sx2 + sr, sy2);
    ctx.lineTo(sx2 + sw - sr, sy2); ctx.arcTo(sx2+sw, sy2, sx2+sw, sy2+sr, sr);
    ctx.lineTo(sx2 + sw, sy2 + sh - sr); ctx.arcTo(sx2+sw, sy2+sh, sx2+sw-sr, sy2+sh, sr);
    ctx.lineTo(sx2 + sr, sy2 + sh); ctx.arcTo(sx2, sy2+sh, sx2, sy2+sh-sr, sr);
    ctx.lineTo(sx2, sy2 + sr); ctx.arcTo(sx2, sy2, sx2+sr, sy2, sr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isHover && !mergeMode) {
      ctx.strokeStyle = 'rgba(34,197,94,0.35)';
      ctx.lineWidth   = 1;
      const cx = s.x + SLOT_SIZE/2, cy = s.y + SLOT_SIZE/2;
      ctx.beginPath(); ctx.moveTo(cx-6,cy); ctx.lineTo(cx+6,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy-6); ctx.lineTo(cx,cy+6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function drawTower(t, now) {
  const R   = 18 * (1 + (t.level - 1) * 0.15);
  const def = TOWER_DEFS[t.type];
  const x   = t.x, y = t.y;
  const tier = t.tier;

  // Merge mode: selected towers glow orange or red
  if (mergeMode) {
    const idx = mergeSelected.indexOf(t.id);
    if (idx >= 0) {
      // Highlight selected
      const ts   = mergeSelected.map(id => getTowerById(id)).filter(Boolean);
      const compatible = ts.every(tt => tt.type === ts[0].type && tt.tier === ts[0].tier);
      const glowColor  = (mergeSelected.length < 3 || compatible) ? '#fb923c' : '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, R + 7, 0, Math.PI * 2);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.shadowBlur  = 14;
      ctx.shadowColor = glowColor;
      ctx.stroke();
      ctx.shadowBlur  = 0;
      // Checkmark
      ctx.fillStyle   = glowColor;
      ctx.font        = 'bold 10px Courier New';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x, y - R - 10);
    } else if (mergeSelected.length === 3) {
      // Dim incompatible
      ctx.globalAlpha = 0.45;
    }
  }

  // Legendary rotating stars
  if (tier === 5) {
    const numStars = 5;
    for (let si = 0; si < numStars; si++) {
      const angle = (si / numStars) * Math.PI * 2 + now * 0.001;
      const sx = x + Math.cos(angle) * (R + 12);
      const sy = y + Math.sin(angle) * (R + 12);
      ctx.fillStyle = '#fbbf24';
      ctx.font      = '10px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', sx, sy);
    }
  }

  // Epic pulsing double ring
  if (tier === 4) {
    const pulse1 = R + 8 + 3 * Math.sin(now * 0.006);
    const pulse2 = R + 14 + 3 * Math.sin(now * 0.006 + Math.PI);
    ctx.beginPath(); ctx.arc(x, y, pulse1, 0, Math.PI*2);
    ctx.strokeStyle = TIER_COLORS[4] + '88'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, pulse2, 0, Math.PI*2);
    ctx.strokeStyle = TIER_COLORS[4] + '44'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Tier ring around tower
  if (tier > 1) {
    const ringThick = 2 + tier * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = TIER_COLORS[tier];
    ctx.lineWidth   = ringThick;
    ctx.stroke();
  }

  // Glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, R * 2.5);
  grd.addColorStop(0,   t.color + '55');
  grd.addColorStop(1,   'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, R * 2.5, 0, Math.PI * 2); ctx.fill();

  switch (t.type) {
    case 'fire':   drawFireTower(t, R, now);   break;
    case 'ice':    drawIceTower(t, R, now);    break;
    case 'storm':  drawStormTower(t, R, now);  break;
    case 'shadow': drawShadowTower(t, R, now); break;
    case 'light':  drawLightTower(t, R, now);  break;
    case 'nova':   drawNovaTower(t, R, now);   break;
    default:       drawBaseTower(t, R);        break;
  }

  // Level dots
  for (let l = 0; l < t.level; l++) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - (t.level-1)*5 + l*10, y + R + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Emoji
  ctx.font      = `${Math.floor(R * 0.9)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.emoji, x, y);

  ctx.globalAlpha = 1;
}

function drawBaseTower(t, R) {
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.fill();
}

function drawFireTower(t, R, now) {
  const flicker = 0.85 + 0.15 * Math.sin(now * 0.015 + t.animT);
  const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, R);
  grad.addColorStop(0, '#fbbf24');
  grad.addColorStop(0.5, '#ef4444');
  grad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(t.x, t.y, R * flicker, 0, Math.PI * 2);
  ctx.fill();
}

function drawIceTower(t, R, now) {
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + t.animT * 0.5;
    const x1 = t.x + Math.cos(angle) * R * 0.6;
    const y1 = t.y + Math.sin(angle) * R * 0.6;
    const x2 = t.x + Math.cos(angle) * R * 1.3;
    const y2 = t.y + Math.sin(angle) * R * 1.3;
    ctx.strokeStyle = 'rgba(147,210,255,0.7)';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
}

function drawStormTower(t, R, now) {
  ctx.fillStyle = '#2d2a06';
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = t.color;
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.stroke();
  if (Math.sin(now * 0.02 + t.animT) > 0.5) {
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth   = 1.5;
    const a1 = t.animT, a2 = a1 + Math.PI;
    ctx.beginPath();
    ctx.moveTo(t.x + Math.cos(a1)*R*0.3, t.y + Math.sin(a1)*R*0.3);
    ctx.lineTo(t.x + Math.cos(a1)*R*1.1, t.y + Math.sin(a1)*R*1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(t.x + Math.cos(a2)*R*0.3, t.y + Math.sin(a2)*R*0.3);
    ctx.lineTo(t.x + Math.cos(a2)*R*1.1, t.y + Math.sin(a2)*R*1.1);
    ctx.stroke();
  }
}

function drawShadowTower(t, R, now) {
  const pulse = 0.8 + 0.2 * Math.sin(now * 0.006 + t.animT);
  const grad  = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, R * pulse);
  grad.addColorStop(0, '#a855f7');
  grad.addColorStop(0.6, '#4c1d95');
  grad.addColorStop(1, '#1a0030');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(t.x, t.y, R * pulse, 0, Math.PI * 2);
  ctx.fill();
}

function drawLightTower(t, R, now) {
  ctx.fillStyle = '#f9fafb';
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + t.animT * 0.3;
    ctx.strokeStyle = 'rgba(253,253,253,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(t.x + Math.cos(angle)*R, t.y + Math.sin(angle)*R);
    ctx.lineTo(t.x + Math.cos(angle)*R*1.7, t.y + Math.sin(angle)*R*1.7);
    ctx.stroke();
  }
}

function drawNovaTower(t, R, now) {
  const pulsed = R * (1 + 0.12 * Math.sin(now * 0.008 + t.animT));
  const grad   = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, pulsed);
  grad.addColorStop(0, '#e879f9');
  grad.addColorStop(0.5, '#9333ea');
  grad.addColorStop(1, '#3b0764');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(t.x, t.y, pulsed, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(192,132,252,0.5)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(t.x, t.y, pulsed * 1.4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEnemy(e, now) {
  const pos  = distToXY(e.distTraveled);
  const base = 16 * e.size;
  ctx.globalAlpha = e.alpha;

  if (e.special === 'boss' || e.special === 'miniboss') {
    const auraColor = e.special === 'boss' ? 'rgba(220,38,38,0.3)' : 'rgba(249,115,22,0.25)';
    const aura = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, base * 2);
    aura.addColorStop(0, auraColor);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, base * 2, 0, Math.PI * 2); ctx.fill();

    if (e.shield > 0) {
      ctx.strokeStyle = `rgba(255,215,0,${0.4 + 0.4*(e.shield/e.shieldMax)})`;
      ctx.lineWidth   = 3;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, base + 4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const grad = ctx.createRadialGradient(pos.x - base*0.2, pos.y - base*0.2, 0, pos.x, pos.y, base);
  grad.addColorStop(0, lightenColor(e.color, 40));
  grad.addColorStop(1, e.color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, base, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  e.statuses.forEach(st => {
    let sc = null;
    if (st.type === 'slow')   sc = '#60a5fa';
    if (st.type === 'burn')   sc = '#fbbf24';
    if (st.type === 'poison') sc = '#a3e635';
    if (st.type === 'stun')   sc = '#f9fafb';
    if (sc) {
      ctx.strokeStyle = sc + 'aa';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, base + 3, 0, Math.PI * 2); ctx.stroke();
    }
  });

  ctx.font      = `${Math.floor(base * 0.85)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e.emoji, pos.x, pos.y);

  const barW = base * 2.4, barH = 5;
  const barX = pos.x - barW/2;
  const barY = pos.y - base - 14;
  ctx.fillStyle = '#111';
  ctx.fillRect(barX, barY, barW, barH);
  const hpRatio = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#fbbf24' : '#ef4444';
  ctx.fillRect(barX, barY, barW * hpRatio, barH);

  if ((e.special === 'boss' || e.special === 'miniboss') && e.shieldMax > 0) {
    const sBarY = barY - 7;
    ctx.fillStyle = '#111';
    ctx.fillRect(barX, sBarY, barW, 4);
    ctx.fillStyle = 'gold';
    ctx.fillRect(barX, sBarY, barW * (e.shield / e.shieldMax), 4);
  }

  ctx.globalAlpha = 1;
}

function drawProjectile(p) {
  ctx.fillStyle   = p.color;
  ctx.shadowBlur  = 8;
  ctx.shadowColor = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;
}

function drawParticle(p) {
  ctx.globalAlpha = Math.max(0, p.life);
  ctx.fillStyle   = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFloatText(f) {
  ctx.globalAlpha  = Math.max(0, f.life);
  ctx.font         = `bold ${f.size}px 'Courier New', monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  // Drop shadow for legibility on light background
  ctx.shadowColor  = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur   = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle    = f.color;
  ctx.fillText(f.text, f.x, f.y);
  ctx.shadowBlur   = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha  = 1;
}

function drawBase(now) {
  const bx = 1150, by = 510;
  const pulse = 1 + 0.06 * Math.sin(now * 0.004);
  const hpRatio = baseHP / baseMaxHP;
  const baseColor = hpRatio > 0.5 ? '#2d6e3a' : hpRatio > 0.25 ? '#d97706' : '#dc2626';
  const glowColor = hpRatio > 0.5 ? '#86efac' : hpRatio > 0.25 ? '#fcd34d' : '#fca5a5';

  // Ground glow beneath castle
  const grd = ctx.createRadialGradient(bx, by + 8, 0, bx, by + 8, 52 * pulse);
  grd.addColorStop(0, glowColor + '55');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(bx, by + 8, 52 * pulse, 0, Math.PI * 2); ctx.fill();

  // Castle tower body (stone grey-brown)
  const cw = 36, ch = 44;
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(bx - cw/2, by - ch/2, cw, ch);

  // Castle battlements (top)
  ctx.fillStyle = '#7a6a5a';
  const merlonW = 7, merlonH = 10, merlonGap = 5;
  for (let mx = bx - cw/2; mx < bx + cw/2 - merlonW + 1; mx += merlonW + merlonGap) {
    ctx.fillRect(mx, by - ch/2 - merlonH, merlonW, merlonH);
  }

  // Castle door arch
  ctx.fillStyle = '#2c1810';
  ctx.beginPath();
  ctx.arc(bx, by + ch/2 - 10, 8, Math.PI, 0);
  ctx.lineTo(bx + 8, by + ch/2);
  ctx.lineTo(bx - 8, by + ch/2);
  ctx.closePath();
  ctx.fill();

  // Castle windows
  ctx.fillStyle = '#fcd34d';
  ctx.globalAlpha = 0.8 + 0.2 * Math.sin(now * 0.003);
  ctx.beginPath(); ctx.arc(bx - 9, by - 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 9, by - 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // HP colour outline
  ctx.strokeStyle = baseColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(bx - cw/2, by - ch/2, cw, ch);

  // HP bar
  const bw = 62;
  ctx.fillStyle = 'rgba(40,20,5,0.45)';
  ctx.beginPath();
  ctx.roundRect(bx - bw/2, by + ch/2 + 5, bw, 7, 3);
  ctx.fill();
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.roundRect(bx - bw/2, by + ch/2 + 5, bw * hpRatio, 7, 3);
  ctx.fill();

  ctx.fillStyle    = '#2c1810';
  ctx.font         = 'bold 10px Georgia, serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('🏰 BASE', bx, by + ch/2 + 15);
}

// ── Helper ─────────────────────────────────────────────────
function lightenColor(hex, amount) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${Math.min(255,r+amount)},${Math.min(255,g+amount)},${Math.min(255,b+amount)})`;
}

// ── Achievements ──────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'first_blood',   emoji:'🩸', name:'First Blood',      desc:'Kill your first enemy' },
  { id:'wave_10',       emoji:'🌊', name:'Wave Survivor',    desc:'Complete Wave 10 of any level' },
  { id:'first_merge',   emoji:'🔀', name:'Alchemist',        desc:'Perform your first merge' },
  { id:'boss_slayer',   emoji:'💀', name:'Boss Slayer',      desc:'Kill a boss' },
  { id:'legend_tower',  emoji:'⭐', name:'Legendary!',       desc:'Obtain a Legendary tower' },
  { id:'synergy_hit',   emoji:'💥', name:'Elemental Combo',  desc:'Trigger a tower synergy' },
  { id:'no_dmg_wave',   emoji:'🛡️', name:'Untouchable',     desc:'Complete a wave without base damage' },
  { id:'level_3',       emoji:'🏆', name:'Veteran',          desc:'Reach Level 3' },
  { id:'level_5',       emoji:'🥇', name:'Champion',         desc:'Reach Level 5' },
  { id:'level_10',      emoji:'👑', name:'Legendary Run',    desc:'Complete all 10 Levels' },
  { id:'rich',          emoji:'💰', name:'Gold Rush',        desc:'Accumulate 2000 coins at once' },
  { id:'tower_10',      emoji:'🏰', name:'Fortress',         desc:'Place 10 towers on the field' },
  { id:'speed_run',     emoji:'⚡', name:'Speed Freak',      desc:'Send 3 waves early in a row' },
  { id:'gacha_10',      emoji:'🎲', name:'Gambler',          desc:'Do 10 gacha pulls total' },
];

let unlockedAchievements = new Set();
let earlyWaveStreak = 0;
let totalGachaPulls = 0;
let waveBaseHpStart = 0; // HP at wave start — to detect no-damage wave

function loadAchievements() {
  try {
    const saved = localStorage.getItem(`tower_achievements_${nick}`);
    if (saved) unlockedAchievements = new Set(JSON.parse(saved));
  } catch(e) { unlockedAchievements = new Set(); }
  try { totalGachaPulls = parseInt(localStorage.getItem(`tower_total_pulls_${nick}`)) || 0; } catch(e) {}
}

function saveAchievements() {
  localStorage.setItem(`tower_achievements_${nick}`, JSON.stringify([...unlockedAchievements]));
}

function unlockAchievement(id) {
  if (unlockedAchievements.has(id)) return; // already unlocked
  unlockedAchievements.add(id);
  saveAchievements();
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  showAchievementToast(ach);
}

function showAchievementToast(ach) {
  const container = document.getElementById('achievement-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `
    <div class="ach-toast-icon">${ach.emoji}</div>
    <div class="ach-toast-body">
      <div class="ach-toast-title">ACHIEVEMENT UNLOCKED!</div>
      <div class="ach-toast-name">${ach.name}</div>
      <div class="ach-toast-desc">${ach.desc}</div>
    </div>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('ach-exit');
    setTimeout(() => el.remove(), 500);
  }, 3800);
}

function checkAchievements() {
  // Kills
  if (sessionKills >= 1) unlockAchievement('first_blood');
  if (bossesKilled >= 1) unlockAchievement('boss_slayer');
  // Towers
  if (towers.length >= 10) unlockAchievement('tower_10');
  // Coins
  if (coins >= 2000) unlockAchievement('rich');
  // Level
  if (currentLevel >= 3) unlockAchievement('level_3');
  if (currentLevel >= 5) unlockAchievement('level_5');
  if (currentLevel >= 10 && !waveActive && currentWave === 10) unlockAchievement('level_10');
  // Legendary tier
  if (towers.some(t => t.tier === 5) || inventory.some(it => it.tier === 5)) unlockAchievement('legend_tower');
  // Gacha
  if (totalGachaPulls >= 10) unlockAchievement('gacha_10');
}

// ── Tower Synergies ───────────────────────────────────────
// Called from applyDamage when a tower hits; checks if enemy has
// a complementary status effect → bonus burst damage
const SYNERGIES = [
  // Fire + Ice on same enemy = Steam Burst (1.5× bonus)
  { attacker:'fire',   requires:'slow',   mult:1.5,  label:'💨 STEAM BURST!',  color:'#67e8f9' },
  { attacker:'ice',    requires:'burn',   mult:1.5,  label:'💨 STEAM BURST!',  color:'#67e8f9' },
  // Storm + Shadow = Void Storm (2× bonus)
  { attacker:'storm',  requires:'poison', mult:2.0,  label:'🌀 VOID STORM!',   color:'#c084fc' },
  { attacker:'shadow', requires:'chain',  mult:2.0,  label:'🌀 VOID STORM!',   color:'#c084fc' },
  // Light + Shadow = Holy Judgment (2.5× bonus)
  { attacker:'light',  requires:'poison', mult:2.5,  label:'✨ HOLY JUDGMENT!', color:'#fde047' },
  // Nova + any DoT = Supernova (1.8× bonus)
  { attacker:'nova',   requires:'burn',   mult:1.8,  label:'💥 SUPERNOVA!',    color:'#f0abfc' },
  { attacker:'nova',   requires:'poison', mult:1.8,  label:'💥 SUPERNOVA!',    color:'#f0abfc' },
];

function checkSynergy(enemy, attackerType, baseDmg, now) {
  const syn = SYNERGIES.find(s =>
    s.attacker === attackerType &&
    enemy.statuses.some(st => st.type === s.requires)
  );
  if (!syn) return 0;

  const bonus = baseDmg * (syn.mult - 1);
  enemy.hp -= bonus;
  const pos = distToXY(enemy.distTraveled);
  addFloatText(syn.label, pos.x, pos.y - 36, syn.color, 14);
  unlockAchievement('synergy_hit');

  if (enemy.hp <= 0 && enemy.alive) killEnemy(enemy, now);
  return bonus;
}

// ── Wave Announcement Banner ──────────────────────────────
let _wannTimer = null;
function showWaveAnnounce(label, title, sub, color, glow) {
  const el = document.getElementById('wave-announce');
  if (!el) return;
  if (_wannTimer) { clearTimeout(_wannTimer); _wannTimer = null; }
  el.style.setProperty('--wann-color', color);
  el.style.setProperty('--wann-glow', glow);
  el.innerHTML = `<div class="wann-label">${label}</div>
<div class="wann-title">${title}</div>
<div class="wann-sub">${sub}</div>`;
  el.classList.remove('hidden', 'wann-out');
  void el.offsetWidth; // force reflow
  el.classList.add('wann-in');
  _wannTimer = setTimeout(() => {
    el.classList.remove('wann-in');
    el.classList.add('wann-out');
    _wannTimer = setTimeout(() => el.classList.add('hidden'), 380);
  }, 2200);
}

// ── Wave Preview ──────────────────────────────────────────
function buildWavePreview(level, wave) {
  const el = document.getElementById('wave-preview');
  if (!el) return;

  if (wave > 10 || pendingLevelComplete) { el.innerHTML = ''; return; }

  const groups = generateWave(level, wave);
  const isBoss5  = wave === 5;
  const isBoss10 = wave === 10;

  let html = `<span class="wp-label">NEXT WAVE:</span>`;
  if (isBoss10) html += `<span class="wp-boss">⚠️ BOSS</span>`;
  else if (isBoss5) html += `<span class="wp-mini">⚠️ MINI-BOSS</span>`;

  groups.forEach(g => {
    const def = ENEMY_DEFS[g.type];
    html += `<span class="wp-group">${def.emoji}×${g.count}</span>`;
  });
  el.innerHTML = html;
}

// ── Portal integration ────────────────────────────────────
function savePortalStats() {
  if (!nick) return;
  // Best level reached
  const blKey = `tower_best_level_${nick}`;
  const prev  = parseInt(localStorage.getItem(blKey)) || 0;
  if (currentLevel > prev) localStorage.setItem(blKey, currentLevel);

  // Best wave (absolute, 1-100)
  const bwKey = `tower_best_wave_${nick}`;
  const prevW = parseInt(localStorage.getItem(bwKey)) || 0;
  if (waveIndex > prevW) localStorage.setItem(bwKey, waveIndex);

  // Total kills already saved per-kill in killEnemy()
  // Total games already saved in startGame()
}

// ════════════════════════════════════════════════════════
//  SOUND SYSTEM — Web Audio API (procedural, no files)
// ════════════════════════════════════════════════════════

let _audioCtx    = null;
let soundEnabled = true;
let _masterGain  = null;

// Rate-limiter for tower shots (avoid audio overload with many towers)
let _lastShotSoundTime = 0;
const SHOT_SOUND_COOLDOWN = 45; // ms between tower-shot sounds globally

function getACtx() {
  if (!_audioCtx) {
    _audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _audioCtx.createGain();
    _masterGain.gain.value = 0.55;
    _masterGain.connect(_audioCtx.destination);
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

// ── Low-level helpers ─────────────────────────────────────
function _osc(type, freq, startTime, endTime, freqEnd, volume, ctx, dest) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, endTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(endTime + 0.01);
}

function _noise(dur, volume, startTime, ctx, dest) {
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data    = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
  const src  = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filt = ctx.createBiquadFilter();
  src.buffer = buf;
  filt.type  = 'bandpass';
  filt.frequency.value = 400;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  src.connect(filt); filt.connect(gain); gain.connect(dest);
  src.start(startTime);
}

// ── Public sound triggers ─────────────────────────────────
function playSound(name, opts) {
  if (!soundEnabled) return;
  const ctx  = getACtx();
  const now  = ctx.currentTime;
  const dest = _masterGain;

  switch(name) {

    // ── Tower shots ───────────────────────────────────────
    case 'shot_fire': {
      // Crackling whoosh: sawtooth sweep down + noise burst
      const wallNow = performance.now();
      if (wallNow - _lastShotSoundTime < SHOT_SOUND_COOLDOWN) return;
      _lastShotSoundTime = wallNow;
      _osc('sawtooth', 380, now, now + 0.09, 120, 0.22, ctx, dest);
      _noise(0.06, 0.12, now, ctx, dest);
      break;
    }
    case 'shot_ice': {
      const wallNow = performance.now();
      if (wallNow - _lastShotSoundTime < SHOT_SOUND_COOLDOWN) return;
      _lastShotSoundTime = wallNow;
      // Crystalline high ping
      _osc('sine', 1400, now, now + 0.12, 900, 0.18, ctx, dest);
      _osc('sine', 2100, now, now + 0.06, 2100, 0.07, ctx, dest);
      break;
    }
    case 'shot_storm': {
      const wallNow = performance.now();
      if (wallNow - _lastShotSoundTime < SHOT_SOUND_COOLDOWN) return;
      _lastShotSoundTime = wallNow;
      // Electric zap: square wave burst
      _osc('square', 280, now, now + 0.07, 180, 0.20, ctx, dest);
      _noise(0.04, 0.15, now, ctx, dest);
      break;
    }
    case 'shot_shadow': {
      const wallNow = performance.now();
      if (wallNow - _lastShotSoundTime < SHOT_SOUND_COOLDOWN) return;
      _lastShotSoundTime = wallNow;
      // Deep dark pulse
      _osc('sine', 140, now, now + 0.18, 55, 0.28, ctx, dest);
      _osc('triangle', 280, now, now + 0.10, 100, 0.10, ctx, dest);
      break;
    }
    case 'shot_light': {
      const wallNow = performance.now();
      if (wallNow - _lastShotSoundTime < SHOT_SOUND_COOLDOWN) return;
      _lastShotSoundTime = wallNow;
      // Bright radiant ping
      _osc('sine', 2200, now, now + 0.08, 1600, 0.16, ctx, dest);
      _osc('sine', 3300, now, now + 0.04, 3300, 0.06, ctx, dest);
      break;
    }
    case 'shot_nova': {
      const wallNow = performance.now();
      if (wallNow - _lastShotSoundTime < SHOT_SOUND_COOLDOWN) return;
      _lastShotSoundTime = wallNow;
      // Heavy impact thud + rumble
      _osc('sine', 500, now, now + 0.22, 60, 0.32, ctx, dest);
      _noise(0.10, 0.18, now, ctx, dest);
      break;
    }

    // ── Hit & kill ────────────────────────────────────────
    case 'enemy_hit': {
      // Soft short thud (don't rate-limit, but quiet)
      _osc('triangle', 300, now, now + 0.05, 120, 0.08, ctx, dest);
      break;
    }
    case 'enemy_kill': {
      // Pop + brief noise
      _osc('sine', 440, now, now + 0.08, 180, 0.14, ctx, dest);
      _noise(0.05, 0.09, now, ctx, dest);
      break;
    }
    case 'boss_kill': {
      // Epic multi-layer boom
      _osc('sine',     80,  now,        now + 0.6,  25,  0.45, ctx, dest);
      _osc('sawtooth', 200, now,        now + 0.35, 40,  0.28, ctx, dest);
      _noise(0.3, 0.30, now, ctx, dest);
      // Rising victory accent
      _osc('sine', 440, now + 0.35, now + 0.70, 880, 0.18, ctx, dest);
      break;
    }
    case 'base_hit': {
      // Sharp alarm burst
      _osc('square', 220, now,        now + 0.12, 180, 0.35, ctx, dest);
      _osc('square', 220, now + 0.14, now + 0.26, 180, 0.25, ctx, dest);
      _osc('square', 220, now + 0.28, now + 0.40, 180, 0.20, ctx, dest);
      break;
    }

    // ── Economy ───────────────────────────────────────────
    case 'coin': {
      // Bright coin jingle
      _osc('sine', 1200, now,        now + 0.07, 1600, 0.18, ctx, dest);
      _osc('sine', 1600, now + 0.05, now + 0.12, 2000, 0.12, ctx, dest);
      break;
    }
    case 'buy': {
      // Satisfying "placed" thunk
      _osc('sine', 600, now, now + 0.12, 300, 0.20, ctx, dest);
      _osc('sine', 900, now, now + 0.06, 900, 0.10, ctx, dest);
      break;
    }
    case 'sell': {
      // Descending swoosh
      _osc('triangle', 800, now, now + 0.15, 200, 0.15, ctx, dest);
      break;
    }
    case 'upgrade': {
      // Rising two-note chime
      _osc('sine', 660, now,        now + 0.12, 660, 0.20, ctx, dest);
      _osc('sine', 880, now + 0.10, now + 0.22, 880, 0.18, ctx, dest);
      break;
    }

    // ── Wave events ───────────────────────────────────────
    case 'wave_start': {
      // Three rising tones — "ready, set, go!"
      _osc('sine', 440, now,        now + 0.15, 440, 0.22, ctx, dest);
      _osc('sine', 550, now + 0.14, now + 0.28, 550, 0.22, ctx, dest);
      _osc('sine', 660, now + 0.28, now + 0.46, 660, 0.28, ctx, dest);
      break;
    }
    case 'wave_clear': {
      // Resolving arpeggio
      [523, 659, 784, 1047].forEach((f, i) => {
        _osc('sine', f, now + i*0.10, now + i*0.10 + 0.20, f, 0.22, ctx, dest);
      });
      break;
    }
    case 'boss_warning': {
      // Low ominous pulse x3
      [now, now + 0.32, now + 0.64].forEach(t => {
        _osc('sawtooth', 110, t, t + 0.28, 80, 0.30, ctx, dest);
        _noise(0.20, 0.12, t, ctx, dest);
      });
      break;
    }
    case 'early_wave': {
      // Quick double-beep
      _osc('square', 880, now,        now + 0.08, 880, 0.18, ctx, dest);
      _osc('square', 880, now + 0.10, now + 0.18, 880, 0.14, ctx, dest);
      break;
    }

    // ── Level & game events ───────────────────────────────
    case 'level_complete': {
      // Triumphant 5-note fanfare
      const notes = [523, 659, 784, 659, 1047];
      const times = [0,   0.14, 0.28, 0.42, 0.56];
      notes.forEach((f, i) => {
        _osc('sine',     f,    now + times[i], now + times[i] + 0.22, f,    0.28, ctx, dest);
        _osc('triangle', f*2,  now + times[i], now + times[i] + 0.12, f*2,  0.08, ctx, dest);
      });
      break;
    }
    case 'victory': {
      // Grand 8-note fanfare
      const vnotes = [523, 659, 784, 880, 1047, 880, 1047, 1319];
      vnotes.forEach((f, i) => {
        _osc('sine',     f,   now + i*0.13, now + i*0.13 + 0.25, f*1.01, 0.30, ctx, dest);
        _osc('triangle', f/2, now + i*0.13, now + i*0.13 + 0.20, f/2,    0.10, ctx, dest);
      });
      break;
    }
    case 'game_over': {
      // Sad descending tones
      const gnotes = [440, 370, 330, 220];
      gnotes.forEach((f, i) => {
        _osc('triangle', f, now + i*0.22, now + i*0.22 + 0.35, f*0.9, 0.25, ctx, dest);
      });
      _noise(0.4, 0.12, now + 0.6, ctx, dest);
      break;
    }

    // ── Merge & shop ──────────────────────────────────────
    case 'merge': {
      // Magical ascending sparkle
      const mfreqs = [523, 659, 784, 1047, 1319, 1568];
      mfreqs.forEach((f, i) => {
        _osc('sine', f, now + i*0.06, now + i*0.06 + 0.18, f*1.05, 0.20, ctx, dest);
      });
      _noise(0.12, 0.10, now + 0.30, ctx, dest);
      break;
    }
    case 'pull': {
      // Dramatic reveal sweep
      _osc('sine', 300, now, now + 0.30, 1200, 0.25, ctx, dest);
      _osc('triangle', 600, now + 0.15, now + 0.45, 1800, 0.15, ctx, dest);
      break;
    }
    case 'pull_legendary': {
      // Epic legendary pull
      _osc('sine',     300,  now,        now + 0.40, 1600, 0.30, ctx, dest);
      _osc('triangle', 600,  now + 0.20, now + 0.55, 2400, 0.20, ctx, dest);
      [1047, 1319, 1568, 2093].forEach((f, i) => {
        _osc('sine', f, now + 0.50 + i*0.09, now + 0.50 + i*0.09 + 0.20, f, 0.25, ctx, dest);
      });
      break;
    }

    // ── Abilities ─────────────────────────────────────────
    case 'tornado': {
      // Rising whoosh
      _osc('sawtooth', 80, now, now + 0.55, 400, 0.30, ctx, dest);
      _noise(0.50, 0.25, now, ctx, dest);
      break;
    }
    case 'freeze': {
      // Crystalline shatter + cold wind
      _osc('sine', 1800, now, now + 0.10, 2800, 0.20, ctx, dest);
      _osc('sine', 2200, now + 0.05, now + 0.15, 3200, 0.15, ctx, dest);
      _noise(0.25, 0.18, now + 0.08, ctx, dest);
      break;
    }
    case 'airstrike': {
      // Whistling bomb drop + explosion
      _osc('sine', 1200, now,        now + 0.45, 200, 0.25, ctx, dest); // whistle down
      _noise(0.40, 0.35, now + 0.40, ctx, dest);                         // explosion
      _osc('sine', 120,  now + 0.40, now + 0.90, 30,  0.40, ctx, dest); // low boom
      break;
    }

    // ── Achievement ───────────────────────────────────────
    case 'achievement': {
      // Happy chime trio
      _osc('sine', 784,  now,        now + 0.18, 784,  0.25, ctx, dest);
      _osc('sine', 1047, now + 0.15, now + 0.33, 1047, 0.25, ctx, dest);
      _osc('sine', 1319, now + 0.30, now + 0.52, 1400, 0.28, ctx, dest);
      break;
    }

    // ── Synergy ───────────────────────────────────────────
    case 'synergy': {
      // Dramatic impact swell
      _osc('sine',     800, now,        now + 0.20, 400, 0.22, ctx, dest);
      _osc('sawtooth', 400, now,        now + 0.15, 200, 0.15, ctx, dest);
      _osc('sine',     600, now + 0.15, now + 0.35, 900, 0.18, ctx, dest);
      break;
    }
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-btn');
  if (btn) {
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.title = soundEnabled ? 'Mute sounds' : 'Enable sounds';
    btn.classList.toggle('muted', !soundEnabled);
  }
  // Resume AudioContext on first interaction
  if (soundEnabled) getACtx();
}
