'use strict';

// ════════════════════════════════════════════════════════
// DOM REFS
// ════════════════════════════════════════════════════════

const tileContainer   = document.getElementById('tile-container');
const scoreEl         = document.getElementById('score');
const bestEl          = document.getElementById('best');
const coinsEl         = document.getElementById('coins');
const messageEl       = document.getElementById('message');
const messageTextEl   = document.getElementById('message-text');
const newGameBtn      = document.getElementById('new-game-btn');
const restartBtn      = document.getElementById('restart-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const playerNameEl    = document.getElementById('player-name');
const nicknameOverlay = document.getElementById('nickname-overlay');
const nicknameInput   = document.getElementById('nickname-input');
const nicknameBtn     = document.getElementById('nickname-btn');
const mainEl          = document.getElementById('main');
const gridBackground  = document.getElementById('grid-background');
const bombBtn         = document.getElementById('bomb-btn');
const bombCountEl     = document.getElementById('bomb-count');
const levelValEl      = document.getElementById('level-val');
const xpValEl         = document.getElementById('xp-val');
const xpNextEl        = document.getElementById('xp-next');
const xpBarFill       = document.getElementById('xp-bar-fill');
const prestigeBadgeEl = document.getElementById('prestige-badge');
const prestigeSection = document.getElementById('prestige-section');
const prestigeBtn     = document.getElementById('prestige-btn');
const dailyListEl     = document.getElementById('daily-list');
const milestoneOverlay= document.getElementById('milestone-overlay');
const milestoneIcon   = document.getElementById('milestone-icon');
const milestoneLabel  = document.getElementById('milestone-label');
const milestoneParticles = document.getElementById('milestone-particles');
const levelupPopup    = document.getElementById('levelup-popup');
const levelupText     = document.getElementById('levelup-text');
const levelupSub      = document.getElementById('levelup-sub');

// ════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════

const GRID_SIZE = 6;
const GAP       = 10;

const START_UPGRADE_VALUES = [2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384,32768,65536,131072];
const START_UPGRADE_COSTS  = [5,10,20,40,80,160,320,640,1280,2560,5120,10240,20480,40960,81920,163840];

// Tile values (powers of 2): 2^17=131072≈128K, 2^24=16777216≈16M, 2^31=2147483648≈2B
const PRESTIGE_THRESHOLDS = [131_072, 16_777_216, 2_147_483_648];
const PRESTIGE_MULT       = [1, 2, 3, 5];
const PRESTIGE_BADGE      = ['', '⭐', '⭐⭐', '⭐⭐⭐'];

const XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000];

const TASK_POOL = [
    { id: 'merge_10',   desc: 'Merge 10 tiles',        goal: 10,    type: 'merge',  reward: { coins: 5 } },
    { id: 'merge_20',   desc: 'Merge 20 tiles',        goal: 20,    type: 'merge',  reward: { coins: 8, xp: 20 } },
    { id: 'score_1k',   desc: 'Reach score 1,000',     goal: 1000,  type: 'score',  reward: { coins: 3, xp: 50 } },
    { id: 'score_5k',   desc: 'Reach score 5,000',     goal: 5000,  type: 'score',  reward: { coins: 8, xp: 80 } },
    { id: 'score_10k',  desc: 'Reach score 10,000',    goal: 10000, type: 'score',  reward: { coins: 15, xp: 120 } },
    { id: 'buy_item',   desc: 'Buy an upgrade',        goal: 1,     type: 'shop',   reward: { coins: 2 } },
    { id: 'new_tile',   desc: 'Unlock a new tile',     goal: 1,     type: 'newtile',reward: { xp: 20 } },
    { id: 'use_bomb',   desc: 'Use a bomb',            goal: 1,     type: 'bomb',   reward: { coins: 3 } },
    { id: 'combo_3',    desc: 'Get a 3× combo',        goal: 1,     type: 'combo3', reward: { coins: 5, xp: 30 } },
    { id: 'combo_5',    desc: 'Get a 5× combo',        goal: 1,     type: 'combo5', reward: { coins: 8, xp: 50 } },
];

