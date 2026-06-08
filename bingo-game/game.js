/* =============================================
   ARCADE BINGO - Complete Game Logic
   ============================================= */

'use strict';

// =============================================
// CONSTANTS
// =============================================

const BET_OPTIONS = [10, 25, 50, 100];
const POWER_COSTS = { peek: 15, daub: 20, swap: 25, rush: 30, lucky: 50 };
const POWER_MAX = 2;
const SPEEDS = {
  slow:   { label: '🐢 SLOW',   ms: 3000, desc: 'Relaxed — 3s per draw',        animDur: 500 },
  normal: { label: '⚡ NORMAL', ms: 1500, desc: 'Default — 1.5s per draw',       animDur: 500 },
  fast:   { label: '🔥 FAST',   ms: 800,  desc: 'Adrenaline — 0.8s per draw',   animDur: 300 },
  insane: { label: '💀 INSANE', ms: 300,  desc: 'Total chaos — 0.3s per draw',  animDur: 150 },
};
const IN_GAME_CYCLE = ['normal', 'fast', 'insane'];
const WIN_MULTIPLIERS = { line1: 1.5, line2: 3, line3: 4, line4: 6, fullhouse: 10 };
const COLUMN_RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'];

// =============================================
// STATE
// =============================================

let nickname, coins, bet, isFreePlay;
let card, markedCells, drawnNumbers, allNumbers;
let drawIntervalMs, drawTimer;
let selectedSpeed = 'normal';
let powerUsed = 0;
let luckyActive = false, luckyCount = 0;
let rushActive = false, rushCount = 0;
let completedLines = new Set();
let totalWinnings = 0;
let jackpot;
let gameActive = false;
let daubActive = false;
let peekActive = false;
let peekTimeout = null;
let jackpotWon = false;

// Extra card state
let card2 = null, markedCells2 = null, completedLines2 = null;
let useExtraCard = false;

// =============================================
// UTILITIES
// =============================================

function getLetterForNumber(n) {
  if (n >= 1  && n <= 15) return 'B';
  if (n >= 16 && n <= 30) return 'I';
  if (n >= 31 && n <= 45) return 'N';
  if (n >= 46 && n <= 60) return 'G';
  return 'O';
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomUnique(min, max, count) {
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  return shuffle(pool).slice(0, count);
}

function getCoins() {
  return parseInt(localStorage.getItem('u2048_coins_' + nickname) || '0', 10);
}

function setCoins(val) {
  localStorage.setItem('u2048_coins_' + nickname, String(val));
}

function updateCoinsDisplay() {
  const val = getCoins();
  coins = val;
  const el = document.getElementById('grc-value');
  el.textContent = val;
  el.classList.remove('coin-change');
  void el.offsetWidth;
  el.classList.add('coin-change');
  setTimeout(() => el.classList.remove('coin-change'), 300);
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// =============================================
// CARD GENERATION
// =============================================

function generateCard() {
  const c = [];
  for (let row = 0; row < 5; row++) c.push([0, 0, 0, 0, 0]);

  const cols = [
    randomUnique(1,  15, 5),
    randomUnique(16, 30, 5),
    randomUnique(31, 45, 5),
    randomUnique(46, 60, 5),
    randomUnique(61, 75, 5),
  ];
  cols[2][2] = 0; // FREE

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      c[row][col] = cols[col][row];
    }
  }
  return c;
}

// =============================================
// BUILD CARD DOM
// =============================================

function buildCard() {
  const container = document.getElementById('bingo-card');
  container.innerHTML = '';

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const num = card[row][col];
      const letter = COLUMN_LETTERS[col];
      const div = document.createElement('div');
      div.className = `cell col-${letter}`;
      div.dataset.row = row;
      div.dataset.col = col;
      div.dataset.number = num;

      if (row === 2 && col === 2) {
        div.classList.add('free', 'marked');
        div.textContent = 'FREE';
      } else {
        div.textContent = num;
      }

      div.addEventListener('click', () => {
        if (daubActive && !div.classList.contains('marked')) {
          markCell(row, col);
          daubActive = false;
          document.querySelectorAll('.cell.daub-target').forEach(c => c.classList.remove('daub-target'));
          document.querySelector('[data-power="daub"]').classList.remove('active');
          checkWins();
        }
      });

      container.appendChild(div);
    }
  }
}

// =============================================
// CARD 2 (EXTRA CARD)
// =============================================

function buildCard2() {
  const container = document.getElementById('bingo-card-2');
  if (!container || !card2) return;
  container.innerHTML = '';

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const num    = card2[row][col];
      const letter = COLUMN_LETTERS[col];
      const div    = document.createElement('div');
      div.className = `cell col-${letter} card2-cell`;
      div.dataset.row  = row;
      div.dataset.col  = col;
      div.dataset.number = num;

      if (row === 2 && col === 2) {
        div.classList.add('free', 'marked');
        div.textContent = 'FREE';
      } else {
        div.textContent = num;
      }
      container.appendChild(div);
    }
  }
}

function markCell2(row, col) {
  if (!card2) return;
  const key = `${row},${col}`;
  if (markedCells2.has(key)) return;
  markedCells2.add(key);
  const cellEl = document.querySelector(`#bingo-card-2 .card2-cell[data-row="${row}"][data-col="${col}"]`);
  if (!cellEl) return;
  cellEl.classList.add('marked', 'flipping');
  setTimeout(() => cellEl.classList.remove('flipping'), SPEEDS[selectedSpeed].animDur);
}

function checkWins2() {
  if (!card2) return;
  const lines = [];
  for (let row = 0; row < 5; row++) lines.push([[row,0],[row,1],[row,2],[row,3],[row,4]]);
  for (let col = 0; col < 5; col++) lines.push([[0,col],[1,col],[2,col],[3,col],[4,col]]);
  lines.push([[0,0],[1,1],[2,2],[3,3],[4,4]]);
  lines.push([[0,4],[1,3],[2,2],[3,1],[4,0]]);

  const newLines = [];
  for (const line of lines) {
    if (line.every(([r, c]) => markedCells2.has(`${r},${c}`))) {
      const key = getLineKey(line);
      if (!completedLines2.has(key)) {
        completedLines2.add(key);
        newLines.push(line);
      }
    }
  }

  const allMarked2 = [...markedCells2].length === 25;
  if (newLines.length > 0) {
    newLines.forEach(() => {
      const lineCount2 = completedLines2.size;
      const lineKey2   = lineCount2 <= 4 ? `line${lineCount2}` : 'line4';
      const mult       = WIN_MULTIPLIERS[lineKey2] || 1.5;
      const payout     = Math.floor(bet * mult);
      totalWinnings += payout;
      document.getElementById('grw-value').textContent = totalWinnings;
      const newCoins = getCoins() + payout;
      setCoins(newCoins);
      updateCoinsDisplay();
      showWinPopup('CARD 2 LINE!', payout);
    });
  }

  if (allMarked2 && !jackpotWon) {
    // Only full house on card2 gives a standard bonus (not jackpot again)
    const fhBonus = Math.floor(bet * WIN_MULTIPLIERS.fullhouse);
    totalWinnings += fhBonus;
    setCoins(getCoins() + fhBonus);
    updateCoinsDisplay();
    showWinPopup('CARD 2 FULL HOUSE!', fhBonus);
  }
}

// =============================================
// MARK CELL
// =============================================

function markCell(row, col) {
  const key = `${row},${col}`;
  if (markedCells.has(key)) return;
  markedCells.add(key);

  const cellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cellEl) return;
  cellEl.classList.add('marked');
  cellEl.classList.add('flipping');
  setTimeout(() => cellEl.classList.remove('flipping'), SPEEDS[selectedSpeed].animDur);
}

// =============================================
// WIN DETECTION
// =============================================

function getLineKey(cells) {
  return cells.map(([r, c]) => `${r},${c}`).join('|');
}

function checkLine(cells) {
  return cells.every(([r, c]) => markedCells.has(`${r},${c}`));
}

