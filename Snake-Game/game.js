'use strict';

// ════════════════════════════════════════════════════════
// CANVAS & CONSTANTS
// ════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const GRID   = 20;
const CELL   = canvas.width / GRID;

const SKINS = [
    {
        id: 'default', name: 'Classic', unlockScore: 0,
        previewCss: '#4ecca3',
        headFn: ()      => '#4ecca3',
        bodyFn: (i, n)  => `rgb(30,${Math.floor(200 - i / n * 80)},120)`,
    },
    {
        id: 'fire', name: 'Fire', unlockScore: 50,
        previewCss: 'linear-gradient(90deg,#ff4500,#ff8c00)',
        headFn: ()      => '#ff4500',
        bodyFn: (i, n)  => `rgb(${Math.floor(200 - i / n * 70)},${Math.floor(80 - i / n * 60)},0)`,
    },
    {
        id: 'ice', name: 'Ice', unlockScore: 100,
        previewCss: 'linear-gradient(90deg,#00cfff,#1e90ff)',
        headFn: ()      => '#00cfff',
        bodyFn: (i, n)  => `rgb(0,${Math.floor(160 - i / n * 80)},${Math.floor(220 - i / n * 60)})`,
    },
    {
        id: 'galaxy', name: 'Galaxy', unlockScore: 200,
        previewCss: 'linear-gradient(90deg,#a855f7,#6366f1)',
        headFn: ()      => '#a855f7',
        bodyFn: (i, n)  => `hsl(${260 + i * 2},70%,${Math.floor(55 - i / n * 20)}%)`,
    },
    {
        id: 'rainbow', name: 'Rainbow', unlockScore: 500,
        previewCss: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)',
        headFn: ()      => `hsl(${(Date.now() / 15) % 360},85%,58%)`,
        bodyFn: (i, n)  => `hsl(${(Date.now() / 15 + i * 18) % 360},85%,55%)`,
    },
];

const POWERUP_DEFS = [
    { id: 'speed',  emoji: '⚡', color: '#fbbf24', label: 'SPEED',  duration: 5000 },
    { id: 'ghost',  emoji: '👻', color: '#c084fc', label: 'GHOST',  duration: 5000 },
    { id: 'magnet', emoji: '🧲', color: '#06b6d4', label: 'MAGNET', duration: 5000 },
];

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════

let snake, direction, nextDirection, food, score;
let highScore    = 0;
let taHighScore  = 0;
let gameLoop     = null;
let idleFrame    = null;
let timerInterval= null;
let puSpawnTimer = null;
let running      = false;
let revives      = 0;
let gameMode     = 'classic';   // 'classic' | 'time'
let timeLeft     = 60;
let obstacles    = [];
let mapPowerups  = [];          // [{...def, x, y}] on the board
let activePU     = {};          // {id: expireTimestamp}
let currentSkin  = 'default';
let unlockedSkins= ['default'];

// ════════════════════════════════════════════════════════
// LOAD / SAVE
// ════════════════════════════════════════════════════════

function loadData() {
    highScore    = parseInt(localStorage.getItem('snakeHighScore')) || 0;
    taHighScore  = parseInt(localStorage.getItem('snake_timeattack_best')) || 0;
    unlockedSkins= JSON.parse(localStorage.getItem('snake_unlocked_skins') || '["default"]');
    currentSkin  = localStorage.getItem('snake_skin') || 'default';

    // Unlock skins based on saved high score
    SKINS.forEach(s => {
        if (highScore >= s.unlockScore && !unlockedSkins.includes(s.id)) {
            unlockedSkins.push(s.id);
        }
    });
    localStorage.setItem('snake_unlocked_skins', JSON.stringify(unlockedSkins));

    revives = parseInt(localStorage.getItem('snake_revives') || '0');
    updateReviveHUD();

    const nick = localStorage.getItem('portal_nickname') || 'Player';
    document.getElementById('player-name').textContent = nick;
    document.title = `Snake — ${nick}`;

    document.getElementById('highscore').textContent = highScore;
    document.getElementById('ta-best').textContent   = taHighScore;
}