const MILESTONES = {
    2048:  { icon: '🏅', label: 'LEGENDARY!',    color: '#edc22e', bg: 'rgba(237,194,46,0.15)',  count: 22 },
    4096:  { icon: '💜', label: 'MYTHIC!',        color: '#a855f7', bg: 'rgba(168,85,247,0.15)',  count: 30 },
    8192:  { icon: '🌈', label: 'COSMIC!',        color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   count: 38 },
    16384: { icon: '🌟', label: 'TRANSCENDENT!',  color: '#fbbf24', bg: 'rgba(251,191,36,0.2)',   count: 50 },
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════

let board, score, best, nickname;
let coins, bombs, unlockedTiles;
let bombMode   = false;
let comboCount = 0;
let prestige   = 0;

// Undo stack — stores up to 3 snapshots of {board, score}
let undoStack = [];
const MAX_UNDOS = 3;
let xp         = 0;
let level      = 1;
let upgrades   = { startLevel: 0, bigchance: false };
let dailyState = null;   // { date, tasks: [{id, progress, goal, claimed}] }
let celebratedMilestones = new Set();
let sessionMerges  = 0;
let sessionShopBuys= 0;
let sessionBombs   = 0;
let sessionNewTile = 0;
let sessionCombo3  = 0;
let sessionCombo5  = 0;

// ════════════════════════════════════════════════════════
// GRID BACKGROUND CELLS
// ════════════════════════════════════════════════════════

for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    gridBackground.appendChild(cell);
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function formatNumber(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (n >= 1e9)  return (n / 1e9 ).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4)  return (n / 1e3 ).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

// Binary-prefix formatter for tile values (powers of 2)
// 131072 → "128K", 16777216 → "16M", 2147483648 → "2B"
function formatTileVal(n) {
    if (n >= 1073741824) return (n / 1073741824) + 'B';  // 2^30
    if (n >= 1048576)    return (n / 1048576) + 'M';      // 2^20
    if (n >= 1024)       return (n / 1024) + 'K';         // 2^10
    return String(n);
}

function getTileColor(val) {
    const map = {
        2:    ['#eee4da','#776e65'], 4:    ['#ede0c8','#776e65'],
        8:    ['#f2b179','#fff'],    16:   ['#f59563','#fff'],
        32:   ['#f67c5f','#fff'],    64:   ['#f65e3b','#fff'],
        128:  ['#edcf72','#fff'],    256:  ['#edcc61','#fff'],
        512:  ['#edc850','#fff'],    1024: ['#edc53f','#fff'],
        2048: ['#edc22e','#fff'],
    };
    if (map[val]) return { bg: map[val][0], color: map[val][1] };
    const palettes = ['#a855f7','#8b5cf6','#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#84cc16'];
    const tier = Math.max(0, Math.floor(Math.log2(val)) - 11);
    return { bg: palettes[tier % palettes.length], color: '#fff' };
}

function getFontSize(val) {
    const len = formatNumber(val).length;
    if (len <= 2) return '26px';
    if (len <= 4) return '20px';
    if (len <= 6) return '15px';
    return '12px';
}

function getCellSize() {
    return (tileContainer.offsetWidth - GAP * (GRID_SIZE - 1)) / GRID_SIZE;
}

// ════════════════════════════════════════════════════════
// COINS (with prestige multiplier)
// ════════════════════════════════════════════════════════

function earnCoins(base) {
    const mult = PRESTIGE_MULT[prestige] || 1;
    return base * mult;
}

// ════════════════════════════════════════════════════════
// XP / LEVEL
// ════════════════════════════════════════════════════════

function addXP(amount) {
    if (amount > 0) {
        // Apply portal XP boost if active
        const boostUntil = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
        if (Date.now() < boostUntil) amount *= 2;
    }
    const prevLevel = level;
    xp += amount;
    level = getLevel(xp);
    saveXP();
    updateXPBar();
    if (level > prevLevel) onLevelUp(level);
}

function getLevel(totalXp) {
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXp >= XP_THRESHOLDS[i]) return i + 1;
    }
    return 1;
}

function updateXPBar() {
    const idx     = level - 1;
    const current = xp - (XP_THRESHOLDS[idx] || 0);
    const needed  = (XP_THRESHOLDS[idx + 1] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1]) - (XP_THRESHOLDS[idx] || 0);
    const pct     = Math.min(100, Math.floor(current / needed * 100));
    levelValEl.textContent    = level;
    xpValEl.textContent       = current;
    xpNextEl.textContent      = needed;
    xpBarFill.style.width     = `${pct}%`;
}

function onLevelUp(newLevel) {
    const reward = newLevel * 2;
    coins += earnCoins(reward);
    saveAll();
    showLevelupPopup(newLevel, reward);
}

function showLevelupPopup(lv, coinsReward) {
    levelupText.textContent = `LEVEL ${lv}!`;
    levelupSub.textContent  = `+${coinsReward * PRESTIGE_MULT[prestige]} 🪙 reward`;
    levelupPopup.classList.remove('hidden');
    levelupPopup.classList.add('show');
    setTimeout(() => {
        levelupPopup.classList.remove('show');
        levelupPopup.classList.add('hidden');
    }, 2200);
}