function checkWins() {
  const lines = [];

  // Rows
  for (let row = 0; row < 5; row++) {
    const cells = [[row,0],[row,1],[row,2],[row,3],[row,4]];
    lines.push(cells);
  }
  // Cols
  for (let col = 0; col < 5; col++) {
    const cells = [[0,col],[1,col],[2,col],[3,col],[4,col]];
    lines.push(cells);
  }
  // Diagonals
  lines.push([[0,0],[1,1],[2,2],[3,3],[4,4]]);
  lines.push([[0,4],[1,3],[2,2],[3,1],[4,0]]);

  const newLines = [];
  for (const line of lines) {
    if (checkLine(line)) {
      const key = getLineKey(line);
      if (!completedLines.has(key)) {
        completedLines.add(key);
        newLines.push(line);
        highlightWinLine(line);
      }
    }
  }

  if (newLines.length > 0) {
    for (const line of newLines) {
      const lineIndex = completedLines.size; // how many total now
      const payout = Math.floor(bet * 1.5);
      totalWinnings += payout;
      document.getElementById('grw-value').textContent = totalWinnings;
      document.getElementById('grl-value').textContent = completedLines.size;

      showWinPopup('LINE!', payout);

      // Coins
      const newCoins = getCoins() + payout;
      setCoins(newCoins);
      updateCoinsDisplay();
    }
  }

  // Full House
  if (markedCells.size === 25) {
    handleFullHouse();
  }
}

function highlightWinLine(cells) {
  cells.forEach(([r, c]) => {
    const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (el) el.classList.add('win-line');
  });

  const count = completedLines.size;
  const display = document.getElementById('win-lines-display');
  display.textContent = `★ ${count} LINE${count > 1 ? 'S' : ''} ★`;
}

// =============================================
// FULL HOUSE
// =============================================

// JACKPOT_QUICK_THRESHOLD — Full House in ≤ this many draws wins the quick jackpot
const JACKPOT_QUICK_THRESHOLD = 30;
// JACKPOT_LUCK_CHANCE — fallback random chance at any Full House (0.05 = 5%)
const JACKPOT_LUCK_CHANCE = 0.05;

function checkJackpotConditions() {
  const drawn = drawnNumbers.size;
  if (drawn <= JACKPOT_QUICK_THRESHOLD) return { won: true, reason: 'quick', drawn };
  if (bet === 100)                       return { won: true, reason: 'highroller', drawn };
  if (Math.random() < JACKPOT_LUCK_CHANCE) return { won: true, reason: 'lucky', drawn };
  return { won: false, drawn };
}

function handleFullHouse() {
  if (!gameActive) return;
  clearInterval(drawTimer);
  gameActive = false;

  const fullHousePayout = Math.floor(bet * WIN_MULTIPLIERS.fullhouse);
  const jp = checkJackpotConditions();

  if (jp.won) {
    // ── JACKPOT WIN ─────────────────────────────
    jackpotWon = true;
    totalWinnings += fullHousePayout + jackpot;
    setCoins(getCoins() + fullHousePayout + jackpot);
    updateCoinsDisplay();

    // Full house flash
    const fhOverlay = document.getElementById('fullhouse-overlay');
    const fhSub = document.getElementById('fh-sub');
    if (fhSub) fhSub.textContent = '✨ +JACKPOT!';
    fhOverlay.classList.remove('hidden');

    // Jackpot screen after 1 second
    setTimeout(() => {
      fhOverlay.classList.add('hidden');

      document.getElementById('jo-amount').textContent = jackpot;

      // Show jackpot reason
      const joReason = document.getElementById('jo-reason');
      if (joReason) {
        if (jp.reason === 'quick')
          joReason.textContent = `🚀 FULL HOUSE IN ${jp.drawn} DRAWS!`;
        else if (jp.reason === 'highroller')
          joReason.textContent = '💎 HIGH ROLLER JACKPOT!';
        else
          joReason.textContent = '🍀 5% LUCKY JACKPOT!';
      }

      const jpOverlay = document.getElementById('jackpot-overlay');
      jpOverlay.classList.remove('hidden');
      spawnConfetti();
      if (window.triggerBingoJackpotBG) window.triggerBingoJackpotBG();

      // Reset jackpot pool
      jackpot = 100;
      localStorage.setItem('bingo_jackpot', '100');
      updateJackpotDisplays();

      setTimeout(() => {
        jpOverlay.classList.add('hidden');
        document.getElementById('confetti-container').innerHTML = '';
        endGame();
      }, 4500);
    }, 1000);

  } else {
    // ── FULL HOUSE WITHOUT JACKPOT ───────────────
    totalWinnings += fullHousePayout;
    setCoins(getCoins() + fullHousePayout);
    updateCoinsDisplay();

    const fhOverlay = document.getElementById('fullhouse-overlay');
    const fhSub = document.getElementById('fh-sub');
    if (fhSub) fhSub.textContent = `+${fullHousePayout} 🪙`;
    fhOverlay.classList.remove('hidden');

    setTimeout(() => {
      fhOverlay.classList.add('hidden');
      showWinPopup('FULL HOUSE!', fullHousePayout);
      // End game after win popup auto-hides
      setTimeout(endGame, 2100);
    }, 2000);
  }
}

// =============================================
// JACKPOT TRACKER (live in-game display)
// =============================================

function updateJackpotTracker() {
  const el = document.getElementById('jackpot-tracker');
  if (!el) return;
  const drawn     = drawnNumbers ? drawnNumbers.size : 0;
  const remaining = JACKPOT_QUICK_THRESHOLD - drawn;

  if (remaining > 0) {
    el.textContent = `🎰 Quick JP: ${remaining} draw${remaining === 1 ? '' : 's'} left`;
    el.className   = remaining <= 5 ? 'jt-possible jt-urgent' : 'jt-possible';
  } else if (bet === 100) {
    el.textContent = '💎 High Roller JP active';
    el.className   = 'jt-highroller';
  } else {
    el.textContent = '🎰 JP: 5% luck only';
    el.className   = 'jt-expired';
  }
}

// =============================================
// WIN POPUP
// =============================================

function showWinPopup(title, amount) {
  const popup = document.getElementById('win-popup');
  document.getElementById('wp-title').textContent = title;
  document.getElementById('wp-amount').textContent = `+${amount} COINS`;
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 1800);
}

// =============================================
// CONFETTI
// =============================================

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#fbbf24','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#06b6d4','#ec4899'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = `${6 + Math.random() * 8}px`;
    el.style.height = `${6 + Math.random() * 8}px`;
    el.style.animationDuration = `${2 + Math.random() * 3}s`;
    el.style.animationDelay = `${Math.random() * 2}s`;
    container.appendChild(el);
  }
}

// =============================================
// DRAW NEXT
// =============================================

function drawNext() {
  if (!gameActive) return;
  if (allNumbers.length === 0) {
    endGame();
    return;
  }

  let drawnNum;

  // Lucky: force a card number if available
  if (luckyActive && luckyCount > 0) {
    const undrawnCardNums = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const n = card[row][col];
        if (n !== 0 && !drawnNumbers.has(n) && allNumbers.includes(n)) {
          undrawnCardNums.push(n);
        }
      }
    }
    if (undrawnCardNums.length > 0) {
      drawnNum = undrawnCardNums[Math.floor(Math.random() * undrawnCardNums.length)];
      const idx = allNumbers.indexOf(drawnNum);
      allNumbers.splice(idx, 1);
    } else {
      drawnNum = allNumbers.shift();
    }
    luckyCount--;
    if (luckyCount <= 0) {
      luckyActive = false;
      document.querySelector('[data-power="lucky"]').classList.remove('active');
    }
  } else {
    drawnNum = allNumbers.shift();
  }

  drawnNumbers.add(drawnNum);

  const letter = getLetterForNumber(drawnNum);
  document.getElementById('nl-value').textContent = allNumbers.length;
  updateJackpotTracker();

  // Animate current draw
  const cdLetter = document.getElementById('cd-letter');
  const cdNumber = document.getElementById('cd-number');

  cdLetter.className = `cd-${letter}`;
  cdNumber.className = `cd-${letter}`;

  cdLetter.textContent = letter;
  cdNumber.textContent = drawnNum;

  cdLetter.classList.add('bounce');
  cdNumber.classList.add('bounce');
  setTimeout(() => {
    cdLetter.classList.remove('bounce');
    cdNumber.classList.remove('bounce');
  }, SPEEDS[selectedSpeed].animDur);

  // Update history balls (last 8, newest first)
  addHistoryBall(drawnNum, letter);

  // Mark matching cells on card 1
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (card[row][col] === drawnNum) markCell(row, col);
    }
  }
  checkWins();

  // Mark matching cells on card 2
  if (useExtraCard && card2) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (card2[row][col] === drawnNum) markCell2(row, col);
      }
    }
    checkWins2();
  }

  // Rush countdown
  if (rushActive) {
    rushCount--;
    if (rushCount <= 0) {
      rushActive = false;
      document.querySelector('[data-power="rush"]').classList.remove('active');
      clearInterval(drawTimer);
      drawIntervalMs = SPEEDS[selectedSpeed].ms;
      drawTimer = setInterval(drawNext, drawIntervalMs);
    }
  }

  if (allNumbers.length === 0 && gameActive) {
    setTimeout(endGame, 500);
  }
}