function saveScore() {
    const nick = localStorage.getItem('portal_nickname') || 'Player';

    if (gameMode === 'classic') {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
            document.getElementById('highscore').textContent = highScore;
            checkSkinUnlocks();
        }
        let lb = JSON.parse(localStorage.getItem('snakeLeaderboard') || '[]');
        const ex = lb.find(e => e.name === nick);
        if (ex) { if (score > ex.score) ex.score = score; }
        else lb.push({ name: nick, score });
        lb.sort((a, b) => b.score - a.score);
        localStorage.setItem('snakeLeaderboard', JSON.stringify(lb.slice(0, 10)));

    } else if (gameMode === 'maze') {
        mazeBestScore = parseInt(localStorage.getItem('snake_maze_best') || '0');
        if (score > mazeBestScore) {
            mazeBestScore = score;
            localStorage.setItem('snake_maze_best', mazeBestScore);
        }
    } else {
        if (score > taHighScore) {
            taHighScore = score;
            localStorage.setItem('snake_timeattack_best', taHighScore);
            document.getElementById('ta-best').textContent = taHighScore;
        }
    }

    const games = parseInt(localStorage.getItem('snakeGames') || '0') + 1;
    localStorage.setItem('snakeGames', games);
}

// ════════════════════════════════════════════════════════
// SKIN SYSTEM
// ════════════════════════════════════════════════════════

function renderSkinGrid() {
    const grid = document.getElementById('skin-grid');
    grid.innerHTML = '';

    SKINS.forEach(skin => {
        const unlocked = unlockedSkins.includes(skin.id);
        const btn = document.createElement('div');
        btn.className = `skin-btn${unlocked ? '' : ' locked'}${currentSkin === skin.id ? ' selected' : ''}`;
        btn.innerHTML = `
            <div class="skin-preview" style="background:${skin.previewCss}"></div>
            <span class="skin-name">${skin.name}</span>
            ${!unlocked ? `<span class="skin-lock">🔒 ${skin.unlockScore}</span>` : ''}
        `;
        if (unlocked) {
            btn.addEventListener('click', () => {
                currentSkin = skin.id;
                localStorage.setItem('snake_skin', skin.id);
                renderSkinGrid();
            });
        }
        grid.appendChild(btn);
    });
}

function checkSkinUnlocks() {
    let changed = false;
    SKINS.forEach(s => {
        if (highScore >= s.unlockScore && !unlockedSkins.includes(s.id)) {
            unlockedSkins.push(s.id);
            changed = true;
            flashMessage(`🎨 Skin unlocked: ${s.name}!`);
        }
    });
    if (changed) {
        localStorage.setItem('snake_unlocked_skins', JSON.stringify(unlockedSkins));
        renderSkinGrid();
    }
}

function getSegColor(idx) {
    const skin = SKINS.find(s => s.id === currentSkin) || SKINS[0];
    return idx === 0 ? skin.headFn() : skin.bodyFn(idx, snake.length);
}

// ════════════════════════════════════════════════════════
// MODE SYSTEM
// ════════════════════════════════════════════════════════

function setMode(mode) {
    gameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active-mode', b.dataset.mode === mode);
    });
    const isTA   = mode === 'time';
    const isMaze = mode === 'maze';
    document.getElementById('timer-box').style.display    = isTA ? 'flex' : 'none';
    document.getElementById('ta-best-box').style.display  = isTA ? 'flex' : 'none';
    document.getElementById('highscore-box').style.display= isTA ? 'none' : 'flex';

    let msg = 'Press any arrow key to start!';
    if (isTA)   msg = 'Press arrow key — 60 seconds, eat as much as you can!';
    if (isMaze) msg = '🧩 Navigate the maze walls! Maze changes every 15 points.';
    document.getElementById('pre-message').textContent = msg;
    if (isMaze) initGame();  // preview maze immediately
}

// ════════════════════════════════════════════════════════
// INIT GAME STATE
// ════════════════════════════════════════════════════════