function saveXP() {
    localStorage.setItem(`u2048_xp_${nickname}`,    String(xp));
    localStorage.setItem(`u2048_level_${nickname}`,  String(level));
}

// ════════════════════════════════════════════════════════
// PRESTIGE
// ════════════════════════════════════════════════════════

function getPrestigeThreshold() {
    return PRESTIGE_THRESHOLDS[prestige] ?? Infinity;
}

function getMaxTileEver() {
    return parseInt(localStorage.getItem(`u2048_max_tile_${nickname}`)) || 0;
}

function checkPrestigeAvailable() {
    if (prestige >= PRESTIGE_THRESHOLDS.length) {
        prestigeSection.classList.add('hidden');
        return;
    }
    const threshold = PRESTIGE_THRESHOLDS[prestige];
    const eligible  = getMaxTileEver() >= threshold;
    prestigeSection.classList.toggle('hidden', !eligible);
    if (eligible) {
        const nextMult  = PRESTIGE_MULT[prestige + 1] || PRESTIGE_MULT[PRESTIGE_MULT.length - 1];
        const tileLabel = formatTileVal(threshold);
        document.getElementById('prestige-desc').textContent =
            `⭐ Ai atins tile-ul ${tileLabel}! Prestige ${prestige + 1} disponibil — board reset, ×${nextMult} coins permanent.`;
        document.getElementById('prestige-btn').textContent =
            `⭐ PRESTIGE ${prestige + 1}  (×${nextMult} coins)`;
    }
}

function doPrestige() {
    const next = prestige + 1;
    if (next > 3) return;
    const tileLabel = formatTileVal(PRESTIGE_THRESHOLDS[prestige]);
    const msg = `PRESTIGE ${next}?\n\nAi atins tile-ul ${tileLabel} — felicitări!\n\nSe resetează: board, scor curent.\nPăstrezi: coins, upgrades, unlocked tiles, XP.\nRecompensă: ×${PRESTIGE_MULT[next]} coins permanent.`;
    if (!confirm(msg)) return;

    prestige = next;
    localStorage.setItem(`u2048_prestige_${nickname}`, String(prestige));

    // Update badge
    prestigeBadgeEl.textContent = PRESTIGE_BADGE[prestige];

    // Reset game
    score = 0;
    scoreEl.textContent = '0';
    messageEl.classList.add('hidden');
    bombMode = false;
    bombBtn.classList.remove('active');
    comboCount = 0;
    board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    addRandomTile();
    addRandomTile();
    render();
    checkPrestigeAvailable();
    saveAll();
    showFloat(`⭐ Prestige ${prestige}! Now earning ×${PRESTIGE_MULT[prestige]} coins!`, '#fbbf24');
}

// ════════════════════════════════════════════════════════
// DAILY TASKS
// ════════════════════════════════════════════════════════

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function loadDailyTasks() {
    const key  = `u2048_daily_${nickname}`;
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    const today = todayStr();

    if (data && data.date === today) {
        dailyState = data;
    } else {
        // Generate 3 random tasks for today
        const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
        dailyState = {
            date: today,
            tasks: shuffled.map(t => ({ id: t.id, progress: 0, goal: t.goal, claimed: false })),
        };
        saveDailyTasks();
    }
    renderDailyTasks();
}

function saveDailyTasks() {
    localStorage.setItem(`u2048_daily_${nickname}`, JSON.stringify(dailyState));
}

function taskProgress(type, amount = 1) {
    if (!dailyState) return;
    dailyState.tasks.forEach(task => {
        if (task.claimed) return;
        const tmpl = TASK_POOL.find(t => t.id === task.id);
        if (!tmpl || tmpl.type !== type) return;
        task.progress = Math.min(task.goal, task.progress + amount);
        if (task.progress >= task.goal) {
            // Auto-notify but don't auto-claim
            renderDailyTasks();
        }
    });
    saveDailyTasks();
    renderDailyTasks();
}

function scoreTaskCheck() {
    if (!dailyState) return;
    dailyState.tasks.forEach(task => {
        if (task.claimed) return;
        const tmpl = TASK_POOL.find(t => t.id === task.id);
        if (!tmpl || tmpl.type !== 'score') return;
        task.progress = Math.min(task.goal, score);
    });
    saveDailyTasks();
    renderDailyTasks();
}