function addHistoryBall(num, letter) {
  const container = document.getElementById('dh-balls');
  const ball = document.createElement('div');
  ball.className = `history-ball hb-${letter}`;
  ball.textContent = num;

  // Insert at beginning
  container.insertBefore(ball, container.firstChild);

  // Keep only last 8
  while (container.children.length > 8) {
    container.removeChild(container.lastChild);
  }
}

// =============================================
// POWER CARDS
// =============================================

function usePower(type) {
  if (!gameActive) return;
  if (powerUsed >= POWER_MAX) {
    showNotification('MAX POWERS USED!');
    return;
  }
  const cost = POWER_COSTS[type];
  const currentCoins = getCoins();
  if (isFreePlay && cost > 0) {
    // Free play: allow power cards but still deduct (they have no bet deducted)
    if (currentCoins < cost) {
      showNotification('NOT ENOUGH COINS!');
      return;
    }
  } else if (currentCoins < cost) {
    showNotification('NOT ENOUGH COINS!');
    return;
  }

  setCoins(currentCoins - cost);
  updateCoinsDisplay();
  powerUsed++;
  document.getElementById('pc-used').textContent = `${powerUsed}/2 USED`;

  switch (type) {
    case 'peek':   doPeek();   break;
    case 'daub':   doDaub();   break;
    case 'swap':   doSwap();   break;
    case 'rush':   doRush();   break;
    case 'lucky':  doLucky();  break;
  }

  if (powerUsed >= POWER_MAX) {
    document.querySelectorAll('.pc-btn').forEach(b => b.disabled = true);
  }
}

function doPeek() {
  if (allNumbers.length === 0) return;
  const next3 = allNumbers.slice(0, 3);
  const preview = document.getElementById('peek-preview');
  preview.classList.remove('hidden');
  preview.innerHTML = `<div class="peek-title">NEXT 3</div><div class="peek-balls"></div>`;
  const ballsEl = preview.querySelector('.peek-balls');
  next3.forEach(n => {
    const l = getLetterForNumber(n);
    const b = document.createElement('div');
    b.className = `history-ball hb-${l}`;
    b.textContent = n;
    ballsEl.appendChild(b);
  });
  if (peekTimeout) clearTimeout(peekTimeout);
  peekTimeout = setTimeout(() => {
    preview.classList.add('hidden');
    peekTimeout = null;
  }, 5000);
}

function doDaub() {
  daubActive = true;
  document.querySelector('[data-power="daub"]').classList.add('active');
  document.querySelectorAll('.cell:not(.marked)').forEach(c => c.classList.add('daub-target'));
  showNotification('CLICK A CELL TO MARK IT');
}

function doSwap() {
  // Get all unmarked cells (excluding FREE)
  const unmarked = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const key = `${row},${col}`;
      if (!markedCells.has(key) && !(row === 2 && col === 2)) {
        unmarked.push({ row, col });
      }
    }
  }
  if (unmarked.length === 0) return;

  // Pick up to 5 random unmarked
  const toSwap = shuffle(unmarked).slice(0, 5);

  // Get all numbers currently on card
  const onCard = new Set();
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (card[row][col] !== 0) onCard.add(card[row][col]);
    }
  }

  // New numbers: not on card, not already drawn
  toSwap.forEach(({ row, col }) => {
    const colIdx = col;
    const [min, max] = Object.values(COLUMN_RANGES)[colIdx];
    let candidates = [];
    for (let n = min; n <= max; n++) {
      if (!onCard.has(n) && !drawnNumbers.has(n)) candidates.push(n);
    }
    if (candidates.length === 0) return;
    const newNum = candidates[Math.floor(Math.random() * candidates.length)];
    onCard.delete(card[row][col]);
    card[row][col] = newNum;
    onCard.add(newNum);

    // Update DOM
    const cellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (cellEl) {
      cellEl.dataset.number = newNum;
      cellEl.textContent = newNum;
      cellEl.classList.add('flipping');
      setTimeout(() => cellEl.classList.remove('flipping'), 400);
    }
  });
}

function doRush() {
  if (rushActive) return;
  rushActive = true;
  rushCount = 5;
  document.querySelector('[data-power="rush"]').classList.add('active');
  clearInterval(drawTimer);
  drawIntervalMs = 200;
  drawTimer = setInterval(drawNext, drawIntervalMs);
}

function doLucky() {
  luckyActive = true;
  luckyCount = 3;
  document.querySelector('[data-power="lucky"]').classList.add('active');
  showNotification('LUCKY: NEXT 3 DRAWS ON YOUR CARD!');
}

function showNotification(msg) {
  const popup = document.getElementById('win-popup');
  document.getElementById('wp-title').textContent = msg;
  document.getElementById('wp-amount').textContent = '';
  document.getElementById('wp-emoji').textContent = '⚡';
  popup.classList.remove('hidden');
  setTimeout(() => {
    popup.classList.add('hidden');
    document.getElementById('wp-emoji').textContent = '🎉';
  }, 1500);
}

// =============================================
// JACKPOT DISPLAYS
// =============================================

function updateJackpotDisplays() {
  document.getElementById('jackpot-amount').textContent = jackpot;
  document.getElementById('gj-amount').textContent = jackpot;
}

// =============================================
// SCREENS
// =============================================

function showStart() {
  document.getElementById('screen-start').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('hidden');
  document.getElementById('screen-result').classList.add('hidden');

  nickname = localStorage.getItem('portal_nickname') || 'PLAYER';
  coins = getCoins();

  document.getElementById('start-name').textContent = nickname.toUpperCase();
  document.getElementById('start-coins').textContent = `💰 ${coins} COINS`;

  jackpot = parseInt(localStorage.getItem('bingo_jackpot') || '100', 10);
  document.getElementById('jackpot-amount').textContent = jackpot;

  // Free play check
  const freeDate = localStorage.getItem('bingo_free_date');
  const today = getTodayStr();
  const freeBtn = document.getElementById('free-play-btn');
  if (freeDate !== today) {
    freeBtn.disabled = false;
    freeBtn.classList.remove('selected');
  } else {
    freeBtn.disabled = true;
    freeBtn.classList.remove('selected');
  }

  bet = 0;
  isFreePlay = false;
  document.getElementById('start-game-btn').disabled = true;
  document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('selected'));

  // Extra card offer
  const hasExtraCard = localStorage.getItem('bingo_extra_card') === 'true';
  const offerEl = document.getElementById('extra-card-offer');
  const checkEl = document.getElementById('extra-card-check');
  if (offerEl) offerEl.classList.toggle('hidden', !hasExtraCard);
  if (checkEl) checkEl.checked = hasExtraCard;
  document.querySelectorAll('.speed-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.speed === selectedSpeed);
  });
  const sdEl = document.getElementById('speed-desc');
  if (sdEl) sdEl.textContent = SPEEDS[selectedSpeed].desc;

  renderLeaderboard();
}

function renderLeaderboard() {
  const lb = JSON.parse(localStorage.getItem('bingo_leaderboard') || '[]');
  const list = document.getElementById('start-lb-list');
  list.innerHTML = '';
  if (lb.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:#475569;text-align:center;padding:8px;">No winners yet</div>';
    return;
  }
  lb.slice(0, 5).forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'lb-entry';
    row.innerHTML = `<span class="lb-rank">#${i + 1}</span><span class="lb-name">${entry.name}</span><span class="lb-score">${entry.totalWon} 🪙</span>`;
    list.appendChild(row);
  });
}

