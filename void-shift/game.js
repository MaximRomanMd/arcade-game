const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const linesLeftEl = document.getElementById('lines-left');
const playerNameEl = document.getElementById('player-name');
const nicknameOverlay = document.getElementById('nickname-overlay');
const nicknameInput = document.getElementById('nickname-input');
const nicknameBtn = document.getElementById('nickname-btn');
const mainEl = document.getElementById('main');
const messageEl = document.getElementById('message');
const messageTextEl = document.getElementById('message-text');
const newGameBtn = document.getElementById('new-game-btn');
const restartBtn = document.getElementById('restart-btn');
const forceListEl = document.getElementById('force-list');
const clearForcesBtn = document.getElementById('clear-forces-btn');
const comboCountEl = document.getElementById('combo-count');
const spawnTimerEl = document.getElementById('spawn-timer');
const leaderboardList = document.getElementById('leaderboard-list');

const GRID = 8;
const CELL = 72;
const PAD  = 16;
canvas.width  = GRID * CELL + PAD * 2;
canvas.height = GRID * CELL + PAD * 2;

// 12 evolutie stages
const TYPES = [
    { id: 'SPARK',   color: '#fbbf24', glow: 'rgba(251,191,36,0.6)',  emoji: '✨', label: 'SPARK'   },
    { id: 'FLAME',   color: '#f97316', glow: 'rgba(249,115,22,0.6)',  emoji: '🔥', label: 'FLAME'   },
    { id: 'PLASMA',  color: '#ef4444', glow: 'rgba(239,68,68,0.6)',   emoji: '⚡', label: 'PLASMA'  },
    { id: 'WATER',   color: '#06b6d4', glow: 'rgba(6,182,212,0.6)',   emoji: '💧', label: 'WATER'   },
    { id: 'ICE',     color: '#bfdbfe', glow: 'rgba(191,219,254,0.6)', emoji: '❄️', label: 'ICE'     },
    { id: 'STORM',   color: '#818cf8', glow: 'rgba(129,140,248,0.6)', emoji: '🌀', label: 'STORM'   },
    { id: 'VOID',    color: '#a855f7', glow: 'rgba(168,85,247,0.6)',  emoji: '⚫', label: 'VOID'    },
    { id: 'LIFE',    color: '#84cc16', glow: 'rgba(132,204,22,0.6)',  emoji: '🌿', label: 'LIFE'    },
    { id: 'NATURE',  color: '#10b981', glow: 'rgba(16,185,129,0.6)',  emoji: '🌳', label: 'NATURE'  },
    { id: 'CRYSTAL', color: '#e879f9', glow: 'rgba(232,121,249,0.6)', emoji: '💎', label: 'CRYSTAL' },
    { id: 'DARK',    color: '#1e1b4b', glow: 'rgba(30,27,75,0.8)',    emoji: '🌑', label: 'DARK'    },
    { id: 'COSMOS',  color: '#fff',    glow: 'rgba(255,255,255,0.8)', emoji: '🌟', label: 'COSMOS'  },
];

// Spawn pool — primele 4 tipuri la inceput, cresc cu levelul
function getSpawnPool(level) {
    const max = Math.min(4 + Math.floor(level / 2), TYPES.length - 1);
    return TYPES.slice(0, max);
}

let grid, forces, selected, score, best, level, combo, nickname;
let spawnCountdown = 3;
let spawnInterval;
let particles = [];
let floatingTexts = [];
let animFrame;
let maxForces = 5;
const _mergingSet = new Set(); // prevent double-merge race conditions

// Nickname
const savedNick = localStorage.getItem('voidshift_nick');
if (savedNick) startGame(savedNick);
else nicknameOverlay.style.display = 'flex';

nicknameBtn.addEventListener('click', () => {
    const v = nicknameInput.value.trim();
    if (!v) return;
    localStorage.setItem('voidshift_nick', v);
    startGame(v);
});
nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nicknameBtn.click(); });

function startGame(name) {
    nickname = name;
    playerNameEl.textContent = name;
    nicknameOverlay.style.display = 'none';
    mainEl.classList.remove('hidden');
    best = parseInt(localStorage.getItem(`voidshift_best_${name}`)) || 0;
    bestEl.textContent = best;
    renderLeaderboard();
    init();
}