function claimTask(idx) {
    const task  = dailyState.tasks[idx];
    const tmpl  = TASK_POOL.find(t => t.id === task.id);
    if (!tmpl || task.claimed || task.progress < task.goal) return;

    task.claimed = true;
    saveDailyTasks();

    // Give rewards
    const r = tmpl.reward;
    if (r.coins) {
        coins += earnCoins(r.coins);
        showFloat(`📅 Task done! +${earnCoins(r.coins)} 🪙`, '#d4a017');
    }
    if (r.xp) {
        addXP(r.xp);
        showFloat(`📅 +${r.xp} XP`, '#a855f7');
    }

    // Portal achievement flag
    localStorage.setItem(`u2048_daily_done_${nickname}`, '1');

    saveAll();
    renderDailyTasks();
}

function renderDailyTasks() {
    if (!dailyState) return;
    dailyListEl.innerHTML = '';
    dailyState.tasks.forEach((task, idx) => {
        const tmpl = TASK_POOL.find(t => t.id === task.id);
        if (!tmpl) return;
        const pct     = Math.min(100, Math.floor(task.progress / task.goal * 100));
        const done    = task.progress >= task.goal;
        const claimed = task.claimed;
        const rewardStr = Object.entries(tmpl.reward)
            .map(([k, v]) => k === 'coins' ? `${earnCoins(v)}🪙` : `${v}XP`)
            .join(' + ');

        const item = document.createElement('div');
        item.className = `daily-task${claimed ? ' claimed' : done ? ' done' : ''}`;
        item.innerHTML = `
            <div class="dt-info">
                <span class="dt-desc">${tmpl.desc}</span>
                <span class="dt-reward">${rewardStr}</span>
            </div>
            <div class="dt-progress-bg">
                <div class="dt-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="dt-bottom">
                <span class="dt-count">${task.progress}/${task.goal}</span>
                ${done && !claimed
                    ? `<button class="dt-claim-btn" onclick="claimTask(${idx})">CLAIM!</button>`
                    : claimed
                        ? '<span class="dt-claimed">✅ CLAIMED</span>'
                        : ''}
            </div>
        `;
        dailyListEl.appendChild(item);
    });
}

// ════════════════════════════════════════════════════════
// PERSIST
// ════════════════════════════════════════════════════════

function saveAll() {
    localStorage.setItem(`u2048_coins_${nickname}`,    String(coins));
    localStorage.setItem(`u2048_bombs_${nickname}`,    String(bombs));
    localStorage.setItem(`u2048_best_${nickname}`,     String(best));
    localStorage.setItem(`u2048_upgrades_${nickname}`, JSON.stringify(upgrades));
    localStorage.setItem(`u2048_unlocked_${nickname}`, JSON.stringify(unlockedTiles));
    localStorage.setItem(`u2048_prestige_${nickname}`, String(prestige));
    saveXP();
    coinsEl.textContent    = coins;
    bombCountEl.textContent= bombs;
}

// ════════════════════════════════════════════════════════
// NICKNAME
// ════════════════════════════════════════════════════════

const savedNick = localStorage.getItem('portal_nickname') || localStorage.getItem('u2048_nickname');
if (savedNick) startGame(savedNick);
else nicknameOverlay.style.display = 'flex';

nicknameBtn.addEventListener('click', () => {
    const v = nicknameInput.value.trim();
    if (!v) return;
    localStorage.setItem('u2048_nickname', v);
    startGame(v);
});
nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nicknameBtn.click(); });

function startGame(name) {
    nickname = name;
    playerNameEl.textContent       = nickname;
    nicknameOverlay.style.display  = 'none';
    mainEl.classList.remove('hidden');

    best          = parseInt(localStorage.getItem(`u2048_best_${nickname}`))     || 0;
    coins         = parseInt(localStorage.getItem(`u2048_coins_${nickname}`))    || 0;
    bombs         = parseInt(localStorage.getItem(`u2048_bombs_${nickname}`))    || 0;
    upgrades      = JSON.parse(localStorage.getItem(`u2048_upgrades_${nickname}`)) || { startLevel: 0, bigchance: false };
    unlockedTiles = JSON.parse(localStorage.getItem(`u2048_unlocked_${nickname}`)) || [];
    prestige      = parseInt(localStorage.getItem(`u2048_prestige_${nickname}`)) || 0;
    xp            = parseInt(localStorage.getItem(`u2048_xp_${nickname}`))       || 0;
    level         = parseInt(localStorage.getItem(`u2048_level_${nickname}`))    || getLevel(xp);

    bestEl.textContent      = formatNumber(best);
    coinsEl.textContent     = coins;
    bombCountEl.textContent = bombs;
    prestigeBadgeEl.textContent = PRESTIGE_BADGE[prestige];

    updateXPBar();
    renderLeaderboard();
    renderShop();
    loadDailyTasks();
    updateRandomTileBtn();
    init();
}

// ════════════════════════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════════════════════════

function getLeaderboard() {
    return JSON.parse(localStorage.getItem('u2048_leaderboard') || '[]');
}