function initGame() {
    snake         = [{ x: 10, y: 10 }];
    direction     = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score         = 0;
    obstacles     = [];
    mapPowerups   = [];
    activePU      = {};

    document.getElementById('score').textContent = '0';
    document.getElementById('message').textContent = '';
    document.getElementById('powerup-bar').innerHTML = '';

    if (gameMode === 'time') {
        timeLeft = 60;
        updateTimerUI();
    }

    if (gameMode === 'maze') {
        loadMaze(currentMazeIdx);
    }

    spawnFood();
    draw();
}

// ════════════════════════════════════════════════════════
// FOOD
// ════════════════════════════════════════════════════════

function spawnFood() {
    let pos, tries = 0;
    do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        tries++;
        if (tries > 300) break;
    } while (
        snake.some(s => s.x === pos.x && s.y === pos.y) ||
        obstacles.some(o => o.x === pos.x && o.y === pos.y) ||
        mapPowerups.some(p => p.x === pos.x && p.y === pos.y)
    );
    food = pos;
}

// ════════════════════════════════════════════════════════
// MAZE LAYOUTS
// ════════════════════════════════════════════════════════

// Each layout is an array of [x, y] cell coordinates for walls
// Grid is 20×20
const MAZE_LAYOUTS = [
    // Layout 0: Cross
    [
        ...Array.from({length:8}, (_,i) => [10, 2+i]),   // vertical bar
        ...Array.from({length:8}, (_,i) => [2+i, 10]),   // horizontal bar
        ...Array.from({length:8}, (_,i) => [10, 11+i]),  // vertical bar 2
        ...Array.from({length:8}, (_,i) => [11+i, 10]),  // horizontal bar 2
    ],
    // Layout 1: Four rooms
    [
        ...Array.from({length:18}, (_,i) => [1+i, 9]),   // center H wall
        ...Array.from({length:18}, (_,i) => [10, 1+i]),  // center V wall
        // Doorways — remove pairs to create openings
    ].filter(([x,y]) => !(x===10&&y===5) && !(x===10&&y===14) && !(x===4&&y===9) && !(x===15&&y===9)),
    // Layout 2: Spiral
    [
        ...Array.from({length:16}, (_,i) => [2+i, 3]),
        ...Array.from({length:14}, (_,i) => [17, 4+i]),
        ...Array.from({length:14}, (_,i) => [3+i, 16]),
        ...Array.from({length:10}, (_,i) => [3, 7+i]),
        ...Array.from({length:10}, (_,i) => [5+i, 6]),
        ...Array.from({length:8}, (_,i) => [14, 7+i]),
        ...Array.from({length:6}, (_,i) => [7+i, 14]),
        ...Array.from({length:4}, (_,i) => [6, 10+i]),
    ].filter(([x,y]) => !(x===2&&y===3) && !(x===17&&y===17) && !(x===3&&y===6) && !(x===14&&y===7) && !(x===13&&y===14)),
    // Layout 3: Diagonal zigzag
    [
        [3,1],[3,2],[3,3],[3,4],[3,5],
        [7,4],[7,5],[7,6],[7,7],[7,8],
        [11,7],[11,8],[11,9],[11,10],[11,11],
        [15,10],[15,11],[15,12],[15,13],[15,14],
        [3,14],[3,15],[3,16],[3,17],[3,18],
        [7,13],[7,14],[7,15],[7,16],[7,17],
    ],
];

let mazeBestScore  = parseInt(localStorage.getItem('snake_maze_best') || '0');
let currentMazeIdx = 0;

function loadMaze(idx) {
    const layout = MAZE_LAYOUTS[idx % MAZE_LAYOUTS.length];
    // Filter out positions that would overlap the starting snake position
    obstacles = layout
        .map(([x, y]) => ({ x, y }))
        .filter(o => !(o.x >= 8 && o.x <= 12 && o.y >= 8 && o.y <= 12));
}

// ════════════════════════════════════════════════════════
// OBSTACLES
// ════════════════════════════════════════════════════════

function syncObstacles() {
    if (gameMode === 'maze') return;  // maze obstacles are static
    if (score < 10) return;
    const target = Math.min(1 + Math.floor((score - 10) / 5), 20);
    while (obstacles.length < target) addObstacle();
}