function getLeaderboard() {
    return JSON.parse(localStorage.getItem('voidshift_lb') || '[]');
}
function saveToLeaderboard() {
    let lb = getLeaderboard();
    const ex = lb.find(e => e.name === nickname);
    if (ex) { if (score > ex.score) ex.score = score; }
    else lb.push({ name: nickname, score });
    lb.sort((a, b) => b.score - a.score);
    localStorage.setItem('voidshift_lb', JSON.stringify(lb.slice(0, 10)));
    renderLeaderboard();
}
function renderLeaderboard() {
    const lb = getLeaderboard();
    leaderboardList.innerHTML = '';
    if (!lb.length) {
        leaderboardList.innerHTML = '<li style="color:#6366f1;text-align:center;font-size:11px;">No scores yet</li>';
        return;
    }
    lb.forEach((e, i) => {
        const li = document.createElement('li');
        if (e.name === nickname) li.classList.add('current-player');
        li.innerHTML = `<span class="lb-name">${i+1}. ${e.name}</span><span class="lb-score">${e.score}</span>`;
        leaderboardList.appendChild(li);
    });
}

function init() {
    grid         = Array.from({ length: GRID }, () => Array(GRID).fill(null));
    forces       = [];
    selected     = null;
    score        = 0;
    level        = 1;
    combo        = 0;
    particles    = [];
    floatingTexts = [];
    maxForces    = 5;
    _mergingSet.clear();

    scoreEl.textContent      = 0;
    levelEl.textContent      = 1;
    linesLeftEl.textContent  = maxForces;
    comboCountEl.textContent = 0;
    messageEl.classList.add('hidden');

    for (let i = 0; i < 8; i++) spawnCell();

    clearInterval(spawnInterval);
    spawnCountdown = 3;
    spawnTimerEl.textContent = spawnCountdown + 's';
    spawnInterval = setInterval(tickSpawn, 1000);

    cancelAnimationFrame(animFrame);
    renderForceList();
    loop();
}