function saveToLeaderboard() {
    let lb = getLeaderboard();
    const ex = lb.find(e => e.name === nickname);
    if (ex) { if (score > ex.score) ex.score = score; }
    else lb.push({ name: nickname, score });
    lb.sort((a, b) => b.score - a.score);
    localStorage.setItem('u2048_leaderboard', JSON.stringify(lb.slice(0, 10)));
    renderLeaderboard();
}

function renderLeaderboard() {
    const lb = getLeaderboard();
    leaderboardList.innerHTML = '';
    if (!lb.length) {
        leaderboardList.innerHTML = '<li style="color:#eee4da;text-align:center;font-size:13px;">No scores yet!</li>';
        return;
    }
    lb.forEach((entry, i) => {
        const li = document.createElement('li');
        if (entry.name === nickname) li.classList.add('current-player');
        li.innerHTML = `<span class="lb-name">${i + 1}. ${entry.name}</span><span class="lb-score">${formatNumber(entry.score)}</span>`;
        leaderboardList.appendChild(li);
    });
}

// ════════════════════════════════════════════════════════
// SHOP
// ════════════════════════════════════════════════════════

function renderShop() {
    document.querySelectorAll('.shop-btn').forEach(btn => {
        const item = btn.dataset.item;
        if (item === 'start4') {
            const lvl    = upgrades.startLevel;
            const maxLvl = START_UPGRADE_COSTS.length;
            const nameEl = btn.closest('.shop-item').querySelector('.shop-name');
            const descEl = btn.closest('.shop-item').querySelector('.shop-desc');
            if (lvl >= maxLvl) {
                btn.textContent = '✅ MAX'; btn.disabled = true;
                if (nameEl) nameEl.textContent = '⬆️ Spawn MAX';
                if (descEl) descEl.textContent = `Spawning ${formatNumber(START_UPGRADE_VALUES[lvl])}s`;
            } else {
                btn.textContent = `${START_UPGRADE_COSTS[lvl]} 🪙`; btn.disabled = false;
                if (nameEl) nameEl.textContent = `⬆️ Spawn Tier ${lvl + 1}/${maxLvl}`;
                if (descEl) descEl.textContent = `${formatNumber(START_UPGRADE_VALUES[lvl])} → ${formatNumber(START_UPGRADE_VALUES[lvl + 1])} per spawn`;
            }
        } else if (item === 'bigchance') {
            btn.textContent = upgrades.bigchance ? '✅ Owned' : '8 🪙';
            btn.disabled = upgrades.bigchance;
        } else if (item === 'bomb') {
            btn.disabled = false;
        }
    });
}

document.querySelectorAll('.shop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.dataset.item;

        if (item === 'start4') {
            const lvl = upgrades.startLevel;
            if (lvl >= START_UPGRADE_COSTS.length) return;
            const cost = START_UPGRADE_COSTS[lvl];
            if (coins < cost) { showFloat(`Need ${cost} 🪙!`, '#e94560'); return; }
            coins -= cost;
            upgrades.startLevel++;
            const newMin = START_UPGRADE_VALUES[upgrades.startLevel];
            for (let r = 0; r < GRID_SIZE; r++)
                for (let c = 0; c < GRID_SIZE; c++)
                    if (board[r][c] > 0 && board[r][c] < newMin)
                        board[r][c] = newMin;
            sessionShopBuys++;
            taskProgress('shop');
            addXP(0); // no XP for shop directly; handled separately
            localStorage.setItem(`u2048_shop_total_${nickname}`,
                String((parseInt(localStorage.getItem(`u2048_shop_total_${nickname}`)) || 0) + 1));
            saveAll(); renderShop(); render();
            showFloat(`Now spawning ${formatNumber(newMin)}s! 🎉`, '#4ecca3');

        } else if (item === 'bigchance') {
            const cost = parseInt(btn.dataset.cost);
            if (upgrades.bigchance || coins < cost) { if (coins < cost) showFloat(`Need ${cost} 🪙!`, '#e94560'); return; }
            coins -= cost; upgrades.bigchance = true;
            sessionShopBuys++;
            taskProgress('shop');
            localStorage.setItem(`u2048_shop_total_${nickname}`,
                String((parseInt(localStorage.getItem(`u2048_shop_total_${nickname}`)) || 0) + 1));
            saveAll(); renderShop();
            showFloat('Big Spawn unlocked! 🎲', '#4ecca3');

        } else if (item === 'bomb') {
            const cost = parseInt(btn.dataset.cost);
            if (coins < cost) { showFloat(`Need ${cost} 🪙!`, '#e94560'); return; }
            bombs++; coins -= cost;
            sessionShopBuys++;
            taskProgress('shop');
            localStorage.setItem(`u2048_shop_total_${nickname}`,
                String((parseInt(localStorage.getItem(`u2048_shop_total_${nickname}`)) || 0) + 1));
            saveAll();
        }
    });
});