function addObstacle() {
    let pos, tries = 0;
    do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        tries++;
        if (tries > 200) return;
    } while (
        snake.some(s => s.x === pos.x && s.y === pos.y) ||
        (food && food.x === pos.x && food.y === pos.y) ||
        obstacles.some(o => o.x === pos.x && o.y === pos.y) ||
        mapPowerups.some(p => p.x === pos.x && p.y === pos.y)
    );
    obstacles.push(pos);
}

// ════════════════════════════════════════════════════════
// POWER-UPS
// ════════════════════════════════════════════════════════

function trySpawnPowerup() {
    if (!running) return;
    const def = POWERUP_DEFS[Math.floor(Math.random() * POWERUP_DEFS.length)];
    let pos, tries = 0;
    do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        tries++;
        if (tries > 200) return;
    } while (
        snake.some(s => s.x === pos.x && s.y === pos.y) ||
        (food && food.x === pos.x && food.y === pos.y) ||
        obstacles.some(o => o.x === pos.x && o.y === pos.y) ||
        mapPowerups.some(p => p.x === pos.x && p.y === pos.y)
    );
    mapPowerups.push({ ...def, x: pos.x, y: pos.y });

    // Auto-despawn after 8 seconds
    setTimeout(() => {
        mapPowerups = mapPowerups.filter(p => !(p.x === pos.x && p.y === pos.y));
    }, 8000);
}

function pickupPowerup(def) {
    activePU[def.id] = Date.now() + def.duration;

    // Portal achievement flags
    if (def.id === 'speed')  localStorage.setItem('snake_powerup_speed_used',  '1');
    if (def.id === 'ghost')  localStorage.setItem('snake_powerup_ghost_used',   '1');
    if (def.id === 'magnet') localStorage.setItem('snake_powerup_magnet_used',  '1');

    renderPowerupBar();

    // Speed: override loop speed
    if (def.id === 'speed') {
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, 65);
        setTimeout(() => {
            if (running) {
                clearInterval(gameLoop);
                gameLoop = setInterval(tick, 130);
            }
        }, def.duration);
    }

    // Schedule cleanup
    setTimeout(() => {
        delete activePU[def.id];
        renderPowerupBar();
    }, def.duration);
}

function isActive(id) {
    return activePU[id] && Date.now() < activePU[id];
}

function renderPowerupBar() {
    const bar = document.getElementById('powerup-bar');
    bar.innerHTML = '';
    POWERUP_DEFS.forEach(def => {
        if (!isActive(def.id)) return;
        const ms  = Math.max(0, activePU[def.id] - Date.now());
        const sec = (ms / 1000).toFixed(1);
        const el  = document.createElement('div');
        el.className = 'powerup-active';
        el.style.borderColor = def.color;
        el.innerHTML = `<span>${def.emoji}</span><span class="pu-label">${def.label}</span><span class="pu-timer" style="color:${def.color}">${sec}s</span>`;
        bar.appendChild(el);
    });
}

// ════════════════════════════════════════════════════════
// TIMER (Time Attack)
// ════════════════════════════════════════════════════════

function updateTimerUI() {
    const el = document.getElementById('timer');
    el.textContent = timeLeft;
    el.classList.toggle('urgent', timeLeft <= 10);
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    updateTimerUI();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

// ════════════════════════════════════════════════════════
// UPDATE (game tick)
// ════════════════════════════════════════════════════════

function tick() {
    direction = nextDirection;

    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y,
    };

    // Wall collision
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        endGame(); return;
    }

    // Self collision (bypassed in ghost mode)
    if (!isActive('ghost') && snake.slice(1).some(s => s.x === head.x && s.y === head.y)) {
        endGame(); return;
    }

    // Obstacle collision
    if (obstacles.some(o => o.x === head.x && o.y === head.y)) {
        endGame(); return;
    }

    // Magnet: nudge food toward head before moving
    if (isActive('magnet') && food) {
        const dx = head.x - food.x;
        const dy = head.y - food.y;
        if (dx !== 0 || dy !== 0) {
            if (Math.abs(dx) >= Math.abs(dy)) food.x += Math.sign(dx);
            else                               food.y += Math.sign(dy);
            food.x = Math.max(0, Math.min(GRID - 1, food.x));
            food.y = Math.max(0, Math.min(GRID - 1, food.y));
        }
    }

    snake.unshift(head);

    // Power-up pickup
    const puIdx = mapPowerups.findIndex(p => p.x === head.x && p.y === head.y);
    if (puIdx >= 0) {
        const pu = mapPowerups.splice(puIdx, 1)[0];
        pickupPowerup(pu);
    }

    // Food pickup
    if (head.x === food.x && head.y === food.y) {
        score++;
        document.getElementById('score').textContent = score;
        spawnFood();
        // In maze mode, advance to next maze every 15 points
        if (gameMode === 'maze' && score % 15 === 0) {
            currentMazeIdx++;
            loadMaze(currentMazeIdx);
            flashMessage(`🧩 New maze! (${currentMazeIdx % MAZE_LAYOUTS.length + 1}/${MAZE_LAYOUTS.length})`);
        }
        syncObstacles();
    } else {
        snake.pop();
    }

    renderPowerupBar();
    draw();
}