function showGame() {
  document.getElementById('screen-start').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  document.getElementById('screen-result').classList.add('hidden');

  // Increment jackpot
  jackpot += 10;
  localStorage.setItem('bingo_jackpot', String(jackpot));

  // Extra card setup
  const checkEl = document.getElementById('extra-card-check');
  useExtraCard = checkEl && checkEl.checked && localStorage.getItem('bingo_extra_card') === 'true';
  if (useExtraCard) {
    localStorage.removeItem('bingo_extra_card'); // consume it
    document.getElementById('extra-card-offer').classList.add('hidden');
  }

  // Reset state
  card = generateCard();
  markedCells = new Set(['2,2']); // FREE
  drawnNumbers = new Set();
  allNumbers = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
  completedLines = new Set();

  // Second card
  if (useExtraCard) {
    card2 = generateCard();
    markedCells2 = new Set(['2,2']);
    completedLines2 = new Set();
  } else {
    card2 = null; markedCells2 = null; completedLines2 = null;
  }
  totalWinnings = 0;
  powerUsed = 0;
  luckyActive = false;
  luckyCount = 0;
  rushActive = false;
  rushCount = 0;
  daubActive = false;
  peekActive = false;
  jackpotWon = false;
  drawIntervalMs = SPEEDS[selectedSpeed].ms;
  document.body.dataset.speed = selectedSpeed;
  const stBtn = document.getElementById('speed-toggle-btn');
  if (stBtn) stBtn.textContent = SPEEDS[selectedSpeed].label;

  // UI reset
  document.getElementById('gj-amount').textContent = jackpot;
  document.getElementById('grb-value').textContent = bet;
  document.getElementById('grw-value').textContent = 0;
  document.getElementById('grl-value').textContent = 0;
  document.getElementById('nl-value').textContent = 75;
  document.getElementById('pc-used').textContent = '0/2 USED';
  updateJackpotTracker();
  document.getElementById('win-lines-display').textContent = '';
  document.getElementById('dh-balls').innerHTML = '';
  document.getElementById('peek-preview').classList.add('hidden');
  document.getElementById('cd-letter').textContent = '?';
  document.getElementById('cd-number').textContent = '--';
  document.getElementById('cd-letter').className = '';
  document.getElementById('cd-number').className = '';

  document.querySelectorAll('.pc-btn').forEach(b => {
    b.disabled = false;
    b.classList.remove('active');
  });

  updateCoinsDisplay();
  buildCard();

  // Dual-card display
  const col2 = document.getElementById('bingo-card-2-col');
  const lbl1 = document.getElementById('card-1-label');
  if (col2) col2.classList.toggle('hidden', !useExtraCard);
  if (lbl1) lbl1.classList.toggle('hidden', !useExtraCard);
  document.body.classList.toggle('dual-card', useExtraCard);
  if (useExtraCard) buildCard2();

  gameActive = true;
  clearInterval(drawTimer);
  drawTimer = setInterval(drawNext, drawIntervalMs);
}

function showResult(won) {
  clearInterval(drawTimer);
  gameActive = false;

  // Cleanup dual-card UI
  document.body.classList.remove('dual-card');
  const col2 = document.getElementById('bingo-card-2-col');
  if (col2) col2.classList.add('hidden');
  const lbl1 = document.getElementById('card-1-label');
  if (lbl1) lbl1.classList.add('hidden');

  document.getElementById('screen-game').classList.add('hidden');
  document.getElementById('screen-result').classList.remove('hidden');

  const profit = totalWinnings - bet;

  document.getElementById('res-bet').textContent = bet;
  document.getElementById('res-win').textContent = totalWinnings;
  document.getElementById('res-profit').textContent = (profit >= 0 ? '+' : '') + profit;
  document.getElementById('res-lines').textContent = completedLines.size;

  const profitRow = document.querySelector('#result-stats .rs-row.highlight');
  if (profit < 0) profitRow.classList.add('negative');
  else profitRow.classList.remove('negative');

  if (completedLines.size > 0 || jackpotWon) {
    document.getElementById('result-emoji').textContent = '🏆';
    document.getElementById('result-title').textContent = 'YOU WON!';
  } else {
    document.getElementById('result-emoji').textContent = '😞';
    document.getElementById('result-title').textContent = 'GAME OVER';
  }

  if (jackpotWon) {
    document.getElementById('result-jackpot-msg').classList.remove('hidden');
  } else {
    document.getElementById('result-jackpot-msg').classList.add('hidden');
  }

  saveStats(profit);
}

// =============================================
// SAVE STATS
// =============================================

function saveStats(profit) {
  // Game stats
  const games = parseInt(localStorage.getItem('bingo_games') || '0', 10) + 1;
  localStorage.setItem('bingo_games', String(games));

  if (totalWinnings > 0) {
    const wins = parseInt(localStorage.getItem('bingo_wins') || '0', 10) + 1;
    localStorage.setItem('bingo_wins', String(wins));
  }

  const totalWon = parseInt(localStorage.getItem('bingo_total_won') || '0', 10) + totalWinnings;
  localStorage.setItem('bingo_total_won', String(totalWon));

  if (profit < 0) {
    const totalLost = parseInt(localStorage.getItem('bingo_total_lost') || '0', 10) + Math.abs(profit);
    localStorage.setItem('bingo_total_lost', String(totalLost));
  }

  if (jackpotWon) {
    const jp = parseInt(localStorage.getItem('bingo_jackpots') || '0', 10) + 1;
    localStorage.setItem('bingo_jackpots', String(jp));
    localStorage.setItem('bingo_jackpot_won', 'true');
  }

  // Achievements
  if (bet === 100) {
    localStorage.setItem('bingo_highroller', 'true');
  }

  // Win streak
  if (totalWinnings > 0) {
    const streak = parseInt(localStorage.getItem('bingo_win_streak') || '0', 10) + 1;
    localStorage.setItem('bingo_win_streak', String(streak));
    if (streak >= 3) {
      const lucky = parseInt(localStorage.getItem('bingo_lucky_streak') || '0', 10);
      localStorage.setItem('bingo_lucky_streak', String(Math.max(lucky, streak)));
    }
  } else {
    localStorage.setItem('bingo_win_streak', '0');
  }

  // Leaderboard
  const lb = JSON.parse(localStorage.getItem('bingo_leaderboard') || '[]');
  const existing = lb.findIndex(e => e.name === nickname);
  if (existing >= 0) {
    lb[existing].totalWon += totalWinnings;
  } else {
    lb.push({ name: nickname, totalWon: totalWinnings });
  }
  lb.sort((a, b) => b.totalWon - a.totalWon);
  localStorage.setItem('bingo_leaderboard', JSON.stringify(lb.slice(0, 10)));
}

// =============================================
// END GAME
// =============================================

function endGame() {
  if (!gameActive) return;
  clearInterval(drawTimer);
  gameActive = false;
  const profit = totalWinnings - bet;
  setTimeout(() => showResult(profit > 0), 600);
}

// =============================================
// EVENT LISTENERS
// =============================================

// Bet buttons
document.querySelectorAll('.bet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const b = parseInt(btn.dataset.bet, 10);
    const c = getCoins();
    if (c < b) return;

    bet = b;
    isFreePlay = false;
    document.querySelectorAll('.bet-btn').forEach(x => x.classList.remove('selected'));
    document.getElementById('free-play-btn').classList.remove('selected');
    btn.classList.add('selected');
    document.getElementById('start-game-btn').disabled = false;
  });
});

// Free play
document.getElementById('free-play-btn').addEventListener('click', () => {
  const freeDate = localStorage.getItem('bingo_free_date');
  const today = getTodayStr();
  if (freeDate === today) return;

  bet = 10;
  isFreePlay = true;
  document.querySelectorAll('.bet-btn').forEach(x => x.classList.remove('selected'));
  document.getElementById('free-play-btn').classList.add('selected');
  document.getElementById('start-game-btn').disabled = false;

  localStorage.setItem('bingo_free_date', today);
});

// Start game
document.getElementById('start-game-btn').addEventListener('click', () => {
  if (isFreePlay) {
    // Free play: bet is 10 but no deduction
    showGame();
  } else {
    const c = getCoins();
    if (c < bet) {
      showNotification('NOT ENOUGH COINS!');
      return;
    }
    setCoins(c - bet);
    showGame();
  }
});

// Power cards
document.querySelectorAll('.pc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    usePower(btn.dataset.power);
  });
});

// Quit
document.getElementById('quit-btn').addEventListener('click', () => {
  if (!gameActive) return;
  clearInterval(drawTimer);
  gameActive = false;
  // No refund on quit
  showResult(false);
});

// Play again (same bet)
document.getElementById('play-again-btn').addEventListener('click', () => {
  const c = getCoins();
  if (!isFreePlay && c < bet) {
    showStart();
    return;
  }
  if (!isFreePlay) {
    setCoins(c - bet);
  }
  showGame();
});

// Change bet
document.getElementById('change-bet-btn').addEventListener('click', () => {
  showStart();
});

// Speed select (start screen)
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedSpeed = btn.dataset.speed;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const sdEl = document.getElementById('speed-desc');
    if (sdEl) sdEl.textContent = SPEEDS[selectedSpeed].desc;
  });
});