// ════════════════════════════════════════════════════════
// BOMB
// ════════════════════════════════════════════════════════

bombBtn.addEventListener('click', () => {
    if (bombs <= 0) return;
    bombMode = !bombMode;
    bombBtn.classList.toggle('active', bombMode);
    render();
});

// ════════════════════════════════════════════════════════
// GAME CORE
// ════════════════════════════════════════════════════════

function init() {
    board      = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    score      = 0;
    comboCount = 0;
    undoStack  = [];
    scoreEl.textContent = '0';
    messageEl.classList.add('hidden');
    milestoneOverlay.classList.add('hidden');
    bombMode = false;
    bombBtn.classList.remove('active');
    celebratedMilestones = new Set();
    updateUndoBtn();

    // Session counters reset
    sessionMerges = sessionShopBuys = sessionBombs = sessionNewTile = sessionCombo3 = sessionCombo5 = 0;

    // Games counter
    const gc = parseInt(localStorage.getItem(`u2048_games_${nickname}`)) || 0;
    localStorage.setItem(`u2048_games_${nickname}`, String(gc + 1));

    addRandomTile();
    addRandomTile();
    render();
    checkPrestigeAvailable();
}

function getSpawnValue() {
    const base = START_UPGRADE_VALUES[upgrades.startLevel] || 2;
    if (upgrades.bigchance) {
        const r = Math.random();
        if (r < 0.10) return base * 8;
        if (r < 0.25) return base * 4;
        if (r < 0.50) return base * 2;
    } else {
        if (Math.random() < 0.10) return base * 2;
    }
    return base;
}

function addRandomTile() {
    const empty = [];
    for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
            if (board[r][c] === 0) empty.push([r, c]);
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    board[r][c]  = getSpawnValue();
    return [r, c];
}

// ── Portal Random Tile ─────────────────────────────────
function getRandomTileCount() {
    return parseInt(localStorage.getItem(`u2048_random_tiles_${nickname}`) || '0');
}

function updateRandomTileBtn() {
    let btn = document.getElementById('random-tile-btn');
    const count = getRandomTileCount();
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'random-tile-btn';
        btn.className = 'action-btn';
        btn.addEventListener('click', useRandomTile);
        const actionBar = document.getElementById('action-bar');
        if (actionBar) actionBar.appendChild(btn);
    }
    btn.textContent = `🎲 Tile ${count > 0 ? `(${count})` : ''}`;
    btn.disabled    = count === 0;
    btn.classList.toggle('disabled', count === 0);
    btn.style.display = 'inline-flex';
}

function useRandomTile() {
    let count = getRandomTileCount();
    if (count <= 0) return;

    const empty = [];
    for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
            if (board[r][c] === 0) empty.push([r, c]);
    if (!empty.length) { showFloat('Board full!', '#ef4444'); return; }

    const base = START_UPGRADE_VALUES[upgrades.startLevel] || 2;
    // Random multiplier: 1× to 8× the base, powers of 2
    const mults = [1, 2, 4, 8];
    const mult  = mults[Math.floor(Math.random() * mults.length)];
    const val   = base * mult;

    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    board[r][c]  = val;

    count--;
    localStorage.setItem(`u2048_random_tiles_${nickname}`, String(count));
    updateRandomTileBtn();

    showFloat(`🎲 ${val} spawned!`, '#a855f7');
    render();
    saveAll();
}

function render() {
    tileContainer.innerHTML = '';
    const CELL = getCellSize();
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const val = board[r][c];
            if (!val) continue;
            const { bg, color } = getTileColor(val);
            const tile = document.createElement('div');
            tile.className   = 'tile';
            tile.textContent = formatNumber(val);
            tile.dataset.r   = r;
            tile.dataset.c   = c;
            tile.style.cssText = `
                left:${c * (CELL + GAP)}px; top:${r * (CELL + GAP)}px;
                width:${CELL}px; height:${CELL}px;
                background:${bg}; color:${color}; font-size:${getFontSize(val)};
            `;
            if (bombMode) tile.classList.add('bomb-target');

            tile.addEventListener('click', () => {
                if (!bombMode || bombs <= 0) return;
                board[+tile.dataset.r][+tile.dataset.c] = 0;
                bombs--;
                bombMode = false;
                bombBtn.classList.remove('active');
                taskProgress('bomb');
                saveAll();
                render();
            });

            tileContainer.appendChild(tile);
        }
    }
}