// ════════════════════════════════════════════════════════
// DRAW
// ════════════════════════════════════════════════════════

function drawRoundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

function draw() {
    const now = Date.now();

    // Background
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0);          ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,        i * CELL);   ctx.lineTo(canvas.width, i * CELL);  ctx.stroke();
    }

    // Obstacles / Maze walls
    const isMazeMode = gameMode === 'maze';
    const wallColor  = isMazeMode ? '#2d4a7a' : '#4a4a6a';
    const wallGlow   = isMazeMode ? '#3b82f6' : '#333355';
    obstacles.forEach(o => {
        ctx.shadowColor = wallGlow;
        ctx.shadowBlur  = isMazeMode ? 8 : 6;
        drawRoundedRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2, 2, wallColor);
        if (isMazeMode) {
            // Draw a bright border for maze walls
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1;
            ctx.strokeRect(o.x * CELL + 1.5, o.y * CELL + 1.5, CELL - 3, CELL - 3);
        }
        ctx.shadowBlur = 0;
    });

    // Food (pulsating)
    if (food) {
        const pulse  = 0.78 + 0.22 * Math.sin(now / 180);
        const fr     = (CELL / 2 - 3) * pulse;
        const isMag  = isActive('magnet');
        const fc     = isMag ? '#06b6d4' : '#e94560';
        ctx.fillStyle   = fc;
        ctx.shadowColor = fc;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, fr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Map power-ups
    mapPowerups.forEach(pu => {
        const cx = pu.x * CELL + CELL / 2;
        const cy = pu.y * CELL + CELL / 2;
        const pulse = 0.7 + 0.3 * Math.sin(now / 250);
        ctx.fillStyle   = pu.color + '28';
        ctx.shadowColor = pu.color;
        ctx.shadowBlur  = 14 * pulse;
        ctx.beginPath();
        ctx.arc(cx, cy, (CELL / 2 - 1) * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = `${Math.floor(CELL * 0.72)}px Arial`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.emoji, cx, cy);
    });

    // Snake
    const ghostActive = isActive('ghost');
    ctx.globalAlpha = ghostActive ? 0.42 : 1;

    snake.forEach((seg, idx) => {
        const color = getSegColor(idx);
        const pad   = idx === 0 ? 1 : 2;
        ctx.shadowColor = idx === 0 ? color : 'transparent';
        ctx.shadowBlur  = idx === 0 ? 8 : 0;
        drawRoundedRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4, color);
        ctx.shadowBlur = 0;

        // Eyes
        if (idx === 0) {
            ctx.fillStyle = ghostActive ? 'rgba(22,33,62,0.5)' : '#16213e';
            const ex  = direction.x === 1 ? 0.7 : direction.x === -1 ? 0.2 : 0.3;
            const ex2 = direction.x === 1 ? 0.7 : direction.x === -1 ? 0.2 : 0.7;
            const ey  = direction.y === 1 ? 0.7 : direction.y === -1 ? 0.2 : 0.3;
            const ey2 = direction.y === 1 ? 0.7 : direction.y === -1 ? 0.2 : 0.7;
            ctx.beginPath();
            ctx.arc(seg.x * CELL + CELL * ex,  seg.y * CELL + CELL * ey,  2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.arc(seg.x * CELL + CELL * ex2, seg.y * CELL + CELL * ey2, 2, 0, Math.PI * 2); ctx.fill();
        }
    });

    ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════
// GAME OVER / END
// ════════════════════════════════════════════════════════

function endGame() {
    clearInterval(gameLoop);
    clearInterval(timerInterval);
    clearInterval(puSpawnTimer);
    gameLoop    = null;
    timerInterval = null;
    puSpawnTimer  = null;
    running = false;

    // Check revive (only classic mode, not time attack)
    revives = parseInt(localStorage.getItem('snake_revives') || '0');
    if (revives > 0 && gameMode === 'classic') {
        showRevivePopup();
        return;
    }

    saveScore();

    // Death flash
    let flashes = 0;
    const fi = setInterval(() => {
        ctx.fillStyle = `rgba(233,69,96,${flashes % 2 === 0 ? 0.35 : 0})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (++flashes >= 6) {
            clearInterval(fi);
            draw();
            if (gameMode === 'time') {
                document.getElementById('message').textContent =
                    `⏱ Time's up! Score: ${score}  |  TA Best: ${taHighScore}`;
            } else {
                document.getElementById('message').textContent =
                    `💀 Game over! Score: ${score} — Press arrow to restart`;
            }
        }
    }, 100);

    // Re-show pre-panel
    setTimeout(() => {
        document.getElementById('pre-panel').style.display = 'flex';
        renderSkinGrid();
        document.getElementById('pre-message').textContent =
            gameMode === 'time' ? '▶ Press arrow key to play again!' : '▶ Press arrow to restart!';
        startIdleAnim();
    }, 700);
}