// Speed toggle (in-game)
const speedToggleBtn = document.getElementById('speed-toggle-btn');
if (speedToggleBtn) {
  speedToggleBtn.addEventListener('click', () => {
    const idx = IN_GAME_CYCLE.indexOf(selectedSpeed);
    // If current speed not in cycle (e.g. slow), start from normal
    selectedSpeed = IN_GAME_CYCLE[(Math.max(idx, 0) + 1) % IN_GAME_CYCLE.length];
    speedToggleBtn.textContent = SPEEDS[selectedSpeed].label;
    document.body.dataset.speed = selectedSpeed;
    if (gameActive && !rushActive) {
      clearInterval(drawTimer);
      drawIntervalMs = SPEEDS[selectedSpeed].ms;
      drawTimer = setInterval(drawNext, drawIntervalMs);
    }
  });
}

// =============================================
// MULTIPLAYER MODULE
// =============================================

/* ── Constants ── */
const MP_BOT_NAMES    = ['Viktor_88','LuckyLara','BingoKing','NightOwl','FastFingers','CardShark','GoldRush','MegaWin','ThunderBall'];
const MP_BOT_AVATARS  = ['🤖','🦊','👾','🦁','⚡','🎯','💰','🚀','⭐'];
const MP_TIERS = [
  { amount:10,  label:'BRONZE',  badge:'🥉', freqNums:0,  speedMult:1.00, peekCount:0, autoMark:false },
  { amount:25,  label:'SILVER',  badge:'🥈', freqNums:5,  speedMult:1.00, peekCount:0, autoMark:false },
  { amount:50,  label:'GOLD',    badge:'🥇', freqNums:10, speedMult:1.10, peekCount:0, autoMark:false },
  { amount:100, label:'DIAMOND', badge:'💎', freqNums:15, speedMult:1.20, peekCount:3, autoMark:false },
  { amount:250, label:'ROYAL',   badge:'👑', freqNums:20, speedMult:1.30, peekCount:5, autoMark:true  },
];
const MP_BOT_WEIGHTS    = [0.40, 0.30, 0.20, 0.08, 0.02];
const MP_FREQ_ZONES     = { B:[8,12], I:[20,25], N:[35,40], G:[50,55], O:[65,70] };
const MP_BASE_INTERVAL  = 2000; // ms per draw

/* ── State ── */
let mpMode         = false;   // are we in MP flow?
let mpBetTierIdx   = -1;
let mpPlayers      = [];
// player = { name, avatar, tierIdx, isPlayer, lucky, card, marked, lines, eliminated }
let mpAllNumbers   = [];
let mpDrawnNums    = new Set();
let mpDrawTimer    = null;
let mpGameActive   = false;
let mpWinner       = null;
let mpPrizePool    = 0;
let mpDrawCount    = 0;
let mpPlayerLines  = 0;          // lines player has completed
let mpLineBonusPaid = false;     // whether player already received line bonus this game
let mpLobbyTimers  = [];
let mpAutoMarks    = 0;          // remaining auto-marks for ROYAL tier

/* ── Frequent number pool ── */
function mpGetFreqPool() {
  const pool = [];
  for (const [col, [lo, hi]] of Object.entries(MP_FREQ_ZONES)) {
    for (let n = lo; n <= hi; n++) pool.push(n);
  }
  return pool; // 5 zones × 5 numbers = 25 numbers
}

/* ── Generate a card with `freqCount` guaranteed frequent numbers ── */
function generateMPCard(freqCount, lucky = false) {
  const freqPool = mpGetFreqPool(); // 25 freq numbers
  const extra    = lucky ? Math.floor(Math.random() * 5) : 0;
  const total    = Math.min(freqCount + extra, 20); // cap at 20 (5 per col, minus FREE)

  // Distribute freq numbers across columns proportionally
  const freqByCol = { B:[], I:[], N:[], G:[], O:[] };
  shuffle(freqPool).slice(0, total).forEach(n => {
    const l = getLetterForNumber(n);
    if (freqByCol[l].length < 4) freqByCol[l].push(n); // max 4 per col (1 spot is FREE in N)
  });

  const card = [];
  for (let row = 0; row < 5; row++) card.push([0,0,0,0,0]);

  const cols = COLUMN_LETTERS;
  for (let ci = 0; ci < 5; ci++) {
    const letter = cols[ci];
    const [min, max] = Object.values(COLUMN_RANGES)[ci];
    const freqForCol = freqByCol[letter];
    const needed = (letter === 'N') ? 4 : 5; // N col has FREE at [2][2]
    const slots  = needed - freqForCol.length;

    // Fill remaining slots with non-freq randoms
    const nonFreq = [];
    for (let n = min; n <= max; n++) {
      if (!freqForCol.includes(n)) nonFreq.push(n);
    }
    const fillers = shuffle(nonFreq).slice(0, slots);
    const colNums = shuffle([...freqForCol, ...fillers]);

    let ri = 0;
    for (let row = 0; row < 5; row++) {
      if (letter === 'N' && row === 2) {
        card[row][ci] = 0; // FREE
      } else {
        card[row][ci] = colNums[ri++] || randomUnique(min, max, 1)[0];
      }
    }
  }
  return card;
}

/* ── Biased draw sequence ── */
function generateMPDrawSequence() {
  const freqPool = mpGetFreqPool(); // 25 freq numbers
  const allNums  = Array.from({length:75}, (_,i) => i+1);
  const nonFreq  = allNums.filter(n => !freqPool.includes(n)); // 50 non-freq

  // First 35 draws: 18 freq + 17 non-freq (biased toward frequent)
  const first18freq  = shuffle(freqPool).slice(0, 18);
  const first17non   = shuffle(nonFreq).slice(0, 17);
  const first35      = shuffle([...first18freq, ...first17non]);

  // Remaining 40 draws: remaining 7 freq + remaining 33 non-freq
  const rest7freq    = freqPool.filter(n => !first18freq.includes(n));
  const rest33non    = nonFreq.filter(n => !first17non.includes(n));
  const last40       = shuffle([...rest7freq, ...rest33non]);

  return [...first35, ...last40];
}

/* ── Weighted random tier index ── */
function mpPickBotTier() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < MP_BOT_WEIGHTS.length; i++) {
    acc += MP_BOT_WEIGHTS[i];
    if (r <= acc) return i;
  }
  return 0;
}

/* ── Check bot card for lines ── */
function mpBotCheckLines(player) {
  const { card, marked } = player;
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([[r,0],[r,1],[r,2],[r,3],[r,4]]);
  for (let c = 0; c < 5; c++) lines.push([[0,c],[1,c],[2,c],[3,c],[4,c]]);
  lines.push([[0,0],[1,1],[2,2],[3,3],[4,4]]);
  lines.push([[0,4],[1,3],[2,2],[3,1],[4,0]]);

  let newLines = 0;
  for (const line of lines) {
    const key = line.map(([r,c]) => `${r},${c}`).join('|');
    if (!player.completedLines.has(key) && line.every(([r,c]) => marked.has(`${r},${c}`))) {
      player.completedLines.add(key);
      newLines++;
    }
  }
  return newLines;
}

/* ── Check if bot has full house ── */
function mpBotIsFullHouse(player) {
  return player.marked.size === 25;
}

/* ── DOM helpers ── */
function mpShowScreen(id) {
  ['screen-start','screen-game','screen-result','screen-lobby','screen-mp-game','screen-mp-result']
    .forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('hidden', s !== id);
    });
}

function mpUpdatePrizeDisplay() {
  const el = document.getElementById('mpp-value');
  if (el) el.textContent = mpPrizePool;
}

/* ── Build bot mini-cards ── */
function mpBuildBotsGrid() {
  const grid = document.getElementById('mp-bots-grid');
  if (!grid) return;
  grid.innerHTML = '';

  mpPlayers.filter(p => !p.isPlayer).forEach(p => {
    const wrap = document.createElement('div');
    wrap.className = 'mp-bot-card bot-active';
    wrap.id = `mp-bot-${p.name}`;

    // Header
    const header = document.createElement('div');
    header.className = 'mbc-header';
    header.innerHTML = `<span class="mbc-avatar">${p.avatar}</span><span class="mbc-name">${p.name}</span><span class="mbc-tier">${MP_TIERS[p.tierIdx].badge}</span>`;

    // Grid
    const miniGrid = document.createElement('div');
    miniGrid.className = 'mbc-grid';
    miniGrid.id = `mbc-grid-${p.name}`;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement('div');
        cell.className = 'mbc-cell';
        cell.id = `mbc-${p.name}-${r}-${c}`;
        if (r === 2 && c === 2) {
          cell.classList.add('free');
          cell.textContent = '★';
        } else {
          cell.textContent = p.card[r][c];
        }
        miniGrid.appendChild(cell);
      }
    }

    const linesEl = document.createElement('div');
    linesEl.className = 'mbc-lines';
    linesEl.id = `mbc-lines-${p.name}`;

    const statusEl = document.createElement('div');
    statusEl.className = 'mbc-status';
    statusEl.id = `mbc-status-${p.name}`;
    statusEl.textContent = MP_TIERS[p.tierIdx].label;

    wrap.appendChild(header);
    wrap.appendChild(miniGrid);
    wrap.appendChild(linesEl);
    wrap.appendChild(statusEl);
    grid.appendChild(wrap);
  });
}