// ════════════════════════════════════════════════════════
// FLOAT POPUPS
// ════════════════════════════════════════════════════════

function showFloat(text, color = '#d4a017') {
    const el = document.createElement('div');
    el.className  = 'coin-pop';
    el.textContent = text;
    el.style.cssText = `color:${color};position:fixed;top:26px;left:50%;transform:translateX(-50%);z-index:9999;font-size:15px;font-weight:bold;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

function showCoinPop(r, c, text, color) {
    const CELL = getCellSize();
    const el   = document.createElement('div');
    el.className   = 'coin-pop';
    el.textContent = text;
    el.style.color = color;
    el.style.left  = `${c * (CELL + GAP) + CELL / 2 - 24}px`;
    el.style.top   = `${r * (CELL + GAP)}px`;
    tileContainer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// ════════════════════════════════════════════════════════
// MILESTONE ANIMATION
// ════════════════════════════════════════════════════════

function triggerMilestone(val) {
    const key = val >= 16384 ? 16384 : val;
    const cfg = MILESTONES[key];
    if (!cfg || celebratedMilestones.has(val)) return;
    celebratedMilestones.add(val);

    milestoneIcon.textContent  = cfg.icon;
    milestoneLabel.textContent = cfg.label;
    milestoneLabel.style.color = cfg.color;
    milestoneOverlay.style.background = cfg.bg;

    // Particles — random directions
    milestoneParticles.innerHTML = '';
    for (let i = 0; i < cfg.count; i++) {
        const p     = document.createElement('div');
        p.className = 'ms-particle';
        const angle = Math.random() * Math.PI * 2;
        const dist  = 40 + Math.random() * 80;
        p.style.cssText = `
            left:${Math.random() * 100}%;
            top:${Math.random() * 100}%;
            background:${cfg.color};
            animation-delay:${(Math.random() * 0.4).toFixed(2)}s;
            animation-duration:${(0.7 + Math.random() * 0.8).toFixed(2)}s;
        `;
        p.style.setProperty('--tx', `${(Math.cos(angle) * dist).toFixed(0)}px`);
        p.style.setProperty('--ty', `${(Math.sin(angle) * dist).toFixed(0)}px`);
        milestoneParticles.appendChild(p);
    }

    milestoneOverlay.classList.remove('hidden');
    milestoneOverlay.classList.add('show');
    setTimeout(() => {
        milestoneOverlay.classList.remove('show');
        milestoneOverlay.classList.add('hidden');
        milestoneParticles.innerHTML = '';
    }, 2400);
}

// ════════════════════════════════════════════════════════
// SLIDE & MOVE
// ════════════════════════════════════════════════════════

let pendingMilestones = [];
let gotNewTileThisMove  = false;
let gotComboThisMove    = false;

function slideRow(row) {
    let arr = row.filter(v => v !== 0);
    let merged = false;

    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1] && !merged) {
            arr[i] *= 2;
            const val = arr[i];
            score += val;
            scoreEl.textContent = formatNumber(score);

            if (score > best) {
                best = score;
                bestEl.textContent = formatNumber(best);
                localStorage.setItem(`u2048_best_${nickname}`, String(best));
            }

            // New tile unlock
            if (!unlockedTiles.includes(val)) {
                unlockedTiles.push(val);
                const earned = earnCoins(1);
                coins += earned;
                gotNewTileThisMove = true;
                sessionNewTile++;
                taskProgress('newtile');
                addXP(20);
                // Track max tile for portal
                const prevMax = parseInt(localStorage.getItem(`u2048_max_tile_${nickname}`)) || 0;
                if (val > prevMax) localStorage.setItem(`u2048_max_tile_${nickname}`, String(val));
                saveAll();
            }

            // Combo
            comboCount++;
            if (comboCount >= 3) {
                const earned = earnCoins(1);
                coins += earned;
                gotComboThisMove = true;
                if (comboCount === 3) { sessionCombo3++; taskProgress('combo3'); }
                if (comboCount >= 5) { sessionCombo5++; taskProgress('combo5'); }
                if (comboCount >= 5) { comboCount = 0; }
                addXP(10);
                saveAll();
            }

            // Milestone check
            if (val >= 2048) pendingMilestones.push(val);

            // Per-merge XP
            addXP(5);

            sessionMerges++;
            taskProgress('merge');

            arr.splice(i + 1, 1);
            merged = true;
        } else {
            merged = false;
        }
    }

    while (arr.length < GRID_SIZE) arr.push(0);
    return arr;
}

function boardsEqual(a, b) {
    for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
            if (a[r][c] !== b[r][c]) return false;
    return true;
}

function pushUndo() {
    undoStack.push({ board: board.map(r => [...r]), score });
    if (undoStack.length > MAX_UNDOS) undoStack.shift();
    updateUndoBtn();
}

function undoMove() {
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    board = snap.board;
    score = snap.score;
    scoreEl.textContent = formatNumber(score);
    comboCount = 0;
    render();
    updateUndoBtn();
    showFloat('↩ Undo!', '#06b6d4');
}

function updateUndoBtn() {
    const btn = document.getElementById('undo-btn');
    if (btn) {
        btn.disabled = undoStack.length === 0;
        btn.classList.toggle('disabled', undoStack.length === 0);
        btn.textContent = `↩ UNDO (${undoStack.length})`;
    }
}

function move(dir) {
    if (bombMode) return;

    pushUndo();   // save state before move

    gotNewTileThisMove = false;
    gotComboThisMove   = false;
    pendingMilestones  = [];

    const old = board.map(r => [...r]);
    const nb  = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

    if (dir === 'left') {
        for (let r = 0; r < GRID_SIZE; r++) nb[r] = slideRow(board[r]);
    } else if (dir === 'right') {
        for (let r = 0; r < GRID_SIZE; r++) nb[r] = slideRow([...board[r]].reverse()).reverse();
    } else if (dir === 'up') {
        for (let c = 0; c < GRID_SIZE; c++) {
            const col  = board.map(r => r[c]);
            const slid = slideRow(col);
            for (let r = 0; r < GRID_SIZE; r++) nb[r][c] = slid[r];
        }
    } else if (dir === 'down') {
        for (let c = 0; c < GRID_SIZE; c++) {
            const col  = board.map(r => r[c]).reverse();
            const slid = slideRow(col).reverse();
            for (let r = 0; r < GRID_SIZE; r++) nb[r][c] = slid[r];
        }
    }

    if (boardsEqual(old, nb)) { comboCount = 0; undoStack.pop(); updateUndoBtn(); return; }

    board = nb;
    scoreTaskCheck();
    saveToLeaderboard();
    checkPrestigeAvailable();

    const spawned = addRandomTile();
    render();

    if (spawned) {
        const [sr, sc] = spawned;
        tileContainer.querySelectorAll('.tile').forEach(t => {
            if (+t.dataset.r === sr && +t.dataset.c === sc) t.classList.add('tile-new');
        });
        if (gotComboThisMove)    showCoinPop(sr, sc, `🔥 COMBO +${earnCoins(1)} 🪙`, '#f65e3b');
        else if (gotNewTileThisMove) showCoinPop(sr, sc, `+${earnCoins(1)} 🪙`, '#d4a017');
    }

    // Fire milestone animations (highest value first)
    if (pendingMilestones.length > 0) {
        const top = Math.max(...pendingMilestones);
        setTimeout(() => triggerMilestone(top), 150);
    }

    if (isGameOver()) setTimeout(() => showMessage('💀 Game Over!'), 200);
}

function isGameOver() {
    for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++) {
            if (!board[r][c]) return false;
            if (c < GRID_SIZE - 1 && board[r][c] === board[r][c + 1]) return false;
            if (r < GRID_SIZE - 1 && board[r][c] === board[r + 1][c]) return false;
        }
    return true;
}

function showMessage(text) {
    messageTextEl.textContent = text;
    messageEl.classList.remove('hidden');
}

// ════════════════════════════════════════════════════════
// INPUT
// ════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (!map[e.key]) return;
    e.preventDefault();
    move(map[e.key]);
});

let tx, ty;
document.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // ignore tiny taps
    e.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else                              move(dy > 0 ? 'down'  : 'up');
}, { passive: false });

newGameBtn.addEventListener('click',  init);
restartBtn.addEventListener('click',  init);
prestigeBtn.addEventListener('click', doPrestige);

// Undo button (if present in HTML)
const undoBtnEl = document.getElementById('undo-btn');
if (undoBtnEl) undoBtnEl.addEventListener('click', undoMove);

// Keyboard undo: Ctrl+Z
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoMove();
    }
});

(function () {
  'use strict';
  function openExitDialog() {
    document.getElementById('exit-confirm').classList.remove('hidden');
  }
  function closeExitDialog() {
    document.getElementById('exit-confirm').classList.add('hidden');
  }
  function confirmExit() {
    if (typeof saveAll === 'function') saveAll();
    window.location.href = '/';
  }
  document.getElementById('exit-portal-btn').addEventListener('click', openExitDialog);
  document.getElementById('exit-confirm-no').addEventListener('click', closeExitDialog);
  document.getElementById('exit-confirm-yes').addEventListener('click', confirmExit);
})();