// ════════════════════════════════════════════════════════
// REVIVE SYSTEM
// ════════════════════════════════════════════════════════

function updateReviveHUD() {
    let el = document.getElementById('revive-hud');
    if (!el) {
        el = document.createElement('div');
        el.id = 'revive-hud';
        el.style.cssText = 'position:absolute;bottom:8px;right:8px;font-family:"Courier New",monospace;font-size:11px;color:#4ecca3;letter-spacing:1px;background:rgba(0,20,15,0.75);padding:4px 10px;border-radius:20px;border:1px solid rgba(78,204,163,0.3);pointer-events:none;';
        document.getElementById('game-container').appendChild(el);
    }
    revives = parseInt(localStorage.getItem('snake_revives') || '0');
    el.textContent  = revives > 0 ? `💀 Revives: ${revives}` : '';
    el.style.display = revives > 0 ? 'block' : 'none';
}

function showRevivePopup() {
    revives = parseInt(localStorage.getItem('snake_revives') || '0');
    document.getElementById('revive-count').textContent = revives;
    document.getElementById('revive-popup').classList.remove('hidden');
}

function doRevive() {
    document.getElementById('revive-popup').classList.add('hidden');
    revives = Math.max(0, revives - 1);
    localStorage.setItem('snake_revives', String(revives));
    updateReviveHUD();

    // Respawn snake in center at half score
    score = Math.floor(score / 2);
    const cx = Math.floor(GRID / 2);
    const cy = Math.floor(GRID / 2);
    snake         = [{ x: cx, y: cy }];
    direction     = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    activePU      = {};
    spawnFood();
    draw();

    running  = true;
    gameLoop = setInterval(tick, gameMode === 'time' ? 120 : 140);

    const msgEl = document.getElementById('message');
    msgEl.textContent = '💀 REVIVED!';
    setTimeout(() => { if (msgEl.textContent === '💀 REVIVED!') msgEl.textContent = ''; }, 1500);
}