/* ── Build player card in MP center ── */
function mpBuildPlayerCard() {
  const container = document.getElementById('mp-bingo-card');
  if (!container) return;
  container.innerHTML = '';
  const player = mpPlayers.find(p => p.isPlayer);
  if (!player) return;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const num = player.card[r][c];
      const letter = COLUMN_LETTERS[c];
      const div = document.createElement('div');
      div.className = `cell col-${letter}`;
      div.id = `mp-cell-${r}-${c}`;
      div.dataset.row = r;
      div.dataset.col = c;
      if (r === 2 && c === 2) {
        div.classList.add('free','marked');
        div.textContent = 'FREE';
      } else {
        div.textContent = num;
      }
      container.appendChild(div);
    }
  }
}

/* ── Mark player cell ── */
function mpMarkPlayerCell(r, c) {
  const player = mpPlayers.find(p => p.isPlayer);
  if (!player) return;
  const key = `${r},${c}`;
  if (player.marked.has(key)) return;
  player.marked.add(key);
  const el = document.getElementById(`mp-cell-${r}-${c}`);
  if (el) {
    el.classList.add('marked','flipping');
    setTimeout(() => el.classList.remove('flipping'), 400);
  }
}

/* ── Mark bot cell ── */
function mpMarkBotCell(player, r, c) {
  const key = `${r},${c}`;
  if (player.marked.has(key)) return;
  player.marked.add(key);
  const el = document.getElementById(`mbc-${player.name}-${r}-${c}`);
  if (el) el.classList.add('marked');
}

/* ── Highlight player win lines ── */
function mpHighlightPlayerLines() {
  const player = mpPlayers.find(p => p.isPlayer);
  if (!player) return;

  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([[r,0],[r,1],[r,2],[r,3],[r,4]]);
  for (let c = 0; c < 5; c++) lines.push([[0,c],[1,c],[2,c],[3,c],[4,c]]);
  lines.push([[0,0],[1,1],[2,2],[3,3],[4,4]]);
  lines.push([[0,4],[1,3],[2,2],[3,1],[4,0]]);

  for (const line of lines) {
    const key = line.map(([r,c]) => `${r},${c}`).join('|');
    if (player.completedLines.has(key)) {
      line.forEach(([r,c]) => {
        const el = document.getElementById(`mp-cell-${r}-${c}`);
        if (el) el.classList.add('win-line');
      });
    }
  }
}

/* ── Update peek panel ── */
function mpUpdatePeek() {
  const player = mpPlayers.find(p => p.isPlayer);
  if (!player) return;
  const peekCount = MP_TIERS[player.tierIdx].peekCount;
  if (peekCount === 0) return;

  const panel = document.getElementById('mp-peek-panel');
  const ballsEl = document.getElementById('mp-peek-balls');
  if (!panel || !ballsEl) return;

  const nextNums = mpAllNumbers.slice(0, peekCount);
  if (nextNums.length === 0) return;

  panel.classList.remove('hidden');
  ballsEl.innerHTML = '';
  nextNums.forEach(n => {
    const l = getLetterForNumber(n);
    const b = document.createElement('div');
    b.className = `history-ball hb-${l}`;
    b.style.fontSize = '11px';
    b.style.width = '24px';
    b.style.height = '24px';
    b.textContent = n;
    ballsEl.appendChild(b);
  });
}

/* ── MP Draw tick ── */
function mpDrawNext() {
  if (!mpGameActive) return;
  if (mpAllNumbers.length === 0) {
    mpEndGame(null);
    return;
  }

  const drawnNum = mpAllNumbers.shift();
  mpDrawnNums.add(drawnNum);
  mpDrawCount++;

  const letter = getLetterForNumber(drawnNum);

  // Update draw display
  const cdL = document.getElementById('mp-cd-letter');
  const cdN = document.getElementById('mp-cd-number');
  if (cdL) { cdL.className = `cd-${letter}`; cdL.textContent = letter; cdL.classList.add('bounce'); setTimeout(()=>cdL.classList.remove('bounce'), 400); }
  if (cdN) { cdN.className = `cd-${letter}`; cdN.textContent = drawnNum; cdN.classList.add('bounce'); setTimeout(()=>cdN.classList.remove('bounce'), 400); }

  // History ball
  const mph = document.getElementById('mph-balls');
  if (mph) {
    const b = document.createElement('div');
    b.className = `history-ball hb-${letter}`;
    b.style.fontSize = '11px';
    b.style.width = '28px';
    b.style.height = '28px';
    b.textContent = drawnNum;
    mph.insertBefore(b, mph.firstChild);
    while (mph.children.length > 8) mph.removeChild(mph.lastChild);
  }

  // Numbers left
  const nlEl = document.getElementById('mp-numbers-left');
  if (nlEl) nlEl.textContent = `${mpAllNumbers.length} left`;

  // Update peek
  mpUpdatePeek();

  // Mark all players
  for (const player of mpPlayers) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (player.card[r][c] === drawnNum) {
          if (player.isPlayer) {
            mpMarkPlayerCell(r, c);
          } else {
            mpMarkBotCell(player, r, c);
          }
        }
      }
    }

    // Auto-mark for ROYAL (mark one extra undrawn number on player's card)
    if (player.isPlayer && MP_TIERS[player.tierIdx].autoMark && mpAutoMarks > 0) {
      // Only trigger once every 5 draws on average
      if (mpDrawCount % 5 === 0) {
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            const key = `${r},${c}`;
            const n = player.card[r][c];
            if (n !== 0 && !player.marked.has(key) && !mpDrawnNums.has(n)) {
              mpMarkPlayerCell(r, c);
              mpAutoMarks--;
              break;
            }
          }
          if (mpAutoMarks <= 0) break;
        }
      }
    }

    // Check lines
    const prevLines = player.lines;
    const newLines  = mpBotCheckLines(player);
    if (newLines > 0) {
      player.lines += newLines;
      if (player.isPlayer) {
        mpPlayerLines = player.lines;
        const linesEl = document.getElementById('mp-your-lines');
        if (linesEl) linesEl.textContent = `${player.lines} line${player.lines>1?'s':''}`;
        const dispEl = document.getElementById('mp-win-lines-display');
        if (dispEl) dispEl.textContent = `★ ${player.lines} LINE${player.lines>1?'S':''} ★`;
        mpHighlightPlayerLines();

        // Line bonus (5% of prize pool, once)
        if (!mpLineBonusPaid) {
          mpLineBonusPaid = true;
          const bonus = Math.floor(mpPrizePool * 0.05);
          if (bonus > 0) {
            const c = getCoins();
            setCoins(c + bonus);
            showWinPopup('LINE BONUS!', bonus);
          }
        } else {
          showWinPopup('LINE!', 0);
        }
      } else {
        // Bot line notification
        const cardEl = document.getElementById(`mp-bot-${player.name}`);
        if (cardEl) {
          cardEl.classList.add('bot-has-line','flashing');
          setTimeout(()=>cardEl.classList.remove('flashing'), 900);
        }
        const linesEl = document.getElementById(`mbc-lines-${player.name}`);
        if (linesEl) linesEl.textContent = `${player.lines} LINE${player.lines>1?'S':''}`;
      }
    }

    // Check full house
    if (mpBotIsFullHouse(player) && !player.eliminated) {
      player.eliminated = true;
      if (!mpWinner) {
        clearInterval(mpDrawTimer);
        mpGameActive = false;
        mpWinner = player;
        setTimeout(() => mpEndGame(player), 300);
        return;
      }
    }
  }
}