function spawnCell() {
    const empty = [];
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (!grid[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const pool = getSpawnPool(level);
    const type = pool[Math.floor(Math.random() * pool.length)];
    grid[r][c] = { typeId: type.id, r, c, scale: 0, age: 0 };
}

function tickSpawn() {
    spawnCountdown--;
    spawnTimerEl.textContent = spawnCountdown + 's';
    if (spawnCountdown <= 0) {
        spawnCell();
        spawnCell();
        spawnCountdown = Math.max(1, 4 - Math.floor(level / 3));
        spawnTimerEl.textContent = spawnCountdown + 's';
        checkGameOver();
    }
}

function getType(id) {
    return TYPES.find(t => t.id === id);
}

function getNextType(id) {
    const idx = TYPES.findIndex(t => t.id === id);
    if (idx === -1 || idx >= TYPES.length - 1) return null;
    return TYPES[idx + 1];
}

function cellCenter(r, c) {
    return { x: PAD + c * CELL + CELL / 2, y: PAD + r * CELL + CELL / 2 };
}

function cellFromXY(x, y) {
    const c = Math.floor((x - PAD) / CELL);
    const r = Math.floor((y - PAD) / CELL);
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
    return [r, c];
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(99,102,241,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(PAD, PAD + i * CELL);
        ctx.lineTo(PAD + GRID * CELL, PAD + i * CELL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PAD + i * CELL, PAD);
        ctx.lineTo(PAD + i * CELL, PAD + GRID * CELL);
        ctx.stroke();
    }
}

function drawForces() {
    const t = (Date.now() / 500) % 1;
    forces.forEach(f => {
        if (!grid[f.r1]?.[f.c1] || !grid[f.r2]?.[f.c2]) return;
        const a = cellCenter(f.r1, f.c1);
        const b = cellCenter(f.r2, f.c2);
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 12;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -t * 14;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#6366f1';
        ctx.fillText('⚡', mx, my);
    });
}

function drawCells() {
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            const cell = grid[r][c];
            if (!cell) continue;
            const t = getType(cell.typeId);
            if (!t) continue;

            const { x, y } = cellCenter(r, c);
            cell.scale = Math.min(1, (cell.scale || 0) + 0.1);
            cell.age   = (cell.age || 0) + 1;

            const pulse  = 1 + 0.05 * Math.sin(cell.age * 0.08);
            const radius = (CELL / 2 - 6) * cell.scale * pulse;

            ctx.save();
            ctx.shadowColor = t.glow;
            ctx.shadowBlur  = 22;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = t.color;
            ctx.lineWidth   = 2.5;
            ctx.stroke();

            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0, t.color + 'bb');
            grad.addColorStop(1, t.color + '11');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();

            // Selected
            if (selected && selected[0] === r && selected[1] === c) {
                ctx.save();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth   = 3;
                ctx.shadowColor = '#fff';
                ctx.shadowBlur  = 20;
                ctx.beginPath();
                ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Can merge highlight
            if (selected) {
                const [sr, sc] = selected;
                const selCell = grid[sr][sc];
                if (selCell && selCell.typeId === cell.typeId && !(sr === r && sc === c)) {
                    ctx.save();
                    ctx.strokeStyle = t.color;
                    ctx.lineWidth   = 2;
                    ctx.shadowColor = t.color;
                    ctx.shadowBlur  = 15;
                    ctx.setLineDash([4, 4]);
                    ctx.lineDashOffset = -(Date.now() / 100) % 8;
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            ctx.font = `${Math.floor(radius * 0.7)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.emoji, x, y);

            // Type label
            ctx.font = '9px Courier New';
            ctx.fillStyle = t.color + 'aa';
            ctx.textAlign = 'center';
            ctx.fillText(t.label, x, y + radius - 8);
        }
    }
}

function drawParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.08;
        p.life -= 2;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / 100);
        ctx.fillStyle   = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function loop() {
    drawGrid();
    drawForces();
    drawCells();
    drawParticles();
    drawFloatingTexts();
    animFrame = requestAnimationFrame(loop);
}

function spawnParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color,
            size: 2 + Math.random() * 3,
            life: 60 + Math.random() * 40,
        });
    }
}

// Touch → click conversion for mobile
canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    canvas.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
}, { passive: false });

// CLICK — simplu si direct
canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const pos = cellFromXY(x, y);
    if (!pos) { selected = null; return; }
    const [r, c] = pos;

    if (!grid[r][c]) { selected = null; return; }

    if (!selected) {
        selected = [r, c];
        return;
    }

    const [sr, sc] = selected;

    // Same cell = deselect
    if (sr === r && sc === c) { selected = null; return; }

    const a = grid[sr][sc];
    const b = grid[r][c];

    if (!a || !b) { selected = null; return; }

    if (a.typeId === b.typeId) {
        // MERGE
        doMerge(sr, sc, r, c);
    } else {
        // FORCE LINE
        const existing = forces.findIndex(f =>
            (f.r1===sr && f.c1===sc && f.r2===r && f.c2===c) ||
            (f.r1===r  && f.c1===c  && f.r2===sr && f.c2===sc)
        );
        if (existing !== -1) {
            forces.splice(existing, 1);
        } else {
            if (forces.length >= maxForces) forces.shift();
            forces.push({ r1: sr, c1: sc, r2: r, c2: c });
        }
        renderForceList();
        updateLinesLeft();
        applyForceRepel(sr, sc, r, c);
    }

    selected = null;
});

function doMerge(r1, c1, r2, c2) {
    // ── Safety guards ──────────────────────────────────────────────
    if (!grid[r1]?.[c1] || !grid[r2]?.[c2]) return;
    if (grid[r1][c1].typeId !== grid[r2][c2].typeId) return;
    const key1 = r1 + ',' + c1, key2 = r2 + ',' + c2;
    if (_mergingSet.has(key1) || _mergingSet.has(key2)) return;
    _mergingSet.add(key1); _mergingSet.add(key2);
    // ──────────────────────────────────────────────────────────────

    const a    = grid[r1][c1];
    const next = getNextType(a.typeId);
    const { x, y } = cellCenter(r1, c1);
    const t    = getType(a.typeId);

    spawnParticles(x, y, t.color, 24);

    if (next) {
        grid[r1][c1] = { typeId: next.id, r: r1, c: c1, scale: 0, age: 0 };
        spawnParticles(x, y, next.color, 16);
        showFloatingScore(x, y, next.emoji + ' ' + next.label + '!', next.color);
    } else {
        // MAX level — COSMOS explozie
        grid[r1][c1] = null;
        spawnParticles(x, y, '#fff', 50);
        addScore(5000 * level);
        showFloatingScore(x, y, '🌟 COSMOS MAX!', '#fff');
    }

    grid[r2][c2] = null;

    combo++;
    comboCountEl.textContent = combo;

    const typeIdx = TYPES.findIndex(tp => tp.id === a.typeId);
    const pts = (typeIdx + 1) * 100 * level + (combo >= 3 ? combo * 50 * level : 0);
    addScore(pts);
    if (pts > 0) showFloatingScore(x, y - 30, '+' + pts, combo >= 3 ? '#fbbf24' : '#6366f1');

    // Clean up stale forces that pointed to the now-null cell
    forces = forces.filter(f => grid[f.r1]?.[f.c1] && grid[f.r2]?.[f.c2]);
    renderForceList();

    // Ricochet — chain merge propagates with delay
    setTimeout(() => {
        _mergingSet.delete(key1);
        _mergingSet.delete(key2);
        checkChainMerge(r1, c1);
    }, 80);
}

function checkChainMerge(r, c) {
    if (!grid[r][c]) return;
    const typeId = grid[r][c].typeId;
    const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
    for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        if (grid[nr][nc] && grid[nr][nc].typeId === typeId) {
            setTimeout(() => {
                if (grid[r]?.[c] && grid[nr]?.[nc] && grid[r][c].typeId === grid[nr][nc].typeId) {
                    doMerge(r, c, nr, nc);
                }
            }, 300);
            break;
        }
    }
}

function applyForceRepel(r1, c1, r2, c2) {
    // Muta r2,c2 in directia opusa fata de r1,c1
    const dr = Math.sign(r2 - r1) || (Math.random() < 0.5 ? 1 : -1);
    const dc = Math.sign(c2 - c1) || (Math.random() < 0.5 ? 1 : -1);

    const tries = [[dr, 0], [0, dc], [dr, dc], [-dr, 0], [0, -dc]];
    for (const [tr, tc] of tries) {
        const nr = r2 + tr;
        const nc = c2 + tc;
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        if (!grid[nr][nc]) {
            grid[nr][nc] = { ...grid[r2][c2], r: nr, c: nc };
            grid[r2][c2] = null;
            return;
        }
    }
}

function addScore(pts) {
    score += pts;
    scoreEl.textContent = score;
    if (score > best) {
        best = score;
        bestEl.textContent = best;
        localStorage.setItem(`voidshift_best_${nickname}`, best);
    }
    const newLevel = Math.floor(score / 1000) + 1;
    if (newLevel > level) {
        level     = newLevel;
        maxForces = 5 + Math.floor(level / 2);
        levelEl.textContent = level;
        updateLinesLeft();
        showLevelUp();
    }
    saveToLeaderboard();
}

function showLevelUp() {
    // Flash effect
    ctx.save();
    ctx.fillStyle = 'rgba(99,102,241,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    showFloatingScore(canvas.width / 2, canvas.height / 2, '⬆ LEVEL ' + level + '!', '#a855f7');
}

/* ── Floating score text ─────────────────────────────────────── */
function showFloatingScore(x, y, text, color) {
    floatingTexts.push({ x, y: y, vy: -1.2, text, color, life: 90, alpha: 1 });
}

function drawFloatingTexts() {
    floatingTexts = floatingTexts.filter(f => f.life > 0);
    floatingTexts.forEach(f => {
        f.y  += f.vy;
        f.life -= 1.5;
        f.alpha = Math.max(0, f.life / 90);
        ctx.save();
        ctx.globalAlpha  = f.alpha;
        ctx.font         = 'bold 14px Courier New';
        ctx.fillStyle    = f.color;
        ctx.shadowColor  = f.color;
        ctx.shadowBlur   = 10;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
    });
}

function updateLinesLeft() {
    linesLeftEl.textContent = Math.max(0, maxForces - forces.length);
}

function renderForceList() {
    forceListEl.innerHTML = '';
    forces = forces.filter(f => grid[f.r1]?.[f.c1] && grid[f.r2]?.[f.c2]);
    if (!forces.length) {
        forceListEl.innerHTML = '<div style="color:#6366f1;font-size:11px;text-align:center;">Click 2 different cells<br>to create a force</div>';
        return;
    }
    forces.forEach((f, i) => {
        const a = grid[f.r1]?.[f.c1];
        const b = grid[f.r2]?.[f.c2];
        const ta = a ? getType(a.typeId) : null;
        const tb = b ? getType(b.typeId) : null;
        const div = document.createElement('div');
        div.className = 'force-item';
        div.innerHTML = `
            <span>${ta?.emoji || '?'} ↔ ${tb?.emoji || '?'}</span>
            <span style="color:#e94560" data-idx="${i}">✕</span>
        `;
        div.querySelector('[data-idx]').addEventListener('click', ev => {
            ev.stopPropagation();
            forces.splice(i, 1);
            renderForceList();
            updateLinesLeft();
        });
        forceListEl.appendChild(div);
    });
    updateLinesLeft();
}

clearForcesBtn.addEventListener('click', () => {
    forces = [];
    renderForceList();
    updateLinesLeft();
});

function checkGameOver() {
    let empty = 0;
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (!grid[r][c]) empty++;
    if (empty === 0) {
        clearInterval(spawnInterval);
        cancelAnimationFrame(animFrame);
        saveToLeaderboard();
        messageTextEl.innerHTML = `⚡ VOID CONSUMED<br><span style="font-size:20px;letter-spacing:2px">Score: ${score}</span>`;
        messageEl.classList.remove('hidden');
    }
}

newGameBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

/* ── Evolution chain sidebar ─────────────────────────────────── */
function renderEvoChain() {
    const el = document.getElementById('evo-chain');
    if (!el) return;
    // Find highest type currently on the board
    let maxIdx = -1;
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (grid[r][c]) {
                const idx = TYPES.findIndex(t => t.id === grid[r][c].typeId);
                if (idx > maxIdx) maxIdx = idx;
            }
    el.innerHTML = TYPES.map((tp, i) => {
        const reached  = i <= maxIdx;
        const isCurrent = i === maxIdx;
        return `<div class="evo-step${reached ? ' evo-reached' : ''}${isCurrent ? ' evo-current' : ''}"
                     style="--evo-color:${tp.color}">
            <span class="evo-emoji">${tp.emoji}</span>
            <span class="evo-label">${tp.label}</span>
        </div>`;
    }).join('<div class="evo-arrow">▼</div>');
}

// Rebuild chain every 2 seconds
setInterval(renderEvoChain, 2000);

/* ── Help modal ──────────────────────────────────────────────── */
document.getElementById('help-btn').addEventListener('click', () => {
    const m = document.getElementById('help-modal');
    m.classList.remove('hidden');
    m.style.display = 'flex';
});
document.getElementById('help-close').addEventListener('click', () => {
    const m = document.getElementById('help-modal');
    m.classList.add('hidden');
    m.style.display = 'none';
});

(function () {
  'use strict';
  let _gamePaused = false;
  function openExitDialog() {
    const mainEl = document.getElementById('main');
    const msgEl  = document.getElementById('message');
    const isActive = mainEl && !mainEl.classList.contains('hidden') &&
                     msgEl  && msgEl.classList.contains('hidden');
    if (isActive && !_gamePaused) {
      _gamePaused = true;
      cancelAnimationFrame(animFrame);
      clearInterval(spawnInterval);
    }
    document.getElementById('exit-confirm').classList.remove('hidden');
  }
  function closeExitDialog() {
    document.getElementById('exit-confirm').classList.add('hidden');
    if (_gamePaused) {
      _gamePaused = false;
      spawnInterval = setInterval(tickSpawn, 1000);
      loop();
    }
  }
  function confirmExit() {
    const nick   = localStorage.getItem('voidshift_nick') || 'PLAYER';
    const stored = parseInt(localStorage.getItem('voidshift_best_' + nick) || '0', 10);
    if (score > stored) localStorage.setItem('voidshift_best_' + nick, String(score));
    window.location.href = '/';
  }
  document.getElementById('exit-portal-btn').addEventListener('click', openExitDialog);
  document.getElementById('exit-confirm-no').addEventListener('click', closeExitDialog);
  document.getElementById('exit-confirm-yes').addEventListener('click', confirmExit);
})();