function declineRevive() {
    document.getElementById('revive-popup').classList.add('hidden');
    saveScore();

    let flashes = 0;
    const fi = setInterval(() => {
        ctx.fillStyle = `rgba(233,69,96,${flashes % 2 === 0 ? 0.35 : 0})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (++flashes >= 6) {
            clearInterval(fi);
            draw();
            document.getElementById('message').textContent =
                `💀 Game over! Score: ${score} — Press arrow to restart`;
            setTimeout(() => {
                document.getElementById('pre-panel').style.display = 'flex';
                renderSkinGrid();
                document.getElementById('pre-message').textContent = '▶ Press arrow to restart!';
                startIdleAnim();
            }, 700);
        }
    }, 100);
}

// ════════════════════════════════════════════════════════
// IDLE ANIMATION
// ════════════════════════════════════════════════════════

function startIdleAnim() {
    stopIdleAnim();
    function loop() {
        if (!running) {
            draw();
            idleFrame = requestAnimationFrame(loop);
        }
    }
    idleFrame = requestAnimationFrame(loop);
}

function stopIdleAnim() {
    if (idleFrame) cancelAnimationFrame(idleFrame);
    idleFrame = null;
}

// ════════════════════════════════════════════════════════
// START RUNNING
// ════════════════════════════════════════════════════════

function startGame(initialDir) {
    stopIdleAnim();
    document.getElementById('pre-panel').style.display = 'none';
    document.getElementById('message').textContent = '';

    if (gameMode === 'maze') currentMazeIdx = 0;

    running = true;
    initGame();
    direction     = initialDir;
    nextDirection = initialDir;

    clearInterval(gameLoop);
    clearInterval(timerInterval);
    clearInterval(puSpawnTimer);

    gameLoop     = setInterval(tick, 130);
    puSpawnTimer = setInterval(trySpawnPowerup, 10000);

    if (gameMode === 'time') startTimer();
}

// ════════════════════════════════════════════════════════
// INPUT
// ════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
    const DIR_MAP = {
        ArrowUp:    { x: 0, y: -1 },
        ArrowDown:  { x: 0, y:  1 },
        ArrowLeft:  { x: -1, y: 0 },
        ArrowRight: { x:  1, y: 0 },
    };
    if (!DIR_MAP[e.key]) return;
    e.preventDefault();

    const newDir = DIR_MAP[e.key];
    if (newDir.x === -direction.x && newDir.y === -direction.y) return;
    nextDirection = newDir;

    if (!running) startGame(newDir);
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (running) return;
        setMode(btn.dataset.mode);
    });
});

// ── Touch / Swipe controls (mobile) ──────────────────────
(function() {
    let tx = 0, ty = 0;
    const canvas = document.getElementById('gameCanvas');
    const target = canvas || document;

    target.addEventListener('touchstart', e => {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
        e.preventDefault();
    }, { passive: false });

    target.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tx;
        const dy = e.changedTouches[0].clientY - ty;
        const MIN = 20;
        if (Math.abs(dx) < MIN && Math.abs(dy) < MIN) return;
        let newDir;
        if (Math.abs(dx) >= Math.abs(dy)) {
            newDir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        } else {
            newDir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
        }
        if (newDir.x === -direction.x && newDir.y === -direction.y) return;
        nextDirection = newDir;
        if (!running) startGame(newDir);
        e.preventDefault();
    }, { passive: false });
})();

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function flashMessage(text) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.style.color = '#fbbf24';
    setTimeout(() => {
        el.style.color = '#4ecca3';
        if (el.textContent === text) el.textContent = '';
    }, 2500);
}

// ════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════

loadData();
renderSkinGrid();
setMode('classic');
initGame();
startIdleAnim();

// Revive buttons
document.getElementById('revive-yes-btn').addEventListener('click', doRevive);
document.getElementById('revive-no-btn').addEventListener('click', declineRevive);

(function () {
  'use strict';
  let _wasRunning = false;
  function openExitDialog() {
    if (running) { _wasRunning = true; running = false; }
    document.getElementById('exit-confirm').classList.remove('hidden');
  }
  function closeExitDialog() {
    document.getElementById('exit-confirm').classList.add('hidden');
    if (_wasRunning) { _wasRunning = false; running = true; }
  }
  function confirmExit() {
    saveScore();
    window.location.href = '/';
  }
  document.getElementById('exit-portal-btn').addEventListener('click', openExitDialog);
  document.getElementById('exit-confirm-no').addEventListener('click', closeExitDialog);
  document.getElementById('exit-confirm-yes').addEventListener('click', confirmExit);
})();