/* ── End multiplayer game ── */
function mpEndGame(winner) {
  clearInterval(mpDrawTimer);
  mpGameActive = false;

  const playerData = mpPlayers.find(p => p.isPlayer);
  const tierDef    = MP_TIERS[playerData.tierIdx];
  let playerWinnings = 0;

  if (winner && winner.isPlayer) {
    // Player wins prize pool (90% already in mpPrizePool)
    playerWinnings = mpPrizePool;
    const c = getCoins();
    setCoins(c + playerWinnings);
  } else if (!winner) {
    // No full house reached (all 75 drawn) — bot with most lines wins
    // player gets nothing extra
  } else {
    // Bot won — consolation: 20% of player's bet back
    const consolation = Math.floor(tierDef.amount * 0.20);
    playerWinnings = consolation;
    if (consolation > 0) {
      setCoins(getCoins() + consolation);
    }
  }

  // Save MP stats
  mpSaveStats(winner, playerWinnings, tierDef);

  // Show result
  mpShowResult(winner, playerWinnings);
}

/* ── Save MP stats ── */
function mpSaveStats(winner, playerWinnings, tierDef) {
  const games = parseInt(localStorage.getItem('bingo_mp_games') || '0', 10) + 1;
  localStorage.setItem('bingo_mp_games', String(games));

  const spent = parseInt(localStorage.getItem('bingo_mp_total_spent') || '0', 10) + tierDef.amount;
  localStorage.setItem('bingo_mp_total_spent', String(spent));

  const playerData = mpPlayers.find(p => p.isPlayer);

  if (winner && winner.isPlayer) {
    const wins = parseInt(localStorage.getItem('bingo_mp_wins') || '0', 10) + 1;
    localStorage.setItem('bingo_mp_wins', String(wins));

    const bigWin = parseInt(localStorage.getItem('bingo_mp_biggest_win') || '0', 10);
    if (playerWinnings > bigWin) localStorage.setItem('bingo_mp_biggest_win', String(playerWinnings));

    // Achievement: High Stakes — win with ROYAL
    if (playerData.tierIdx === 4) localStorage.setItem('bingo_mp_win_royal', 'true');

    // Achievement: Comeback King — win after >=3 bots had lines
    const botsWithLines = mpPlayers.filter(p => !p.isPlayer && p.lines > 0).length;
    if (botsWithLines >= 3) localStorage.setItem('bingo_mp_comeback', 'true');
  }

  // Achievement: Whale — spend 1000 coins total in MP
  if (spent >= 1000) localStorage.setItem('bingo_mp_whale', 'true');

  const totalGames = parseInt(localStorage.getItem('bingo_mp_games') || '0', 10);
  const totalWins  = parseInt(localStorage.getItem('bingo_mp_wins') || '0', 10);
  const winrate    = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  localStorage.setItem('bingo_mp_winrate', String(winrate));
}

/* ── Show MP result screen ── */
function mpShowResult(winner, playerWinnings) {
  const playerData = mpPlayers.find(p => p.isPlayer);
  const isPlayerWin = winner && winner.isPlayer;

  document.getElementById('mpr-emoji').textContent = isPlayerWin ? '🏆' : (winner ? '💀' : '🤝');
  document.getElementById('mpr-title').textContent = isPlayerWin ? 'YOU WON!' : (winner ? 'BOT WINS' : 'DRAW');

  const banner = document.getElementById('mpr-winner-banner');
  if (isPlayerWin) {
    banner.textContent = `🏆 YOU WON THE PRIZE POOL! +${playerWinnings} 🪙`;
    banner.style.color = '#4ade80';
    banner.style.borderColor = 'rgba(34,197,94,0.5)';
    banner.style.background = 'rgba(34,197,94,0.1)';
  } else if (winner) {
    banner.textContent = `${winner.avatar} ${winner.name} (${MP_TIERS[winner.tierIdx].badge}) wins the pool!`;
    banner.style.color = '#fde68a';
    banner.style.borderColor = '';
    banner.style.background = '';
  } else {
    banner.textContent = '🤝 No full house — nobody wins the pool.';
    banner.style.color = '#94a3b8';
  }

  document.getElementById('mpr-bet').textContent   = `${MP_TIERS[playerData.tierIdx].amount} 🪙`;
  document.getElementById('mpr-win').textContent   = `${playerWinnings} 🪙`;
  document.getElementById('mpr-lines').textContent = playerData.lines;
  document.getElementById('mpr-drawn').textContent = mpDrawCount;

  // Standings
  const sorted = [...mpPlayers].sort((a,b) => {
    if (a.eliminated && !b.eliminated) return -1;
    if (!a.eliminated && b.eliminated) return 1;
    return b.lines - a.lines || b.marked.size - a.marked.size;
  });

  const standList = document.getElementById('mpr-standings-list');
  standList.innerHTML = '';
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'mpr-standing-row';
    if (p.isPlayer)        row.classList.add('is-player');
    if (p === winner)      row.classList.add('is-winner');

    const medals = ['🥇','🥈','🥉'];
    const rankTxt = i < 3 ? medals[i] : `#${i+1}`;
    row.innerHTML = `
      <span class="mpr-rank">${rankTxt}</span>
      <span class="mpr-s-avatar">${p.avatar}</span>
      <span class="mpr-s-name">${p.name}${p.isPlayer?' 👤':''}</span>
      <span class="mpr-s-lines">${p.lines}L</span>
      <span class="mpr-s-tier">${MP_TIERS[p.tierIdx].badge}</span>
    `;
    standList.appendChild(row);
  });

  mpShowScreen('screen-mp-result');
}

/* ── Start lobby flow ── */
function mpStartLobby() {
  // Clear any lingering timers
  mpLobbyTimers.forEach(clearTimeout);
  mpLobbyTimers = [];

  // Reset lobby UI
  const lobbyList = document.getElementById('lobby-players-list');
  if (lobbyList) lobbyList.innerHTML = '';
  const cdWrap = document.getElementById('lobby-countdown-wrap');
  if (cdWrap) cdWrap.classList.add('hidden');
  document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('selected'));

  const prizeEl = document.getElementById('lobby-prize-val');
  if (prizeEl) prizeEl.textContent = '0 🪙';

  mpBetTierIdx = -1;
  mpShowScreen('screen-lobby');
}

/* ── Player selects tier → build lobby ── */
function mpSelectTier(tierIdx) {
  const tierDef = MP_TIERS[tierIdx];
  const c = getCoins();
  if (c < tierDef.amount) {
    showNotification('NOT ENOUGH COINS!');
    return;
  }

  // Clear previous
  mpLobbyTimers.forEach(clearTimeout);
  mpLobbyTimers = [];

  mpBetTierIdx = tierIdx;
  document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.tier-btn[data-tier="${tierIdx}"]`).classList.add('selected');

  // Build 9 bots
  const botNames   = shuffle([...MP_BOT_NAMES]);
  const botAvatars = shuffle([...MP_BOT_AVATARS]);
  mpPlayers = [];

  // Player first
  mpPlayers.push({
    name: nickname, avatar: '👤', tierIdx,
    isPlayer: true, lucky: false,
    card: generateMPCard(tierDef.freqNums, false),
    marked: new Set(['2,2']),
    completedLines: new Set(),
    lines: 0, eliminated: false
  });

  // 9 bots with staggered join animation
  const lobbyList = document.getElementById('lobby-players-list');
  if (lobbyList) lobbyList.innerHTML = '';

  // Add player row immediately
  mpAddLobbyRow(mpPlayers[0]);

  // Stagger bot entries
  for (let i = 0; i < 9; i++) {
    const t = setTimeout(() => {
      const bTierIdx  = mpPickBotTier();
      const bTierDef  = MP_TIERS[bTierIdx];
      const lucky     = Math.random() < 0.25;
      const bot = {
        name: botNames[i], avatar: botAvatars[i], tierIdx: bTierIdx,
        isPlayer: false, lucky,
        card: generateMPCard(bTierDef.freqNums, lucky),
        marked: new Set(['2,2']),
        completedLines: new Set(),
        lines: 0, eliminated: false
      };
      mpPlayers.push(bot);

      // Update prize pool
      mpPrizePool = Math.floor(mpPlayers.reduce((s,p) => s + MP_TIERS[p.tierIdx].amount, 0) * 0.9);
      const prizeEl = document.getElementById('lobby-prize-val');
      if (prizeEl) prizeEl.textContent = `${mpPrizePool} 🪙`;

      mpAddLobbyRow(bot);

      // After all 9 bots join, start countdown
      if (mpPlayers.length === 10) {
        mpStartLobbyCountdown();
      }
    }, (i + 1) * 600 + Math.random() * 400);
    mpLobbyTimers.push(t);
  }
}

function mpAddLobbyRow(player) {
  const lobbyList = document.getElementById('lobby-players-list');
  if (!lobbyList) return;
  const row = document.createElement('div');
  row.className = 'lobby-player-row' + (player.isPlayer ? ' is-player' : '');
  const tierDef = MP_TIERS[player.tierIdx];
  row.innerHTML = `
    <span class="lpr-avatar">${player.avatar}</span>
    <span class="lpr-name">${player.name}</span>
    <span class="lpr-tier">${tierDef.badge} ${tierDef.label}</span>
    ${player.isPlayer ? '<span class="lpr-you">YOU</span>' : ''}
  `;
  lobbyList.appendChild(row);
}

function mpStartLobbyCountdown() {
  const wrap = document.getElementById('lobby-countdown-wrap');
  const cdEl = document.getElementById('lobby-countdown');
  const backBtn = document.getElementById('lobby-back-btn');
  if (wrap) wrap.classList.remove('hidden');
  if (backBtn) backBtn.disabled = true;

  let count = 5;
  if (cdEl) cdEl.textContent = count;

  function tick() {
    count--;
    if (cdEl) cdEl.textContent = count;
    if (count <= 0) {
      mpStartGame();
      return;
    }
    const t = setTimeout(tick, 1000);
    mpLobbyTimers.push(t);
  }
  const t0 = setTimeout(tick, 1000);
  mpLobbyTimers.push(t0);
}

/* ── Start the actual MP game ── */
function mpStartGame() {
  const playerData = mpPlayers.find(p => p.isPlayer);
  const tierDef    = MP_TIERS[playerData.tierIdx];

  // Deduct bet from player coins
  const c = getCoins();
  setCoins(c - tierDef.amount);

  // Draw sequence
  mpAllNumbers    = generateMPDrawSequence();
  mpDrawnNums     = new Set();
  mpDrawCount     = 0;
  mpWinner        = null;
  mpGameActive    = true;
  mpPlayerLines   = 0;
  mpLineBonusPaid = false;
  mpAutoMarks     = tierDef.autoMark ? 3 : 0; // ROYAL gets 3 auto-marks

  // Draw interval: base speed modified by tier speed multiplier
  const drawMs = Math.round(MP_BASE_INTERVAL / tierDef.speedMult);

  // Set up your tier label
  const tierEl = document.getElementById('mp-your-tier');
  if (tierEl) tierEl.textContent = `${tierDef.badge} ${tierDef.label} · ${tierDef.amount} 🪙`;

  // Build screens
  mpBuildPlayerCard();
  mpBuildBotsGrid();
  mpUpdatePrizeDisplay();

  // Clear history/displays
  const mph = document.getElementById('mph-balls');
  if (mph) mph.innerHTML = '';
  const cdL = document.getElementById('mp-cd-letter');
  const cdN = document.getElementById('mp-cd-number');
  if (cdL) { cdL.textContent = '?'; cdL.className = ''; }
  if (cdN) { cdN.textContent = '--'; cdN.className = ''; }
  const linesEl = document.getElementById('mp-your-lines');
  if (linesEl) linesEl.textContent = '0 lines';
  const dispEl = document.getElementById('mp-win-lines-display');
  if (dispEl) dispEl.textContent = '';
  const nlEl = document.getElementById('mp-numbers-left');
  if (nlEl) nlEl.textContent = '75 left';
  const peekPanel = document.getElementById('mp-peek-panel');
  if (peekPanel) { peekPanel.classList.toggle('hidden', tierDef.peekCount === 0); }
  mpUpdatePeek();

  mpShowScreen('screen-mp-game');

  // Start draw loop
  clearInterval(mpDrawTimer);
  mpDrawTimer = setInterval(mpDrawNext, drawMs);
}

/* ── Event listeners: lobby ── */
function mpInitEvents() {
  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const mode = btn.dataset.mode;
      const soloSections = document.getElementById('solo-sections');
      const mpRow = document.getElementById('mp-start-row');
      if (mode === 'solo') {
        soloSections.classList.remove('hidden');
        mpRow.classList.add('hidden');
      } else {
        soloSections.classList.add('hidden');
        mpRow.classList.remove('hidden');
      }
    });
  });

  // Enter lobby
  const lobbyBtn = document.getElementById('enter-lobby-btn');
  if (lobbyBtn) lobbyBtn.addEventListener('click', mpStartLobby);

  // Tier buttons in lobby
  document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = parseInt(btn.dataset.tier, 10);
      // Check affordability
      if (getCoins() < MP_TIERS[t].amount) {
        showNotification('NOT ENOUGH COINS!');
        return;
      }
      mpSelectTier(t);
    });
  });

  // Lobby back button
  const backBtn = document.getElementById('lobby-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => {
    mpLobbyTimers.forEach(clearTimeout);
    mpLobbyTimers = [];
    mpShowScreen('screen-start');
  });

  // MP quit
  const quitBtn = document.getElementById('mp-quit-btn');
  if (quitBtn) quitBtn.addEventListener('click', () => {
    if (!mpGameActive) return;
    clearInterval(mpDrawTimer);
    mpGameActive = false;
    // Treat as loss — consolation
    const playerData  = mpPlayers.find(p => p.isPlayer);
    const consolation = Math.floor(MP_TIERS[playerData.tierIdx].amount * 0.20);
    setCoins(getCoins() + consolation);
    mpSaveStats(null, consolation, MP_TIERS[playerData.tierIdx]);
    mpShowResult(null, consolation);
  });

  // MP result buttons
  document.getElementById('mp-play-again-btn').addEventListener('click', () => {
    if (mpBetTierIdx < 0) { mpStartLobby(); return; }
    const tierDef = MP_TIERS[mpBetTierIdx];
    if (getCoins() < tierDef.amount) { mpStartLobby(); return; }
    mpSelectTier(mpBetTierIdx);
    mpShowScreen('screen-lobby');
  });

  document.getElementById('mp-change-tier-btn').addEventListener('click', () => {
    mpStartLobby();
  });

  document.getElementById('mp-go-solo-btn').addEventListener('click', () => {
    // Reset mode buttons to SOLO
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.mode === 'solo');
    });
    document.getElementById('solo-sections').classList.remove('hidden');
    document.getElementById('mp-start-row').classList.add('hidden');
    mpShowScreen('screen-start');
    showStart();
  });
}

// =============================================
// INIT
// =============================================

window.addEventListener('DOMContentLoaded', () => {
  nickname = localStorage.getItem('portal_nickname') || 'PLAYER';
  mpInitEvents();
  showStart();
});

(function () {
  'use strict';
  let _timerWasPaused = false;
  function openExitDialog() {
    const msgEl = document.getElementById('exit-confirm-msg');
    if (mpGameActive) {
      clearInterval(mpDrawTimer);
      _timerWasPaused = true;
      const tierDef = mpPlayers.length ? MP_TIERS[mpPlayers.find(p=>p.isPlayer).tierIdx] : null;
      msgEl.innerHTML = tierDef
        ? `⚠️ Vei pierde miza de <strong style="color:#f59e0b">${tierDef.amount} 🪙</strong>!<br>Sigur vrei sa iesi?`
        : 'Progresul curent se va salva.';
    } else if (gameActive && bet > 0) {
      clearInterval(drawTimer);
      _timerWasPaused = true;
      msgEl.innerHTML = `⚠️ Vei pierde miza de <strong style="color:#f59e0b">${bet} 🪙</strong>!<br>Sigur vrei sa iesi?`;
    } else {
      msgEl.textContent = 'Progresul curent se va salva.';
    }
    document.getElementById('exit-confirm').classList.remove('hidden');
  }
  function closeExitDialog() {
    document.getElementById('exit-confirm').classList.add('hidden');
    if (_timerWasPaused) {
      _timerWasPaused = false;
      if (mpGameActive) {
        const playerData = mpPlayers.find(p => p.isPlayer);
        const drawMs = Math.round(MP_BASE_INTERVAL / MP_TIERS[playerData.tierIdx].speedMult);
        mpDrawTimer = setInterval(mpDrawNext, drawMs);
      } else if (gameActive) {
        drawTimer = setInterval(drawNext, drawIntervalMs);
      }
    }
  }
  function confirmExit() {
    window.location.href = '/';
  }
  document.getElementById('exit-portal-btn').addEventListener('click', openExitDialog);
  document.getElementById('exit-confirm-no').addEventListener('click', closeExitDialog);
  document.getElementById('exit-confirm-yes').addEventListener('click', confirmExit);
})();
