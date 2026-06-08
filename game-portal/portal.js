'use strict';

// ════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════

const AVATARS = [
    '🎮','👾','🦊','🐉','⚡','🔥','🌙','🦁','🤖','🎯',
    '👑','💎','🚀','🌟','🐍','🔢','⭕','🎲','🦋','🐲',
    '🧙','🦅','🐺','🌊','🏆','🫧','🦈','🌈','⚔','🎪',
];

const XP_THRESHOLDS = [
    0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
    4000, 5000, 6200, 7600, 9200, 11000, 13200, 15800, 18800, 22300,
];

const DAILY_REWARDS = [
    { xp: 10,  coins: 5,  special: false },  // Day 1
    { xp: 20,  coins: 10, special: false },  // Day 2
    { xp: 30,  coins: 15, special: true  },  // Day 3 — badge
    { xp: 50,  coins: 20, special: false },  // Day 4
    { xp: 75,  coins: 30, special: false },  // Day 5
    { xp: 100, coins: 40, special: false },  // Day 6
    { xp: 150, coins: 50, special: true  },  // Day 7+
];

const ACHIEVEMENTS = [
    // ── GLOBAL ────────────────────────────────────────────
    { id: 'g_welcome',        cat: 'global', icon: '👋', name: 'Welcome!',        desc: 'Enter the Arcade Portal for the first time',   xp: 25,   rarity: 'common'    },
    { id: 'g_trifecta',       cat: 'global', icon: '🎯', name: 'Trifecta',         desc: 'Play all 3 classic games at least once',       xp: 100,  rarity: 'rare'      },
    { id: 'g_quad',           cat: 'global', icon: '🎪', name: 'Quad Player',      desc: 'Play all 4 games at least once',               xp: 150,  rarity: 'rare'      },
    { id: 'g_veteran',        cat: 'global', icon: '🎖', name: 'Veteran',          desc: 'Play 50 or more games total',                  xp: 150,  rarity: 'rare'      },
    { id: 'g_collector',      cat: 'global', icon: '💎', name: 'Collector',        desc: 'Unlock 10 achievements',                       xp: 150,  rarity: 'epic'      },
    { id: 'g_legend',         cat: 'global', icon: '👑', name: 'Legend',           desc: 'Reach Level 10',                               xp: 300,  rarity: 'epic'      },
    { id: 'g_completionist',  cat: 'global', icon: '🌟', name: 'Completionist',    desc: 'Unlock 20 achievements',                       xp: 500,  rarity: 'legendary' },
    { id: 'g_earlybird',      cat: 'global', icon: '🌅', name: 'Early Bird',       desc: 'Login 7 days in a row',                        xp: 200,  rarity: 'rare'      },
    { id: 'g_dedicated',      cat: 'global', icon: '🔥', name: 'Dedicated',        desc: 'Login 30 days in a row',                       xp: 1000, rarity: 'legendary' },
    { id: 'g_portal_master',  cat: 'global', icon: '🎯', name: 'Portal Master',    desc: 'Play all 4 games in the same day',             xp: 300,  rarity: 'epic'      },

    // ── SNAKE ──────────────────────────────────────────────
    { id: 's_hatchling',  cat: 'snake', icon: '🐣', name: 'Hatchling',   desc: 'Score 5 points in Snake',        xp: 25,  rarity: 'common'   },
    { id: 's_serpent',    cat: 'snake', icon: '🐍', name: 'Serpent',     desc: 'Score 25 points in Snake',       xp: 50,  rarity: 'common'   },
    { id: 's_king_cobra', cat: 'snake', icon: '🦎', name: 'King Cobra',  desc: 'Score 50 points in Snake',       xp: 75,  rarity: 'uncommon' },
    { id: 's_anaconda',   cat: 'snake', icon: '🐲', name: 'Anaconda',    desc: 'Score 100 points in Snake',      xp: 150, rarity: 'rare'     },
    { id: 's_titan',      cat: 'snake', icon: '💀', name: 'Titan',       desc: 'Score 200 points in Snake',      xp: 300, rarity: 'epic'     },
    { id: 's_survivor',   cat: 'snake', icon: '🛡', name: 'Survivor',    desc: 'Play 10 Snake games',            xp: 50,  rarity: 'common'   },
    { id: 's_marathoner', cat: 'snake', icon: '🏃', name: 'Marathoner',  desc: 'Play 50 Snake games',            xp: 100, rarity: 'uncommon' },
    { id: 's_speedster',  cat: 'snake', icon: '⚡', name: 'Speedster',   desc: 'Use the Speed power-up',         xp: 30,  rarity: 'common'   },
    { id: 's_ghost',      cat: 'snake', icon: '👻', name: 'Ghost Rider', desc: 'Use Ghost Mode power-up',        xp: 30,  rarity: 'common'   },
    { id: 's_magnet',     cat: 'snake', icon: '🧲', name: 'Magnetized',  desc: 'Use the Magnet power-up',        xp: 30,  rarity: 'common'   },
    { id: 's_maze',       cat: 'snake', icon: '🌀', name: 'Maze Runner', desc: 'Play Maze mode',                 xp: 75,  rarity: 'uncommon' },

    // ── ULTRA 2048 ─────────────────────────────────────────
    { id: 'u_first_tile', cat: 'ultra', icon: '🔢', name: 'First Steps',  desc: 'Play Ultra 2048 for the first time', xp: 25,  rarity: 'common'   },
    { id: 'u_512',        cat: 'ultra', icon: '🟦', name: '512 Club',     desc: 'Reach tile value 512',               xp: 50,  rarity: 'common'   },
    { id: 'u_1024',       cat: 'ultra', icon: '🔷', name: '1K Club',      desc: 'Reach tile value 1024',              xp: 75,  rarity: 'uncommon' },
    { id: 'u_2048',       cat: 'ultra', icon: '🏅', name: '2048!',        desc: 'Reach tile value 2048',              xp: 150, rarity: 'rare'     },
    { id: 'u_4096',       cat: 'ultra', icon: '🥇', name: 'Beyond 2048',  desc: 'Reach tile value 4096',              xp: 250, rarity: 'epic'     },
    { id: 'u_prestige',   cat: 'ultra', icon: '✨', name: 'Prestige',     desc: 'Complete your first prestige',       xp: 300, rarity: 'epic'     },
    { id: 'u_wealthy',    cat: 'ultra', icon: '🪙', name: 'Wealthy',      desc: 'Accumulate 100 coins',               xp: 75,  rarity: 'uncommon' },
    { id: 'u_rich',       cat: 'ultra', icon: '💰', name: 'Rich',         desc: 'Accumulate 500 coins',               xp: 150, rarity: 'rare'     },
    { id: 'u_tycoon',     cat: 'ultra', icon: '🏦', name: 'Tycoon',       desc: 'Accumulate 1000 coins in Ultra 2048',xp: 250, rarity: 'epic'     },
    { id: 'u_shopkeeper', cat: 'ultra', icon: '🛒', name: 'Shopkeeper',   desc: 'Buy 5 items from the shop',          xp: 100, rarity: 'uncommon' },

    // ── VOID SHIFT ─────────────────────────────────────────
    { id: 'v_initiate',    cat: 'void', icon: '⚫', name: 'Initiate',      desc: 'Score 1,000 in Void Shift',         xp: 25,  rarity: 'common'   },
    { id: 'v_adept',       cat: 'void', icon: '🌀', name: 'Adept',         desc: 'Score 5,000 in Void Shift',         xp: 75,  rarity: 'uncommon' },
    { id: 'v_void_walker', cat: 'void', icon: '⚡', name: 'Void Walker',   desc: 'Score 15,000 in Void Shift',        xp: 150, rarity: 'rare'     },
    { id: 'v_cosmic',      cat: 'void', icon: '🌌', name: 'Cosmic',        desc: 'Score 50,000 in Void Shift',        xp: 300, rarity: 'epic'     },
    { id: 'v_chain_3',     cat: 'void', icon: '🔗', name: 'Chain Reaction',desc: 'Achieve a 3× chain merge',          xp: 50,  rarity: 'common'   },
    { id: 'v_chain_5',     cat: 'void', icon: '⛓', name: 'Chain Master',  desc: 'Achieve a 5× chain merge',          xp: 150, rarity: 'rare'     },
    { id: 'v_level_5',     cat: 'void', icon: '🎮', name: 'Void Level 5',  desc: 'Reach Level 5 in Void Shift',       xp: 100, rarity: 'uncommon' },

    // ── BLOB EATER ─────────────────────────────────────────
    { id: 'b_first',    cat: 'blob', icon: '🫧', name: 'Blobber',       desc: 'Play Blob Eater for the first time',  xp: 25,  rarity: 'common' },
    { id: 'b_mass100',  cat: 'blob', icon: '🔵', name: 'Growing Fast',  desc: 'Reach mass 100 in Blob Eater',        xp: 50,  rarity: 'common' },
    { id: 'b_mass500',  cat: 'blob', icon: '🟣', name: 'Big Boy',       desc: 'Reach mass 500 in Blob Eater',        xp: 100, rarity: 'uncommon'},
    { id: 'b_king',     cat: 'blob', icon: '👑', name: 'Blob King',     desc: 'Reach mass 5000 in Blob Eater',       xp: 200, rarity: 'epic'   },
    { id: 'b_survivor', cat: 'blob', icon: '⏱',  name: 'Blob Survivor', desc: 'Survive 5 minutes in Blob Eater',     xp: 150, rarity: 'rare'   },

    // ── ARCADE BINGO ───────────────────────────────────────
    { id: 'bi_first',         cat: 'bingo', icon: '🎰', name: 'First Bet',      desc: 'Play your first Bingo game',                            xp: 25,   rarity: 'common'    },
    { id: 'bi_highroller',    cat: 'bingo', icon: '💰', name: 'High Roller',    desc: 'Bet 100 coins in a Bingo game',                         xp: 100,  rarity: 'rare'      },
    { id: 'bi_jackpot',       cat: 'bingo', icon: '🏆', name: 'Jackpot!',       desc: 'Win a Bingo jackpot',                                   xp: 500,  rarity: 'legendary' },
    { id: 'bi_lucky_streak',  cat: 'bingo', icon: '🍀', name: 'Lucky Streak',   desc: 'Win 3 Bingo games in a row',                            xp: 200,  rarity: 'epic'      },
    { id: 'bi_master',        cat: 'bingo', icon: '🎲', name: 'Bingo Master',   desc: 'Play 50 Bingo games',                                   xp: 300,  rarity: 'epic'      },
    { id: 'bi_mp_highstakes', cat: 'bingo', icon: '👑', name: 'High Stakes',    desc: 'Win a Jackpot Battle with the ROYAL bet tier',          xp: 1000, rarity: 'legendary' },
    { id: 'bi_mp_comeback',   cat: 'bingo', icon: '⚔️', name: 'Comeback King',  desc: 'Win a Jackpot Battle after 3+ bots have a line',        xp: 500,  rarity: 'epic'      },
    { id: 'bi_mp_whale',      cat: 'bingo', icon: '🐋', name: 'Whale',          desc: 'Spend 1000 coins total in Jackpot Battle mode',         xp: 300,  rarity: 'rare'      },

    // ── GLOBAL (5-game) ────────────────────────────────────
    { id: 'g_penta', cat: 'global', icon: '🌟', name: 'Penta Player',   desc: 'Play all 5 arcade games at least once', xp: 250, rarity: 'epic' },

    // ── TOWER RUSH ─────────────────────────────────────────
    { id: 't_wave5',    cat: 'tower', icon: '🏰', name: 'First Stand',    desc: 'Survive Wave 5 in Tower Rush',                     xp: 100,  rarity: 'uncommon'  },
    { id: 't_wave15',   cat: 'tower', icon: '⚔️', name: 'Wave 15',        desc: 'Survive 15 waves in Tower Rush',                   xp: 400,  rarity: 'epic'      },
    { id: 't_no_leak',  cat: 'tower', icon: '🛡️', name: 'Impenetrable',   desc: 'Complete 10 waves without base taking damage',      xp: 500,  rarity: 'epic'      },
    { id: 't_100kills', cat: 'tower', icon: '💀', name: 'Centurion',      desc: 'Reach 100 total enemy kills in Tower Rush',         xp: 150,  rarity: 'rare'      },
    { id: 't_boss',     cat: 'tower', icon: '👹', name: 'Boss Slayer',    desc: 'Kill your first boss in Tower Rush',                xp: 200,  rarity: 'rare'      },

    // ── NEW GLOBAL ─────────────────────────────────────────
    { id: 'g_sound_master',  cat: 'global', icon: '🔊', name: 'Sound Master',  desc: 'Adjust the volume 10 times',                  xp: 50,   rarity: 'common'    },
    { id: 'g_stats_nerd',    cat: 'global', icon: '📊', name: 'Stats Nerd',    desc: 'Visit the Stats page 20 times',               xp: 100,  rarity: 'uncommon'  },
    { id: 'g_event_chaser',  cat: 'global', icon: '🎪', name: 'Event Chaser',  desc: 'Play during 3 different weekly events',       xp: 300,  rarity: 'rare'      },
    { id: 'g_shop_addict',   cat: 'global', icon: '🛒', name: 'Shop Addict',   desc: 'Buy 20 items from the Portal Shop',           xp: 300,  rarity: 'rare'      },

    // ── NEW SNAKE ──────────────────────────────────────────
    { id: 's_speed_demon',   cat: 'snake', icon: '💨', name: 'Speed Demon',   desc: 'Score 200 in Time Attack mode',               xp: 300,  rarity: 'epic'      },
    { id: 's_untouchable',   cat: 'snake', icon: '🧊', name: 'Untouchable',   desc: 'Complete a Snake game without any power-ups', xp: 200,  rarity: 'rare'      },

    // ── NEW ULTRA 2048 ─────────────────────────────────────
    { id: 'u_prestige_3',    cat: 'ultra', icon: '✨', name: 'Prestige Master', desc: 'Reach Prestige 3 in Ultra 2048',             xp: 1000, rarity: 'legendary' },
    { id: 'u_tile_god',      cat: 'ultra', icon: '🌟', name: 'Tile God',        desc: 'Reach tile value 65536 in Ultra 2048',       xp: 500,  rarity: 'legendary' },

    // ── NEW BLOB ───────────────────────────────────────────
    { id: 'b_boss_hunter',   cat: 'blob', icon: '🎯', name: 'Boss Hunter',    desc: 'Slay 10 Elemental Bosses in Blob Evolution',  xp: 500,  rarity: 'epic'      },
    { id: 'b_vortex_surfer', cat: 'blob', icon: '🌀', name: 'Vortex Surfer',  desc: 'Survive 10 Vortex events in Blob Evolution',  xp: 300,  rarity: 'rare'      },
    { id: 'b_ultra_master',  cat: 'blob', icon: '👑', name: 'Ultra Master',   desc: 'Reach Tier 2 with all 5 Blob forms',         xp: 1000, rarity: 'legendary' },

    // ── NEW BINGO ──────────────────────────────────────────
    { id: 'bi_lucky_5',      cat: 'bingo', icon: '🍀', name: 'Lucky 5',       desc: 'Win 5 Bingo games in a row',                  xp: 400,  rarity: 'epic'      },
    { id: 'bi_high_roll_w',  cat: 'bingo', icon: '💎', name: 'High Roller Win', desc: 'Bet 100 coins and win in Bingo',            xp: 300,  rarity: 'rare'      },
];

// ════════════════════════════════════════════════════════
// SHOP ITEMS
// ════════════════════════════════════════════════════════

const SHOP_ITEMS = [
    {
        id:   'xp_boost',
        icon: '⚡',
        name: 'XP BOOST',
        desc: 'Double XP earned in all games for 24 hours. Stackable!',
        cost: 50,
        type: 'timed',   // uses portal_xp_boost_until (timestamp)
        minLevel: 1,
    },
    {
        id:   'snake_revive',
        icon: '💀',
        name: 'SNAKE REVIVE',
        desc: 'Auto-used when you die in Snake. Snake respawns at half score!',
        cost: 30,
        type: 'count',
        lsKey: 'snake_revives',
        max: 5,
        minLevel: 1,
    },
    {
        id:   'random_tile',
        icon: '🎲',
        name: 'RANDOM TILE',
        desc: 'Use in Ultra 2048 to spawn a high-value random tile on the board.',
        cost: 20,
        type: 'count',
        lsKey: () => `u2048_random_tiles_${state.nickname}`,
        max: 10,
        minLevel: 2,
    },
    {
        id:   'bingo_extra_card',
        icon: '🎰',
        name: 'EXTRA BINGO CARD',
        desc: 'Play with 2 cards in your next Bingo game. Wins paid separately!',
        cost: 40,
        type: 'bool',
        lsKey: 'bingo_extra_card',
        minLevel: 3,
    },
    {
        id:   'starter_pack',
        icon: '💫',
        name: 'STARTER PACK',
        desc: '3× Snake Revives + 2× Extra Bingo Cards + 5× Random 2048 Tiles. One purchase!',
        cost: 150,
        type: 'bundle',
        minLevel: 4,
    },
    {
        id:   'double_xp_weekend',
        icon: '🎯',
        name: 'DOUBLE XP WEEKEND',
        desc: '2× XP for 48 hours (instead of 24h). Stackable with existing boosts!',
        cost: 75,
        type: 'timed_48h',
        minLevel: 5,
    },
    {
        id:   'event_token',
        icon: '🎪',
        name: 'EVENT TOKEN',
        desc: 'Activates current weekly event bonuses for you for 24h, even off-schedule.',
        cost: 60,
        type: 'timed_event',
        minLevel: 6,
    },
    {
        id:   'prestige_boost',
        icon: '🌟',
        name: 'PRESTIGE BOOST',
        desc: 'Your next prestige in any game grants 2× bonus rewards. One-time use.',
        cost: 100,
        type: 'bool',
        lsKey: 'portal_prestige_boost',
        minLevel: 8,
    },
];

const RARITY_COLORS = {
    common:    '#9ca3af',
    uncommon:  '#4ade80',
    rare:      '#60a5fa',
    epic:      '#c084fc',
    legendary: '#fbbf24',
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════

let state = {
    nickname:     '',
    avatar:       '🎮',
    theme:        'galaxy',
    currentPage:  'home',
    achievements: {},
};

let currentLBGame    = 'snake';
let currentAchFilter = 'all';
let toastQueue       = [];
let toastShowing     = false;
let dailyClaimed     = false;

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════

function init() {
    const nick         = localStorage.getItem('portal_nickname');
    const theme        = localStorage.getItem('portal_theme')   || 'galaxy';
    const avatar       = localStorage.getItem('portal_avatar')  || '🎮';
    const achievements = JSON.parse(localStorage.getItem('portal_achievements') || '{}');

    state.theme        = theme;
    state.avatar       = avatar;
    state.achievements = achievements;

    applyTheme(theme);
    initDayMode();
    setupEventListeners();

    if (!nick) {
        document.getElementById('nickname-overlay').style.display = 'flex';
    } else {
        state.nickname = nick;
        launchPortal();
    }
}

function launchPortal() {
    document.getElementById('nickname-overlay').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    syncNicknameToGames();
    initSounds();
    setupKeyboardShortcuts();
    refreshAll();
    navigate('home');
    // Daily login — slight delay so page renders first
    setTimeout(checkDailyLogin, 800);
}

function saveState() {
    localStorage.setItem('portal_achievements', JSON.stringify(state.achievements));
    localStorage.setItem('portal_theme',        state.theme);
    localStorage.setItem('portal_avatar',       state.avatar);
}

function syncNicknameToGames() {
    const n = state.nickname;
    localStorage.setItem('portal_nickname', n);
    localStorage.setItem('snakeNickname',   n);
    localStorage.setItem('u2048_nickname',  n);
    localStorage.setItem('voidshift_nick',  n);
}

// ════════════════════════════════════════════════════════
// READ GAME STATS
// ════════════════════════════════════════════════════════

function readGameStats() {
    const nick = state.nickname;
    return {
        snake: {
            best:  parseInt(localStorage.getItem('snakeHighScore')) || 0,
            games: parseInt(localStorage.getItem('snakeGames'))     || 0,
        },
        ultra: {
            best:      parseInt(localStorage.getItem(`u2048_best_${nick}`))       || 0,
            coins:     parseInt(localStorage.getItem(`u2048_coins_${nick}`))      || 0,
            maxTile:   parseInt(localStorage.getItem(`u2048_max_tile_${nick}`))   || 0,
            prestige:  parseInt(localStorage.getItem(`u2048_prestige_${nick}`))   || 0,
            shopTotal: parseInt(localStorage.getItem(`u2048_shop_total_${nick}`)) || 0,
            dailyDone: !!localStorage.getItem(`u2048_daily_done_${nick}`),
            games:     parseInt(localStorage.getItem(`u2048_games_${nick}`))      || 0,
        },
        void: {
            best:     parseInt(localStorage.getItem(`voidshift_best_${nick}`))      || 0,
            level:    parseInt(localStorage.getItem(`voidshift_level_${nick}`))     || 1,
            maxChain: parseInt(localStorage.getItem(`voidshift_max_chain_${nick}`)) || 0,
            games:    parseInt(localStorage.getItem(`voidshift_games_${nick}`))     || 0,
        },
        blob: {
            best:         parseInt(localStorage.getItem('blobevo_best'))               || 0,
            games:        parseInt(localStorage.getItem('blobevo_games'))              || 0,
            king:         (parseInt(localStorage.getItem('blobevo_best')) || 0) >= 5000,
            survived5:    !!localStorage.getItem('blobevo_survived_5min'),
            bossKills:    parseInt(localStorage.getItem('blobevo_bosses_killed'))      || 0,
            vortexCount:  parseInt(localStorage.getItem('blobevo_vortexes_survived'))  || 0,
            tier2All:     !!localStorage.getItem('blobevo_tier2_all_forms'),
        },
        bingo: {
            totalWon:      parseInt(localStorage.getItem('bingo_total_won'))         || 0,
            games:         parseInt(localStorage.getItem('bingo_games'))             || 0,
            jackpots:      parseInt(localStorage.getItem('bingo_jackpots'))          || 0,
            highRoll:      !!localStorage.getItem('bingo_highroller'),
            highRollWin:   !!localStorage.getItem('bingo_highroller_win'),
            luckyStreak:   parseInt(localStorage.getItem('bingo_lucky_streak')      || '0'),
            luckyStreak5:  parseInt(localStorage.getItem('bingo_lucky_streak')      || '0') >= 5,
            mpWinRoyal:    !!localStorage.getItem('bingo_mp_win_royal'),
            mpComeback:    !!localStorage.getItem('bingo_mp_comeback'),
            mpTotalSpent:  parseInt(localStorage.getItem('bingo_mp_total_spent')    || '0'),
        },
        tower: {
            bestLevel:parseInt(localStorage.getItem(`tower_best_level_${nick}`))  || 0,
            bestWave: parseInt(localStorage.getItem(`tower_best_wave_${nick}`))   || 0,
            kills:    parseInt(localStorage.getItem(`tower_total_kills_${nick}`)) || 0,
            games:    parseInt(localStorage.getItem(`tower_games_${nick}`))       || 0,
            bossKills:parseInt(localStorage.getItem(`tower_bosses_killed_${nick}`))|| 0,
            pulls:    parseInt(localStorage.getItem(`tower_total_pulls_${nick}`)) || 0,
        },
        streak: parseInt(localStorage.getItem('portal_streak') || '0'),
    };
}

// ════════════════════════════════════════════════════════
// DAILY LOGIN
// ════════════════════════════════════════════════════════

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function checkDailyLogin() {
    if (!state.nickname) return;
    const today     = todayISO();
    const lastLogin = localStorage.getItem('portal_last_login');
    if (lastLogin === today) return;          // already claimed today

    const yd = new Date(Date.now() - 86_400_000);
    const yesterday = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
    const oldStreak = parseInt(localStorage.getItem('portal_streak') || '0');
    const newStreak = lastLogin === yesterday ? oldStreak + 1 : 1;

    localStorage.setItem('portal_last_login', today);
    localStorage.setItem('portal_streak',     String(newStreak));

    const idx     = Math.min(newStreak - 1, DAILY_REWARDS.length - 1);
    const reward  = DAILY_REWARDS[idx];

    // Apply level-based coin multiplier
    const mult       = getCoinMultiplier();
    const bonusCoins = Math.round(reward.coins * mult);

    // Award bonus XP
    const bonusXP = parseInt(localStorage.getItem('portal_bonus_xp') || '0');
    localStorage.setItem('portal_bonus_xp', String(bonusXP + reward.xp));

    // Award coins (with level multiplier) → sync with 2048
    const coins = parseInt(localStorage.getItem(`u2048_coins_${state.nickname}`) || '0');
    localStorage.setItem(`u2048_coins_${state.nickname}`, String(coins + bonusCoins));

    addNotification('🎁', `Daily reward ready! Day ${newStreak} streak.`);
    showDailyPopup(newStreak, reward, bonusCoins, mult);
    setTimeout(() => {
        showPortalToast(`🔥 Day ${newStreak} streak! +${reward.xp} XP & +${bonusCoins} 🪙${mult > 1 ? ` (lvl bonus!)` : ''}`, '🎁', 'streak');
    }, 800);
}

function showDailyPopup(streak, reward, bonusCoins, mult) {
    const actualCoins = bonusCoins !== undefined ? bonusCoins : reward.coins;
    const m           = mult !== undefined ? mult : 1;
    document.getElementById('dr-streak-num').textContent = streak;
    document.getElementById('dr-xp').textContent         = reward.xp;
    document.getElementById('dr-coins').textContent      = actualCoins;
    document.getElementById('dr-special').classList.toggle('hidden', !reward.special);
    // Show multiplier badge if level bonus applied
    const multEl = document.getElementById('dr-mult');
    if (multEl) {
        multEl.textContent = m > 1 ? `×${m.toFixed(2).replace(/\.?0+$/, '')} LVL BONUS` : '';
        multEl.classList.toggle('hidden', m <= 1);
    }

    const popup = document.getElementById('daily-popup');
    popup.classList.remove('hidden');
    popup.classList.add('show');
}

// ════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ════════════════════════════════════════════════════════

function checkAchievements(stats) {
    const newlyUnlocked = [];
    const unlockCount   = Object.keys(state.achievements).length;
    const totalGames    = stats.snake.games + stats.ultra.games + stats.void.games + stats.blob.games + stats.bingo.games;
    const today         = todayISO();

    function tryUnlock(id) {
        if (state.achievements[id]) return;
        let met = false;

        switch (id) {
            // ── Global
            case 'g_welcome':       met = true; break;
            case 'g_trifecta':      met = stats.snake.games > 0 && stats.ultra.games > 0 && stats.void.games > 0; break;
            case 'g_quad':          met = stats.snake.games > 0 && stats.ultra.games > 0 && stats.void.games > 0 && stats.blob.games > 0; break;
            case 'g_penta':         met = stats.snake.games > 0 && stats.ultra.games > 0 && stats.void.games > 0 && stats.blob.games > 0 && stats.bingo.games > 0; break;
            case 'g_veteran':       met = totalGames >= 50; break;
            case 'g_collector':     met = unlockCount >= 10; break;
            case 'g_legend':        met = getLevel(computeXP(stats)) >= 10; break;
            case 'g_completionist': met = unlockCount >= 20; break;
            case 'g_earlybird':     met = stats.streak >= 7; break;
            case 'g_dedicated':     met = stats.streak >= 30; break;
            case 'g_portal_master': {
                const playedToday = ['snake','ultra','blob','void','bingo'].filter(g =>
                    localStorage.getItem(`portal_played_${g}_date`) === today
                );
                met = playedToday.length >= 4;
                break;
            }

            // ── Snake
            case 's_hatchling':  met = stats.snake.best >= 5;   break;
            case 's_serpent':    met = stats.snake.best >= 25;  break;
            case 's_king_cobra': met = stats.snake.best >= 50;  break;
            case 's_anaconda':   met = stats.snake.best >= 100; break;
            case 's_titan':      met = stats.snake.best >= 200; break;
            case 's_survivor':   met = stats.snake.games >= 10; break;
            case 's_marathoner': met = stats.snake.games >= 50; break;
            case 's_speedster':  met = !!localStorage.getItem('snake_powerup_speed_used'); break;
            case 's_ghost':      met = !!localStorage.getItem('snake_powerup_ghost_used'); break;
            case 's_magnet':     met = !!localStorage.getItem('snake_powerup_magnet_used'); break;
            case 's_maze':       met = !!localStorage.getItem('snake_mode_maze_played'); break;

            // ── Ultra 2048
            case 'u_first_tile': met = stats.ultra.games > 0; break;
            case 'u_512':        met = (stats.ultra.maxTile || stats.ultra.best) >= 512;  break;
            case 'u_1024':       met = (stats.ultra.maxTile || stats.ultra.best) >= 1024; break;
            case 'u_2048':       met = (stats.ultra.maxTile || stats.ultra.best) >= 2048; break;
            case 'u_4096':       met = (stats.ultra.maxTile || stats.ultra.best) >= 4096; break;
            case 'u_prestige':   met = stats.ultra.prestige >= 1; break;
            case 'u_wealthy':    met = stats.ultra.coins >= 100;  break;
            case 'u_rich':       met = stats.ultra.coins >= 500;  break;
            case 'u_tycoon':     met = stats.ultra.coins >= 1000; break;
            case 'u_shopkeeper': met = stats.ultra.shopTotal >= 5; break;

            // ── Void Shift
            case 'v_initiate':    met = stats.void.best >= 1000;  break;
            case 'v_adept':       met = stats.void.best >= 5000;  break;
            case 'v_void_walker': met = stats.void.best >= 15000; break;
            case 'v_cosmic':      met = stats.void.best >= 50000; break;
            case 'v_chain_3':     met = stats.void.maxChain >= 3; break;
            case 'v_chain_5':     met = stats.void.maxChain >= 5; break;
            case 'v_level_5':     met = stats.void.level   >= 5; break;

            // ── Blob Eater
            case 'b_first':    met = stats.blob.games > 0;           break;
            case 'b_mass100':  met = stats.blob.best >= 100;         break;
            case 'b_mass500':  met = stats.blob.best >= 500;         break;
            case 'b_king':     met = stats.blob.best >= 5000 || stats.blob.king; break;
            case 'b_survivor': met = stats.blob.survived5;           break;

            // ── Arcade Bingo
            case 'bi_first':         met = stats.bingo.games > 0;                      break;
            case 'bi_highroller':    met = stats.bingo.highRoll;                        break;
            case 'bi_jackpot':       met = stats.bingo.jackpots > 0;                    break;
            case 'bi_lucky_streak':  met = stats.bingo.luckyStreak >= 3;                break;
            case 'bi_master':        met = stats.bingo.games >= 50;                     break;
            case 'bi_mp_highstakes': met = stats.bingo.mpWinRoyal;                      break;
            case 'bi_mp_comeback':   met = stats.bingo.mpComeback;                      break;
            case 'bi_mp_whale':      met = stats.bingo.mpTotalSpent >= 1000;            break;

            // ── Tower Rush
            case 't_wave5':    met = stats.tower.bestWave  >= 5;   break;
            case 't_wave15':   met = stats.tower.bestWave  >= 15;  break;
            case 't_no_leak':  met = !!localStorage.getItem(`tower_no_damage_10_${state.nickname}`); break;
            case 't_100kills': met = stats.tower.kills     >= 100; break;
            case 't_boss':     met = stats.tower.bossKills >= 1;   break;

            // ── New global
            case 'g_sound_master':  met = parseInt(localStorage.getItem('portal_volume_changes') || '0') >= 10; break;
            case 'g_stats_nerd':    met = parseInt(localStorage.getItem('portal_stats_visits')    || '0') >= 20; break;
            case 'g_event_chaser': {
                const evts = JSON.parse(localStorage.getItem('portal_events_participated') || '[]');
                met = new Set(evts).size >= 3;
                break;
            }
            case 'g_shop_addict':   met = parseInt(localStorage.getItem('portal_total_purchases') || '0') >= 20; break;

            // ── New snake
            case 's_speed_demon':  met = !!localStorage.getItem('snake_time_attack_200'); break;
            case 's_untouchable':  met = !!localStorage.getItem('snake_no_powerup_win'); break;

            // ── New ultra 2048
            case 'u_prestige_3': met = stats.ultra.prestige  >= 3;     break;
            case 'u_tile_god':   met = stats.ultra.maxTile   >= 65536; break;

            // ── New blob
            case 'b_boss_hunter':   met = stats.blob.bossKills   >= 10; break;
            case 'b_vortex_surfer': met = stats.blob.vortexCount >= 10; break;
            case 'b_ultra_master':  met = stats.blob.tier2All;           break;

            // ── New bingo
            case 'bi_lucky_5':     met = stats.bingo.luckyStreak5; break;
            case 'bi_high_roll_w': met = stats.bingo.highRollWin;  break;
        }

        if (met) {
            state.achievements[id] = Date.now();
            newlyUnlocked.push(ACHIEVEMENTS.find(a => a.id === id));
        }
    }

    ACHIEVEMENTS.forEach(ach => tryUnlock(ach.id));

    // Second pass — meta achievements depend on unlock count
    if (newlyUnlocked.length > 0) {
        ['g_collector', 'g_completionist'].forEach(id => tryUnlock(id));
    }

    return newlyUnlocked;
}

// ════════════════════════════════════════════════════════
// XP / LEVEL
// ════════════════════════════════════════════════════════

function computeXP(stats) {
    let xp = 0;

    ACHIEVEMENTS.forEach(ach => {
        if (state.achievements[ach.id]) xp += ach.xp;
    });

    // Daily login bonus XP (not boosted — it's already awarded)
    xp += parseInt(localStorage.getItem('portal_bonus_xp') || '0');

    if (stats) {
        // XP boost doubles score-based XP
        const boostUntil = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
        const mult = Date.now() < boostUntil ? 2 : 1;
        xp += Math.min(stats.snake.best * 2,                      200) * mult;
        xp += Math.min(Math.floor(stats.ultra.best / 500),        200) * mult;
        xp += Math.min(Math.floor(stats.void.best  / 250),        200) * mult;
        xp += Math.min(Math.floor(stats.blob.best  / 50),         200) * mult;
        xp += Math.min(Math.floor(stats.bingo.totalWon / 10),     200) * mult;
        xp += Math.min((stats.tower.bestLevel || 0) * 20,         200) * mult; // Tower Rush: 20 XP per level reached
    }

    return xp;
}

function getLevel(xp) {
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= XP_THRESHOLDS[i]) return i + 1;
    }
    return 1;
}

/** Returns total XP for the current player (reads stats from localStorage). */
function getTotalXP() {
    return computeXP(readGameStats());
}

/** Coin multiplier based on level: +5% per level, capped at 3× (level 41). */
function getCoinMultiplier() {
    const level = getLevel(getTotalXP());
    return Math.min(3.0, 1 + (level - 1) * 0.05);
}

/** Format multiplier for display e.g. "×1.35" */
function fmtMult(m) {
    return m === 1 ? '' : ` ×${m.toFixed(2).replace(/\.?0+$/, '')}`;
}

function getLevelProgress(xp) {
    const level   = getLevel(xp);
    const idx     = level - 1;
    if (idx >= XP_THRESHOLDS.length - 1) {
        return { level, current: xp - XP_THRESHOLDS[idx], needed: 1, pct: 100 };
    }
    const current = xp - XP_THRESHOLDS[idx];
    const needed  = XP_THRESHOLDS[idx + 1] - XP_THRESHOLDS[idx];
    const pct     = Math.min(100, Math.floor(current / needed * 100));
    return { level, current, needed, pct };
}

// ════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════

function navigate(page) {
    state.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navBtn) navBtn.classList.add('active');
    renderPage(page);
}

function renderPage(page) {
    const stats = readGameStats();
    updateNavBar(stats);
    switch (page) {
        case 'home':         renderHome(stats);         break;
        case 'profile':      renderProfile(stats);      break;
        case 'achievements': renderAchievements(stats); break;
        case 'stats':
            // Track stats visits for Stats Nerd achievement
            { const sv = parseInt(localStorage.getItem('portal_stats_visits') || '0') + 1;
              localStorage.setItem('portal_stats_visits', String(sv)); }
            renderStats(stats);
            break;
        case 'shop':         renderShop();              break;
        case 'settings':     renderSettings();          break;
    }
}

// ════════════════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════════════════

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === theme);
    });
}

// ════════════════════════════════════════════════════════
// REFRESH
// ════════════════════════════════════════════════════════

function refreshAll() {
    const stats      = readGameStats();
    const prevXP     = computeXP(stats);
    const prevLevel  = getLevel(prevXP);
    const newlyFound = checkAchievements(stats);

    if (newlyFound.length > 0) {
        saveState();
        newlyFound.forEach(ach => {
            showToast(ach);
            playSound(ach.rarity === 'legendary' ? 'levelup' : 'achievement');
            addNotification(ach.icon, `Achievement: ${ach.name}`);
            if (ach.rarity === 'epic' || ach.rarity === 'legendary') {
                flashScreen(ach.rarity === 'legendary' ? '#fbbf24' : '#c084fc');
            }
        });
    }

    // Level-up notification
    const newXP    = computeXP(readGameStats());
    const newLevel = getLevel(newXP);
    if (newLevel > prevLevel) {
        const lastNotifLevel = parseInt(localStorage.getItem('portal_last_notif_level') || '0');
        if (newLevel > lastNotifLevel) {
            localStorage.setItem('portal_last_notif_level', String(newLevel));
            addNotification('⬆️', `You reached Level ${newLevel}!`);
            playSound('levelup');
        }
    }

    updateNavBar(stats);
    renderPage(state.currentPage);
}

function flashScreen(color) {
    const el = document.getElementById('epic-flash');
    el.style.background = color;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 600);
}

// ════════════════════════════════════════════════════════
// RENDER: NAV BAR
// ════════════════════════════════════════════════════════

function updateNavBar(stats) {
    const xp    = computeXP(stats);
    const level = getLevel(xp);
    const coins = parseInt(localStorage.getItem(`u2048_coins_${state.nickname}`) || '0');
    document.getElementById('nav-avatar').textContent = state.avatar;
    document.getElementById('nav-name').textContent   = state.nickname;
    document.getElementById('nav-level').textContent  = `LVL ${level}`;
    document.getElementById('nav-coins').textContent  = `${coins} 🪙`;

    // XP boost badge
    const boostUntil = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
    const boostEl    = document.getElementById('nav-xp-boost');
    if (boostEl) {
        const active = Date.now() < boostUntil;
        boostEl.classList.toggle('hidden', !active);
        if (active) {
            const secsLeft = Math.ceil((boostUntil - Date.now()) / 1000);
            const h = Math.floor(secsLeft / 3600);
            const m = Math.floor((secsLeft % 3600) / 60);
            boostEl.title = `XP Boost active — ${h}h ${m}m left`;
        }
    }

    // Check XP boost expiry notification (< 1 hour)
    if (Date.now() < boostUntil && boostUntil - Date.now() < 3_600_000) {
        const alerted = localStorage.getItem('portal_xp_boost_alert');
        if (alerted !== String(Math.floor(boostUntil / 60000))) {
            localStorage.setItem('portal_xp_boost_alert', String(Math.floor(boostUntil / 60000)));
            addNotification('⚡', 'XP Boost expiring soon! Less than 1 hour left.');
        }
    }

    updateNotifBadge();
}

// ════════════════════════════════════════════════════════
// RENDER: HOME
// ════════════════════════════════════════════════════════

function renderHome(stats) {
    document.getElementById('snake-best').textContent  = stats.snake.best;
    document.getElementById('snake-games').textContent = stats.snake.games;
    document.getElementById('ultra-best').textContent  = formatNum(stats.ultra.best);
    document.getElementById('ultra-coins').textContent = stats.ultra.coins;
    document.getElementById('void-best').textContent   = formatNum(stats.void.best);
    document.getElementById('void-level').textContent  = stats.void.level;
    document.getElementById('blob-best').textContent   = stats.blob.best;
    document.getElementById('blob-games').textContent  = stats.blob.games;
    document.getElementById('bingo-best').textContent  = stats.bingo.totalWon;
    document.getElementById('bingo-games').textContent = stats.bingo.games;
    document.getElementById('tower-best').textContent  = stats.tower.bestWave;
    document.getElementById('tower-kills').textContent = stats.tower.kills;

    // Hero chips
    const totalGames = stats.snake.games + stats.ultra.games + stats.void.games +
                       stats.blob.games + stats.bingo.games + (stats.tower.games || 0);
    const totalAchs  = Object.keys(state.achievements || {}).length;
    const totalCoins = getPortalCoins();
    const gv = document.getElementById('hchip-games-val');
    const av = document.getElementById('hchip-ach-val');
    const cv = document.getElementById('hchip-coins-val');
    if (gv) gv.textContent = totalGames;
    if (av) av.textContent = totalAchs;
    if (cv) cv.textContent = totalCoins;
    showLB(currentLBGame);
    renderSeasonalBanner();
    renderDailyChallenges();
    renderWeeklyProgress();

    // Record today's XP for weekly chart
    recordTodayXP(computeXP(stats));

    // New portal features
    renderSpinCTA();
    renderStreakWidget();
    renderEventSection(stats);
    renderWeeklyEventBanner();

    // Abyss Hunter (fish) — standalone stats, read directly & safely
    const fb = document.getElementById('fish-best');
    const fg = document.getElementById('fish-games');
    if (fb) fb.textContent = formatNum(parseInt(localStorage.getItem(`fishhunter_best_${state.nickname}`)  || '0'));
    if (fg) fg.textContent = parseInt(localStorage.getItem(`fishhunter_games_${state.nickname}`) || '0');
}

// ════════════════════════════════════════════════════════
// RENDER: PROFILE
// ════════════════════════════════════════════════════════

function renderProfile(stats) {
    const xp = computeXP(stats);
    const { level, current, needed, pct } = getLevelProgress(xp);

    document.getElementById('profile-avatar').textContent = state.avatar;
    document.getElementById('profile-name').textContent   = state.nickname;
    document.getElementById('level-text').textContent     = `LEVEL ${level}`;
    document.getElementById('xp-text').textContent        = `${current} / ${needed} XP`;
    document.getElementById('xp-bar').style.width         = `${pct}%`;

    // Streak row
    const streak    = stats.streak;
    const streakRow = document.getElementById('streak-row');
    const streakEl  = document.getElementById('streak-display');
    if (streak >= 2) {
        streakEl.textContent = `🔥 ${streak} Day Streak!`;
        streakRow.classList.remove('hidden');
    } else {
        streakRow.classList.add('hidden');
    }

    // Badges
    const achTotal = Object.keys(state.achievements).length;
    const badges   = [];
    if (level >= 5)                        badges.push({ icon: '🥉', label: 'Intermediate' });
    if (level >= 10)                       badges.push({ icon: '🥈', label: 'Advanced'     });
    if (level >= 15)                       badges.push({ icon: '🥇', label: 'Expert'        });
    if (level >= 20)                       badges.push({ icon: '💎', label: 'Master'        });
    if (achTotal === ACHIEVEMENTS.length)  badges.push({ icon: '🌟', label: 'Completionist' });
    if (stats.snake.best >= 100)           badges.push({ icon: '🐍', label: 'Snake Pro'     });
    if (stats.ultra.best >= 50000)         badges.push({ icon: '🔢', label: '2048 Veteran'  });
    if (stats.void.best  >= 10000)         badges.push({ icon: '⚡', label: 'Void Master'   });
    if (stats.blob.best  >= 1000)          badges.push({ icon: '🫧', label: 'Blob Master'   });
    if (stats.bingo.jackpots > 0)          badges.push({ icon: '🏆', label: 'Jackpot Winner' });
    if (stats.bingo.games >= 50)           badges.push({ icon: '🎰', label: 'Bingo Master'   });
    if (streak >= 7)                       badges.push({ icon: '🔥', label: `${streak} Streak` });

    document.getElementById('profile-badges').innerHTML =
        badges.map(b => `<span class="badge">${b.icon} ${b.label}</span>`).join('');

    // Per-game stat cards
    const achByCat = cat => ACHIEVEMENTS.filter(a => a.cat === cat);
    const unlByCat = cat => achByCat(cat).filter(a => state.achievements[a.id]).length;

    document.getElementById('profile-stats-grid').innerHTML = `
        <div class="profile-stat-card snake-card">
            <div class="psc-header">🐍 SNAKE</div>
            <div class="psc-stats">
                <div class="psc-row"><span>BEST SCORE</span><strong>${stats.snake.best}</strong></div>
                <div class="psc-row"><span>GAMES PLAYED</span><strong>${stats.snake.games}</strong></div>
                <div class="psc-row"><span>ACHIEVEMENTS</span><strong>${unlByCat('snake')} / ${achByCat('snake').length}</strong></div>
            </div>
            <button class="psc-play snake-btn" onclick="openGame('snake')">▶ PLAY SNAKE</button>
        </div>
        <div class="profile-stat-card ultra-card">
            <div class="psc-header">🔢 ULTRA 2048</div>
            <div class="psc-stats">
                <div class="psc-row"><span>BEST SCORE</span><strong>${formatNum(stats.ultra.best)}</strong></div>
                <div class="psc-row"><span>COINS</span><strong>${stats.ultra.coins} 🪙</strong></div>
                <div class="psc-row"><span>ACHIEVEMENTS</span><strong>${unlByCat('ultra')} / ${achByCat('ultra').length}</strong></div>
            </div>
            <button class="psc-play ultra-btn" onclick="openGame('ultra')">▶ PLAY 2048</button>
        </div>
        <div class="profile-stat-card void-card">
            <div class="psc-header">⚡ VOID SHIFT</div>
            <div class="psc-stats">
                <div class="psc-row"><span>BEST SCORE</span><strong>${formatNum(stats.void.best)}</strong></div>
                <div class="psc-row"><span>LEVEL</span><strong>${stats.void.level}</strong></div>
                <div class="psc-row"><span>ACHIEVEMENTS</span><strong>${unlByCat('void')} / ${achByCat('void').length}</strong></div>
            </div>
            <button class="psc-play void-btn" onclick="openGame('void')">▶ PLAY VOID</button>
        </div>
        <div class="profile-stat-card blob-card">
            <div class="psc-header">🫧 BLOB EATER</div>
            <div class="psc-stats">
                <div class="psc-row"><span>BEST MASS</span><strong>${stats.blob.best}</strong></div>
                <div class="psc-row"><span>GAMES PLAYED</span><strong>${stats.blob.games}</strong></div>
                <div class="psc-row"><span>ACHIEVEMENTS</span><strong>${unlByCat('blob')} / ${achByCat('blob').length}</strong></div>
            </div>
            <button class="psc-play blob-btn" onclick="openGame('blob')">▶ PLAY BLOB</button>
        </div>
        <div class="profile-stat-card bingo-card">
            <div class="psc-header">🎰 ARCADE BINGO</div>
            <div class="psc-stats">
                <div class="psc-row"><span>COINS WON</span><strong>${stats.bingo.totalWon} 🪙</strong></div>
                <div class="psc-row"><span>GAMES PLAYED</span><strong>${stats.bingo.games}</strong></div>
                <div class="psc-row"><span>JACKPOTS</span><strong>${stats.bingo.jackpots} 🏆</strong></div>
                <div class="psc-row"><span>ACHIEVEMENTS</span><strong>${unlByCat('bingo')} / ${achByCat('bingo').length}</strong></div>
            </div>
            <button class="psc-play bingo-btn" onclick="openGame('bingo')">▶ PLAY BINGO</button>
        </div>
        <div class="profile-stat-card tower-card">
            <div class="psc-header">🏰 TOWER RUSH</div>
            <div class="psc-stats">
                <div class="psc-row"><span>BEST LEVEL</span><strong>${stats.tower.bestLevel || '—'} / 10</strong></div>
                <div class="psc-row"><span>BEST WAVE</span><strong>${stats.tower.bestWave || '—'} / 100</strong></div>
                <div class="psc-row"><span>TOTAL KILLS</span><strong>${stats.tower.kills} ⚔️</strong></div>
                <div class="psc-row"><span>BOSSES SLAIN</span><strong>${stats.tower.bossKills} 💀</strong></div>
            </div>
            <button class="psc-play tower-btn" onclick="openGame('tower')">▶ PLAY TOWER</button>
        </div>
    `;

    // Friends section
    renderFriends(stats);

    // Recent achievements
    const recent = ACHIEVEMENTS
        .filter(a => state.achievements[a.id])
        .sort((a, b) => state.achievements[b.id] - state.achievements[a.id])
        .slice(0, 5);

    const listEl = document.getElementById('recent-ach-list');
    if (recent.length === 0) {
        listEl.innerHTML = '<div class="ach-empty">Play games to unlock your first achievement!</div>';
    } else {
        listEl.innerHTML = recent.map(a => `
            <div class="recent-ach-item">
                <span class="ach-icon">${a.icon}</span>
                <div>
                    <div class="ach-name" style="color:${RARITY_COLORS[a.rarity]}">${a.name}</div>
                    <div class="ach-desc">${a.desc}</div>
                </div>
                <span class="ach-xp">+${a.xp} XP</span>
            </div>
        `).join('');
    }
}

// ════════════════════════════════════════════════════════
// RENDER: ACHIEVEMENTS
// ════════════════════════════════════════════════════════

function renderAchievements(stats) {
    const total    = ACHIEVEMENTS.length;
    const unlocked = ACHIEVEMENTS.filter(a => state.achievements[a.id]).length;
    const pct      = Math.floor(unlocked / total * 100);

    document.getElementById('ach-progress-global').innerHTML = `
        <div class="ach-global-progress">
            <span>${unlocked} / ${total} UNLOCKED · ${pct}%</span>
            <div class="ach-global-bar-bg">
                <div class="ach-global-bar" style="width:${pct}%"></div>
            </div>
        </div>
    `;

    const filtered = currentAchFilter === 'all'
        ? ACHIEVEMENTS
        : ACHIEVEMENTS.filter(a => a.cat === currentAchFilter);

    const sorted = [
        ...filtered.filter(a =>  state.achievements[a.id]).sort((a, b) => state.achievements[b.id] - state.achievements[a.id]),
        ...filtered.filter(a => !state.achievements[a.id]),
    ];

    document.getElementById('ach-grid').innerHTML = sorted.map(ach => {
        const isUnlocked = !!state.achievements[ach.id];
        const ts         = state.achievements[ach.id];
        const dateStr    = ts ? new Date(ts).toLocaleDateString() : '';
        return `
            <div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}"
                 style="--rarity-color:${RARITY_COLORS[ach.rarity]}">
                <div class="ach-card-icon">${isUnlocked ? ach.icon : '🔒'}</div>
                <div class="ach-card-name">${isUnlocked ? ach.name : '???'}</div>
                <div class="ach-card-desc">${isUnlocked ? ach.desc : 'Keep playing to unlock'}</div>
                <div class="ach-card-footer">
                    <span class="ach-rarity" style="color:${RARITY_COLORS[ach.rarity]}">${ach.rarity.toUpperCase()}</span>
                    <span class="ach-xp-badge">+${ach.xp} XP</span>
                </div>
                ${isUnlocked ? `<div class="ach-unlock-date">${dateStr}</div>` : ''}
            </div>
        `;
    }).join('');
}

// ════════════════════════════════════════════════════════
// RENDER: SETTINGS
// ════════════════════════════════════════════════════════

function renderSettings() {
    document.getElementById('settings-nickname').value = state.nickname;

    // Sync day/night toggle
    const dmToggle = document.getElementById('daymode-toggle');
    if (dmToggle) dmToggle.checked = document.documentElement.getAttribute('data-daymode') === 'true';

    const avatarHTML = AVATARS.map(av => `
        <button class="avatar-btn ${av === state.avatar ? 'selected' : ''}"
                onclick="selectAvatar('${av}')">${av}</button>
    `).join('');

    document.getElementById('settings-avatar-grid').innerHTML = avatarHTML;
    const modalGrid = document.getElementById('modal-avatar-grid');
    if (modalGrid) modalGrid.innerHTML = avatarHTML;

    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === state.theme);
    });
}

// ════════════════════════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════════════════════════

function showLB(game) {
    currentLBGame = game;

    document.querySelectorAll('.lb-tab').forEach(t => {
        t.className = 'lb-tab';
        if (t.dataset.game === game) t.classList.add(`active-${game}`);
    });

    const keys   = {
        snake: 'snakeLeaderboard',
        ultra: 'u2048_leaderboard',
        void:  'voidshift_lb',
        blob:  'blobLeaderboard',
        bingo: 'bingLeaderboard',
    };
    const colors = {
        snake: 'var(--snake)',
        ultra: 'var(--ultra)',
        void:  'var(--void)',
        blob:  'var(--blob)',
        bingo: 'var(--bingo)',
    };

    const lb    = JSON.parse(localStorage.getItem(keys[game]) || '[]');
    const color = colors[game];
    const table = document.getElementById('lb-table');

    if (!lb.length) {
        table.innerHTML = '<div class="lb-empty">NO SCORES YET — BE THE FIRST!</div>';
        return;
    }

    const medals   = ['🥇','🥈','🥉'];
    const medalCls = ['gold','silver','bronze'];
    table.innerHTML = lb.map((entry, i) => `
        <div class="lb-row ${entry.name === state.nickname ? 'highlight' : ''}">
            <span class="lb-rank ${medalCls[i] || ''}">${medals[i] || (i + 1)}</span>
            <span class="lb-name-col ${entry.name === state.nickname ? 'me' : ''}">
                ${entry.name}${entry.name === state.nickname ? ' ← YOU' : ''}
            </span>
            <span class="lb-score-col" style="color:${color}">${formatNum(entry.score ?? entry.totalWon ?? 0)}</span>
        </div>
    `).join('');
}

// ════════════════════════════════════════════════════════
// TOAST (achievement notification)
// ════════════════════════════════════════════════════════

function showToast(ach) {
    toastQueue.push(ach);
    if (!toastShowing) processToast();
}

function processToast() {
    if (!toastQueue.length) { toastShowing = false; return; }
    toastShowing = true;
    const ach   = toastQueue.shift();
    const toast = document.getElementById('toast');

    document.getElementById('toast-icon').textContent  = ach.icon;
    document.getElementById('toast-title').textContent = 'ACHIEVEMENT UNLOCKED!';
    document.getElementById('toast-name').textContent  = ach.name;
    document.getElementById('toast-desc').textContent  = ach.desc;
    document.getElementById('toast-xp').textContent    = `+${ach.xp} XP`;
    toast.style.setProperty('--toast-color', RARITY_COLORS[ach.rarity]);
    toast.classList.remove('hidden', 'hide');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.classList.remove('show', 'hide');
            setTimeout(processToast, 150);
        }, 400);
    }, 3800);
}

function showNotification(msg, icon = '✅') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-icon').textContent  = icon;
    document.getElementById('toast-title').textContent = msg;
    document.getElementById('toast-name').textContent  = '';
    document.getElementById('toast-desc').textContent  = '';
    document.getElementById('toast-xp').textContent    = '';
    toast.style.setProperty('--toast-color', '#4ade80');
    toast.classList.remove('hidden', 'hide');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.classList.remove('show', 'hide');
        }, 400);
    }, 2000);
}

// ════════════════════════════════════════════════════════
// PORTAL TOASTS (inline bottom-right notifications)
// ════════════════════════════════════════════════════════

function showPortalToast(msg, icon = '✨', type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `portal-toast${type ? ' toast-' + type : ''}`;
    el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
    container.appendChild(el);

    // Auto-remove after 3.5 s with exit animation
    setTimeout(() => {
        el.classList.add('toast-exit');
        setTimeout(() => el.remove(), 350);
    }, 3500);
}

// ════════════════════════════════════════════════════════
// ACTIONS
// ════════════════════════════════════════════════════════

function openGame(game) {
    // Mark today as "played this game" for Portal Master achievement
    const today = todayISO();
    localStorage.setItem(`portal_played_${game}_date`, today);

    const urls = {
        snake:  '/snake/',
        ultra:  '/2048/',
        void:   '/void/',
        blob:   '/blob/',
        bingo:  '/bingo/',
        tower:  '/tower/',
        fish:   '/abyss/',
    };
    if (urls[game]) window.location.href = urls[game];
}

function selectAvatar(av) {
    state.avatar = av;
    localStorage.setItem('portal_avatar', av);
    document.getElementById('nav-avatar').textContent     = av;
    document.getElementById('profile-avatar').textContent = av;
    document.querySelectorAll('.avatar-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent === av);
    });
    saveState();
}

function openAvatarModal() {
    const modal  = document.getElementById('avatar-modal');
    const gridEl = document.getElementById('modal-avatar-grid');
    gridEl.innerHTML = AVATARS.map(av => `
        <button class="avatar-btn ${av === state.avatar ? 'selected' : ''}"
                onclick="selectAvatar('${av}')">${av}</button>
    `).join('');
    modal.classList.remove('hidden');
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function formatNum(n) {
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

// ════════════════════════════════════════════════════════
// SHOP
// ════════════════════════════════════════════════════════

function getPortalCoins() {
    return parseInt(localStorage.getItem(`u2048_coins_${state.nickname}`) || '0');
}
function setPortalCoins(v) {
    localStorage.setItem(`u2048_coins_${state.nickname}`, String(Math.max(0, v)));
}

function getShopItemState(item) {
    function _timerLabel(until) {
        const secsLeft = Math.ceil((until - Date.now()) / 1000);
        const h = Math.floor(secsLeft / 3600);
        const m = Math.floor((secsLeft % 3600) / 60);
        return `Active — ${h}h ${m}m left`;
    }
    switch (item.type) {
        case 'timed': {
            const until = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
            const active = Date.now() < until;
            return active ? { active: true, label: _timerLabel(until) } : { active: false, label: null };
        }
        case 'timed_48h': {
            const until = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
            const active = Date.now() < until;
            return active ? { active: true, label: _timerLabel(until) } : { active: false, label: null };
        }
        case 'timed_event': {
            const until = parseInt(localStorage.getItem('portal_event_token_until') || '0');
            const active = Date.now() < until;
            return active ? { active: true, label: _timerLabel(until) } : { active: false, label: null };
        }
        case 'bundle': {
            // Bundle can always be purchased (consumable)
            return { active: false, label: null };
        }
        case 'count': {
            const lsKey = typeof item.lsKey === 'function' ? item.lsKey() : item.lsKey;
            const count = parseInt(localStorage.getItem(lsKey) || '0');
            return { active: count > 0, count, label: count > 0 ? `${count} stored` : null };
        }
        case 'bool': {
            const lsKey = item.lsKey;
            const has = localStorage.getItem(lsKey) === 'true';
            return { active: has, label: has ? 'Ready to use' : null };
        }
    }
    return { active: false };
}

function buyShopItem(id) {
    const item   = SHOP_ITEMS.find(i => i.id === id);
    if (!item) return;
    // Level requirement check
    const curLevel = getLevel(getTotalXP());
    if (item.minLevel && curLevel < item.minLevel) {
        showNotification(`Unlocks at Level ${item.minLevel}! You are Level ${curLevel}.`, '🔒');
        playSound('error');
        return;
    }
    const coins  = getPortalCoins();
    if (coins < item.cost) {
        showNotification(`Need ${item.cost - coins} more coins!`, '❌');
        return;
    }
    setPortalCoins(coins - item.cost);

    switch (item.type) {
        case 'timed': {
            const now  = Date.now();
            const cur  = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
            const base = Math.max(now, cur);
            localStorage.setItem('portal_xp_boost_until', String(base + 86_400_000));
            addNotification('⚡', 'XP Boost activated! 2× XP for 24 hours.');
            break;
        }
        case 'timed_48h': {
            const now  = Date.now();
            const cur  = parseInt(localStorage.getItem('portal_xp_boost_until') || '0');
            const base = Math.max(now, cur);
            localStorage.setItem('portal_xp_boost_until', String(base + 2 * 86_400_000));
            addNotification('🎯', 'Double XP Weekend activated! 2× XP for 48 hours.');
            break;
        }
        case 'timed_event': {
            const until = Date.now() + 86_400_000;
            localStorage.setItem('portal_event_token_until', String(until));
            localStorage.setItem('portal_current_event', getActiveWeeklyEvent().id);
            addNotification('🎪', 'Event Token activated! Weekly event bonuses active for 24h.');
            break;
        }
        case 'bundle': {
            const revives = parseInt(localStorage.getItem('snake_revives') || '0');
            localStorage.setItem('snake_revives', String(revives + 3));
            const bingoCards = localStorage.getItem('bingo_extra_card');
            // Give 2 extra cards (store count)
            const cardCount = parseInt(localStorage.getItem('bingo_extra_cards') || '0');
            localStorage.setItem('bingo_extra_cards', String(cardCount + 2));
            const tiles = parseInt(localStorage.getItem(`u2048_random_tiles_${state.nickname}`) || '0');
            localStorage.setItem(`u2048_random_tiles_${state.nickname}`, String(Math.min(tiles + 5, 10)));
            addNotification('💫', 'Starter Pack unpacked! 3 Revives + 2 Bingo Cards + 5 Random Tiles.');
            break;
        }
        case 'count': {
            const lsKey = typeof item.lsKey === 'function' ? item.lsKey() : item.lsKey;
            const cur   = parseInt(localStorage.getItem(lsKey) || '0');
            if (cur >= item.max) {
                showNotification(`Already at max (${item.max})!`, '⚠️');
                setPortalCoins(coins); // refund
                return;
            }
            localStorage.setItem(lsKey, String(cur + 1));
            addNotification(item.icon, `${item.name} purchased! You have ${cur + 1} stored.`);
            break;
        }
        case 'bool': {
            if (localStorage.getItem(item.lsKey) === 'true') {
                showNotification('Already have one ready!', '⚠️');
                setPortalCoins(coins); // refund
                return;
            }
            localStorage.setItem(item.lsKey, 'true');
            addNotification(item.icon, `${item.name} purchased!`);
            break;
        }
    }

    // Track total purchases for Shop Addict achievement
    const totalP = parseInt(localStorage.getItem('portal_total_purchases') || '0') + 1;
    localStorage.setItem('portal_total_purchases', String(totalP));

    playSound('claim');
    updateNavBar(readGameStats());
    renderShop();
}

function renderShop() {
    const coins    = getPortalCoins();
    const balEl    = document.getElementById('shop-balance-val');
    if (balEl) balEl.textContent = `${coins} 🪙`;

    // Show level multiplier info
    const mult   = getCoinMultiplier();
    const level  = getLevel(getTotalXP());
    const multEl = document.getElementById('shop-lvl-mult');
    if (multEl) {
        multEl.textContent = mult > 1
            ? `🎖️ LVL ${level} Bonus: ×${mult.toFixed(2).replace(/\.?0+$/, '')} on all daily rewards`
            : `Reach higher levels for coin multiplier bonuses!`;
        multEl.style.color = mult > 1 ? '#4ade80' : '#64748b';
    }

    const grid = document.getElementById('portal-shop-grid');
    if (!grid) return;

    grid.innerHTML = SHOP_ITEMS.map(item => {
        const st      = getShopItemState(item);
        const canBuy  = coins >= item.cost;
        const lsKey   = typeof item.lsKey === 'function' ? item.lsKey() : (item.lsKey || '');
        const count   = item.type === 'count' ? (parseInt(localStorage.getItem(lsKey) || '0')) : 0;
        const maxed   = item.type === 'count' && count >= item.max;
        const locked  = item.minLevel && level < item.minLevel;

        if (locked) {
            return `
            <div class="portal-shop-card card-locked">
                <div class="psc-lock-overlay">🔒 UNLOCK AT LEVEL ${item.minLevel}</div>
                <div class="psc-icon" style="opacity:0.35">${item.icon}</div>
                <div class="psc-name" style="opacity:0.35">${item.name}</div>
                <div class="psc-desc" style="opacity:0.3">${item.desc}</div>
                <div class="psc-cost" style="opacity:0.35">${item.cost} 🪙</div>
                <div class="psc-lvl-needed">Requires Level ${item.minLevel} — you are Level ${level}</div>
            </div>`;
        }

        let btnClass = 'shop-buy-btn';
        let btnText  = `BUY — ${item.cost} 🪙`;
        if (maxed)       { btnClass += ' btn-maxed';  btnText = `MAX (${item.max})`; }
        else if (st.active && item.type === 'timed') { btnClass += ' btn-extend'; btnText = `EXTEND — ${item.cost} 🪙`; }
        else if (st.active && item.type === 'bool')  { btnClass += ' btn-owned';   btnText = 'OWNED ✓'; }
        else if (!canBuy) { btnClass += ' btn-broke'; btnText = `Need ${item.cost - coins} more 🪙`; }

        const isDisabled = maxed || (st.active && item.type === 'bool') ? 'disabled' : '';

        return `
        <div class="portal-shop-card ${st.active ? 'card-active' : ''}">
            <div class="psc-badge ${st.active ? '' : 'hidden'}">${st.label || ''}</div>
            <div class="psc-icon">${item.icon}</div>
            <div class="psc-name">${item.name}</div>
            <div class="psc-desc">${item.desc}</div>
            ${item.type === 'count' ? `<div class="psc-count">${count} / ${item.max} stored</div>` : ''}
            <div class="psc-cost">${item.cost} 🪙</div>
            <button class="${btnClass}" onclick="buyShopItem('${item.id}')" ${isDisabled}>${btnText}</button>
        </div>`;
    }).join('');
}

// ════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════

function getNotifications() {
    return JSON.parse(localStorage.getItem('portal_notifications') || '[]');
}

function addNotification(icon, text) {
    const notifs = getNotifications();
    notifs.unshift({ icon, text, ts: Date.now(), read: false });
    if (notifs.length > 20) notifs.length = 20;
    localStorage.setItem('portal_notifications', JSON.stringify(notifs));
    updateNotifBadge();
    showNotifToast(icon, text);
}

function markAllRead() {
    const notifs = getNotifications().map(n => ({ ...n, read: true }));
    localStorage.setItem('portal_notifications', JSON.stringify(notifs));
    updateNotifBadge();
    renderNotifDropdown();
}

function updateNotifBadge() {
    const unread = getNotifications().filter(n => !n.read).length;
    const badge  = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.toggle('hidden', unread === 0);
}

function renderNotifDropdown() {
    const listEl = document.getElementById('notif-list');
    if (!listEl) return;
    const notifs = getNotifications();
    if (!notifs.length) {
        listEl.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
        return;
    }
    listEl.innerHTML = notifs.map(n => {
        const ago = formatTimeAgo(n.ts);
        return `<div class="notif-item ${n.read ? '' : 'notif-unread'}">
            <span class="notif-item-icon">${n.icon}</span>
            <div class="notif-item-body">
                <div class="notif-item-text">${n.text}</div>
                <div class="notif-item-time">${ago}</div>
            </div>
        </div>`;
    }).join('');
}

let _notifPopupTimer = null;
function showNotifToast(icon, text) {
    const popup = document.getElementById('notif-popup');
    if (!popup) return;
    document.getElementById('notif-popup-icon').textContent = icon;
    document.getElementById('notif-popup-text').textContent = text;
    popup.classList.add('show');
    if (_notifPopupTimer) clearTimeout(_notifPopupTimer);
    _notifPopupTimer = setTimeout(() => popup.classList.remove('show'), 3500);
}

let _notifOpen = false;
function toggleNotifDropdown() {
    _notifOpen = !_notifOpen;
    const dd = document.getElementById('notif-dropdown');
    if (!dd) return;
    dd.classList.toggle('hidden', !_notifOpen);
    if (_notifOpen) {
        renderNotifDropdown();
        // Mark all read after 2s
        setTimeout(() => {
            markAllRead();
        }, 2000);
    }
}

function formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000)    return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ════════════════════════════════════════════════════════
// FRIEND CODES
// ════════════════════════════════════════════════════════

function getFriendCode() {
    let code = localStorage.getItem('portal_friend_code');
    if (!code || !code.startsWith(state.nickname.toUpperCase())) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        code = `${state.nickname.toUpperCase()}-${rand}`;
        localStorage.setItem('portal_friend_code', code);
    }
    return code;
}

function getFriends() {
    return JSON.parse(localStorage.getItem('portal_friends') || '[]');
}

function saveFriends(arr) {
    localStorage.setItem('portal_friends', JSON.stringify(arr));
}

function addFriend(code) {
    code = code.trim().toUpperCase();
    if (!code || !code.includes('-')) {
        showNotification('Invalid friend code format (e.g. MIHAI-4829)', '⚠️');
        return false;
    }
    if (code === getFriendCode()) {
        showNotification("That's your own code!", '⚠️');
        return false;
    }
    const friends = getFriends();
    if (friends.find(f => f.code === code)) {
        showNotification('Already added!', '⚠️');
        return false;
    }
    const nick = code.split('-')[0];
    // Try to find scores (shared localStorage device)
    const friendData = {
        code,
        nickname: nick,
        addedAt: Date.now(),
        scores: {
            snake: parseInt(localStorage.getItem('snakeHighScore')) || 0,
            ultra: parseInt(localStorage.getItem(`u2048_best_${nick}`) || localStorage.getItem(`u2048_best_${nick.toLowerCase()}`) || '0'),
            void:  parseInt(localStorage.getItem(`voidshift_best_${nick}`) || '0'),
            blob:  parseInt(localStorage.getItem('blobevo_best')) || 0,
            bingo: parseInt(localStorage.getItem('bingo_total_won')) || 0,
        },
    };
    friends.push(friendData);
    saveFriends(friends);
    showNotification('👥', `${nick} added to friends!`);
    return true;
}

function renderFriends(stats) {
    const codeEl = document.getElementById('friend-code-display');
    if (codeEl) codeEl.textContent = getFriendCode();

    const listEl = document.getElementById('friends-list');
    if (!listEl) return;

    const friends = getFriends();
    if (!friends.length) {
        listEl.innerHTML = `<div class="friends-empty">
            <div style="font-size:28px;margin-bottom:8px">👥</div>
            <div>No friends added yet.</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;line-height:1.6">
                Share your code with friends!<br>
                When they play on this device, their scores appear here.
            </div>
        </div>`;
        return;
    }

    const myScores = {
        snake: stats.snake.best,
        ultra: stats.ultra.best,
        void:  stats.void.best,
        blob:  stats.blob.best,
        bingo: stats.bingo.totalWon,
    };

    listEl.innerHTML = friends.map(f => {
        const games = ['snake','ultra','void','blob','bingo'];
        const icons = { snake:'🐍', ultra:'🔢', void:'⚡', blob:'🫧', bingo:'🎰' };
        const labels= { snake:'Snake', ultra:'2048', void:'Void', blob:'Blob', bingo:'Bingo' };
        const rows  = games.map(g => {
            const fs = f.scores[g] || 0;
            const ms = myScores[g]  || 0;
            const cls = fs > ms ? 'score-higher' : (ms > fs ? 'score-lower' : '');
            return `<span class="fi-score ${cls}" title="${labels[g]}">${icons[g]} ${formatNum(fs)}</span>`;
        }).join('');

        return `<div class="friend-item">
            <div class="fi-left">
                <div class="fi-avatar">👤</div>
                <div>
                    <div class="fi-name">${f.nickname}</div>
                    <div class="fi-code">${f.code}</div>
                </div>
            </div>
            <div class="fi-scores">${rows}</div>
            <button class="fi-challenge-btn" onclick="challengeFriend('${f.nickname}','${f.code}','snake',${myScores.snake})">⚔ CHALLENGE</button>
            <button class="fi-remove-btn" onclick="removeFriend('${f.code}')">✕</button>
        </div>`;
    }).join('');
}

function challengeFriend(nick, code, game, myScore) {
    const myCode = getFriendCode();
    const text   = `Hey ${nick}! Beat my Snake score of ${myScore} in Arcade Portal! Add me: ${myCode}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showNotification('Challenge copied! 📋', '⚔️'));
    } else {
        prompt('Copy this challenge:', text);
    }
}

function removeFriend(code) {
    const friends = getFriends().filter(f => f.code !== code);
    saveFriends(friends);
    renderFriends(readGameStats());
}

// ════════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════════

function setupEventListeners() {
    // ── Nickname overlay
    const nickBtn = document.getElementById('nickname-btn');
    const nickInp = document.getElementById('nickname-input');
    if (nickBtn) {
        nickBtn.addEventListener('click', () => {
            const v = nickInp.value.trim();
            if (!v) { nickInp.focus(); return; }
            state.nickname = v;
            syncNicknameToGames();
            launchPortal();
        });
        nickInp.addEventListener('keydown', e => {
            if (e.key === 'Enter') nickBtn.click();
        });
    }

    // ── Daily reward claim button
    document.getElementById('dr-claim-btn').addEventListener('click', () => {
        const popup = document.getElementById('daily-popup');
        popup.classList.remove('show');
        setTimeout(() => popup.classList.add('hidden'), 350);
        playSound('claim');
        refreshAll();
        showNotification('Daily reward claimed! 🎁', '🎁');
    });

    // ── Nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => { playSound('navigate'); navigate(btn.dataset.page); });
    });

    // ── LB tabs
    document.getElementById('lb-tabs').addEventListener('click', e => {
        const tab = e.target.closest('.lb-tab');
        if (tab) showLB(tab.dataset.game);
    });

    // ── Achievement filter
    document.getElementById('ach-filter').addEventListener('click', e => {
        const btn = e.target.closest('.ach-filter-btn');
        if (!btn) return;
        document.querySelectorAll('.ach-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAchFilter = btn.dataset.cat;
        renderAchievements(readGameStats());
    });

    // ── Theme picker
    document.getElementById('theme-picker').addEventListener('click', e => {
        const opt = e.target.closest('.theme-option');
        if (!opt) return;
        applyTheme(opt.dataset.theme);
        saveState();
        renderSettings();
    });

    // ── Save nickname
    document.getElementById('save-nickname-btn').addEventListener('click', () => {
        const v = document.getElementById('settings-nickname').value.trim();
        if (!v) return;
        state.nickname = v;
        syncNicknameToGames();
        saveState();
        updateNavBar(readGameStats());
        const pn = document.getElementById('profile-name');
        if (pn) pn.textContent = v;
        showNotification('Nickname saved!');
    });
    document.getElementById('settings-nickname').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('save-nickname-btn').click();
    });

    // ── Reset progress
    document.getElementById('reset-progress-btn').addEventListener('click', () => {
        if (!confirm('Reset ALL portal progress?\n(Achievements, XP, streak, avatar, theme)\n\nGame scores will NOT be affected.')) return;
        state.achievements = {};
        state.avatar       = '🎮';
        localStorage.removeItem('portal_bonus_xp');
        localStorage.removeItem('portal_streak');
        localStorage.removeItem('portal_last_login');
        applyTheme('galaxy');
        saveState();
        refreshAll();
        renderSettings();
        showNotification('Portal progress reset.', '🔄');
    });

    // ── Avatar modal
    document.getElementById('close-avatar-modal').addEventListener('click', () => {
        document.getElementById('avatar-modal').classList.add('hidden');
    });
    document.getElementById('avatar-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('avatar-modal'))
            document.getElementById('avatar-modal').classList.add('hidden');
    });

    // ── Mark all read
    const markBtn = document.getElementById('notif-mark-read-btn');
    if (markBtn) markBtn.addEventListener('click', e => { e.stopPropagation(); markAllRead(); });

    // ── Close notif dropdown on outside click
    document.addEventListener('click', e => {
        if (_notifOpen && !document.getElementById('notif-wrap').contains(e.target)) {
            _notifOpen = false;
            document.getElementById('notif-dropdown').classList.add('hidden');
        }
    });

    // ── Copy friend code
    document.getElementById('copy-code-btn').addEventListener('click', () => {
        const code = getFriendCode();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => showNotification('Code copied!', '📋'));
        } else {
            prompt('Your friend code:', code);
        }
    });

    // ── Add friend
    document.getElementById('add-friend-btn').addEventListener('click', () => {
        const inp = document.getElementById('friend-code-input');
        if (addFriend(inp.value)) {
            inp.value = '';
            renderFriends(readGameStats());
        }
    });
    document.getElementById('friend-code-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('add-friend-btn').click();
    });

    // ── Day/Night toggle (nav button)
    const daynightBtn = document.getElementById('daynight-btn');
    if (daynightBtn) daynightBtn.addEventListener('click', toggleDayMode);

    // ── Day/Night toggle (settings switch)
    const daymodeToggle = document.getElementById('daymode-toggle');
    if (daymodeToggle) daymodeToggle.addEventListener('change', toggleDayMode);

    // ── Auto-refresh on visibility change (return from game)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshAll();
    });

    // ── Periodic refresh every 30s (achievement check)
    setInterval(() => { if (!document.hidden) refreshAll(); }, 30_000);

    // ── Light UI refresh every 5s (coins, stats — no achievement processing)
    setInterval(() => {
        if (!document.hidden) {
            updateNavBar(readGameStats());
            if (state.currentPage === 'home') renderHome(readGameStats());
        }
    }, 5_000);
}

// ════════════════════════════════════════════════════════
// DAY / NIGHT MODE
// ════════════════════════════════════════════════════════

function initDayMode() {
    const isDay = localStorage.getItem('portal_daymode') === 'true';
    applyDayMode(isDay, false);
}

function applyDayMode(isDay, animate) {
    const html = document.documentElement;
    if (animate) {
        html.classList.add('daynight-transitioning');
        setTimeout(() => html.classList.remove('daynight-transitioning'), 600);
    }
    if (isDay) {
        html.setAttribute('data-daymode', 'true');
    } else {
        html.removeAttribute('data-daymode');
    }
    const btn = document.getElementById('daynight-btn');
    if (btn) btn.textContent = isDay ? '☀️' : '🌙';

    const toggle = document.getElementById('daymode-toggle');
    if (toggle) toggle.checked = isDay;
}

function toggleDayMode() {
    const isCurrentlyDay = document.documentElement.getAttribute('data-daymode') === 'true';
    const newIsDay = !isCurrentlyDay;

    const btn = document.getElementById('daynight-btn');
    if (btn) {
        btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 500);
    }

    localStorage.setItem('portal_daymode', String(newIsDay));
    applyDayMode(newIsDay, true);
}

// ════════════════════════════════════════════════════════
// SEASONAL BANNER
// ════════════════════════════════════════════════════════

function getSeasonInfo() {
    const m = new Date().getMonth(); // 0-11
    if (m === 11 || m <= 1)  return { season:'winter', emoji:'❄️', title:'WINTER SEASON',  sub:'Bundle up & rack up wins!',      badge:'⛄ COLD STREAK', cls:'season-winter' };
    if (m >= 2  && m <= 4)   return { season:'spring', emoji:'🌸', title:'SPRING SEASON',  sub:'New growth, new high scores!',   badge:'🌷 BLOOM TIME',   cls:'season-spring' };
    if (m >= 5  && m <= 7)   return { season:'summer', emoji:'☀️', title:'SUMMER SEASON',  sub:'Hot plays, hotter jackpots!',    badge:'🔥 ON FIRE',      cls:'season-summer' };
    return                           { season:'autumn', emoji:'🍂', title:'AUTUMN SEASON',  sub:'Harvest coins before winter!',   badge:'🍁 HARVEST',      cls:'season-autumn' };
}

function renderSeasonalBanner() {
    const el = document.getElementById('seasonal-banner');
    if (!el) return;
    const info = getSeasonInfo();
    el.className = info.cls; // removes 'hidden' automatically
    el.innerHTML = `
        <span id="sb-emoji">${info.emoji}</span>
        <div id="sb-body">
            <div id="sb-title">${info.title}</div>
            <div id="sb-sub">${info.sub}</div>
        </div>
        <span id="sb-badge">${info.badge}</span>
    `;
}

// ════════════════════════════════════════════════════════
// DAILY CHALLENGES
// ════════════════════════════════════════════════════════

const DC_TEMPLATES = [
    // Snake
    { game:'snake', icon:'🐍', color:'var(--snake)', desc:'Score 15+ points in Snake',        metric: s => s.snake.best,       target: (s,b) => b + 15  },
    { game:'snake', icon:'🐍', color:'var(--snake)', desc:'Play 3 Snake games',               metric: s => s.snake.games,      target: (s,b) => b + 3   },
    { game:'snake', icon:'🐍', color:'var(--snake)', desc:'Beat your Snake best score',       metric: s => s.snake.best,       target: (s,b) => b + 1   },
    // 2048
    { game:'ultra', icon:'🔢', color:'var(--ultra)', desc:'Earn 10 coins in Ultra 2048',      metric: s => s.ultra.coins,      target: (s,b) => b + 10  },
    { game:'ultra', icon:'🔢', color:'var(--ultra)', desc:'Play 2 games of Ultra 2048',       metric: s => s.ultra.games,      target: (s,b) => b + 2   },
    { game:'ultra', icon:'🔢', color:'var(--ultra)', desc:'Score 500+ in Ultra 2048',         metric: s => s.ultra.best,       target: (s,b) => b + 500 },
    // Void Shift
    { game:'void',  icon:'⚡', color:'var(--void)',  desc:'Score 2000+ in Void Shift',        metric: s => s.void.best,        target: (s,b) => b + 2000},
    { game:'void',  icon:'⚡', color:'var(--void)',  desc:'Play 2 games of Void Shift',       metric: s => s.void.games,       target: (s,b) => b + 2   },
    { game:'void',  icon:'⚡', color:'var(--void)',  desc:'Reach Level 2 in Void Shift',      metric: s => s.void.level,       target: (s,b) => Math.max(b + 1, 2) },
    // Blob
    { game:'blob',  icon:'🧬', color:'var(--blob)',  desc:'Reach mass 50 in Blob Evolution',  metric: s => s.blob.best,        target: (s,b) => b + 50  },
    { game:'blob',  icon:'🧬', color:'var(--blob)',  desc:'Play 2 Blob Evolution games',      metric: s => s.blob.games,       target: (s,b) => b + 2   },
    // Bingo
    { game:'bingo', icon:'🎰', color:'var(--bingo)', desc:'Play any Bingo game',              metric: s => s.bingo.games,      target: (s,b) => b + 1   },
    { game:'bingo', icon:'🎰', color:'var(--bingo)', desc:'Win coins in Bingo',               metric: s => s.bingo.totalWon,   target: (s,b) => b + 1   },
    { game:'bingo', icon:'🎰', color:'var(--bingo)', desc:'Win 20+ coins in Bingo',           metric: s => s.bingo.totalWon,   target: (s,b) => b + 20  },
    // Tower Rush
    { game:'tower', icon:'🏰', color:'#c4973a',      desc:'Kill 20 enemies in Tower Rush',   metric: s => s.tower.kills,      target: (s,b) => b + 20  },
    { game:'tower', icon:'🏰', color:'#c4973a',      desc:'Complete Wave 5 in Tower Rush',   metric: s => s.tower.bestWave,   target: (s,b) => Math.max(b + 1, 5) },
    { game:'tower', icon:'🏰', color:'#c4973a',      desc:'Play 2 Tower Rush games',         metric: s => s.tower.games,      target: (s,b) => b + 2   },
    { game:'tower', icon:'🏰', color:'#c4973a',      desc:'Slay a Boss in Tower Rush',       metric: s => s.tower.bossKills,  target: (s,b) => b + 1   },
];

const DC_REWARD_XP    = 150;
const DC_REWARD_COINS = 25;
const DC_COUNT        = 3;

function getDCDateKey()    { return todayISO(); }
function getDCBaseline(i)  { return JSON.parse(localStorage.getItem(`portal_dc_base_${getDCDateKey()}_${i}`) || 'null'); }
function setDCBaseline(i,v){ localStorage.setItem(`portal_dc_base_${getDCDateKey()}_${i}`, JSON.stringify(v)); }
function isDCDone(i)       { return localStorage.getItem(`portal_dc_done_${getDCDateKey()}_${i}`) === '1'; }
function setDCDone(i)      { localStorage.setItem(`portal_dc_done_${getDCDateKey()}_${i}`, '1'); }

function generateDailyChallenges() {
    // Seed RNG from date string for consistency
    const dateStr = getDCDateKey();
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    function seededRand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xFFFFFFFF; }

    const chosen = [];
    const used   = new Set();
    while (chosen.length < DC_COUNT) {
        const idx = Math.floor(seededRand() * DC_TEMPLATES.length);
        if (!used.has(idx)) { used.add(idx); chosen.push(DC_TEMPLATES[idx]); }
    }
    return chosen;
}

function renderDailyChallenges() {
    const grid = document.getElementById('daily-challenges-grid');
    if (!grid) return;
    const stats      = readGameStats();
    const challenges = generateDailyChallenges();

    grid.innerHTML = '';
    challenges.forEach((ch, i) => {
        // Init baseline if first time seeing this challenge today
        let baseline = getDCBaseline(i);
        if (baseline === null) {
            baseline = ch.metric(stats);
            setDCBaseline(i, baseline);
        }
        const target   = ch.target(stats, baseline);
        const current  = ch.metric(stats);
        const done     = isDCDone(i) || current >= target;
        const progress = Math.min(1, Math.max(0, (current - baseline) / (target - baseline)));
        const pct      = Math.round(progress * 100);

        const GAME_NAMES = { snake:'SNAKE', ultra:'ULTRA 2048', void:'VOID SHIFT', blob:'BLOB EVO', bingo:'BINGO' };

        const card = document.createElement('div');
        card.className = 'dc-card' + (done ? ' dc-done' : '');
        card.style.setProperty('--dc-color', ch.color);
        card.innerHTML = `
            <div class="dc-card-top">
                <span class="dc-game-icon">${ch.icon}</span>
                <span class="dc-game-name">${GAME_NAMES[ch.game]}</span>
            </div>
            <div class="dc-desc">${ch.desc}</div>
            <div class="dc-progress-wrap">
                <div class="dc-progress-fill" style="width:${done?100:pct}%"></div>
            </div>
            <div class="dc-footer">
                <span class="dc-progress-text">${done ? 'COMPLETE' : `${pct}% done`}</span>
                <span class="dc-reward">+${DC_REWARD_XP} XP · +${DC_REWARD_COINS} 🪙</span>
            </div>
            ${!done ? `<button class="dc-claim-btn" disabled>NOT YET</button>` :
              isDCDone(i) ? `<button class="dc-claim-btn" disabled>✓ CLAIMED</button>` :
              `<button class="dc-claim-btn" onclick="claimDailyChallenge(${i})">🎁 CLAIM REWARD</button>`}
        `;
        grid.appendChild(card);
    });
}

function claimDailyChallenge(i) {
    if (isDCDone(i)) return;
    setDCDone(i);

    // Award XP
    const bonusXP = parseInt(localStorage.getItem('portal_bonus_xp') || '0');
    localStorage.setItem('portal_bonus_xp', String(bonusXP + DC_REWARD_XP));

    // Award coins with level multiplier
    const dcMult   = getCoinMultiplier();
    const dcCoins  = Math.round(DC_REWARD_COINS * dcMult);
    setPortalCoins(getPortalCoins() + dcCoins);

    playSound('claim');
    addNotification('🎯', `Daily challenge complete! +${DC_REWARD_XP} XP · +${dcCoins} 🪙${dcMult > 1 ? ` (×${dcMult.toFixed(2).replace(/\.?0+$/,'')} lvl)` : ''}`);
    refreshAll();
    renderDailyChallenges();
}

// ════════════════════════════════════════════════════════
// WEEKLY PROGRESS
// ════════════════════════════════════════════════════════

function getISOWeek() {
    const d  = new Date();
    const dayNum = (d.getDay() + 6) % 7; // Mon = 0
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayNum);
    return `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate()) / 7)).padStart(2,'0')}-${monday.getFullYear()}${String(monday.getMonth()+1).padStart(2,'0')}${String(monday.getDate()).padStart(2,'0')}`;
}

function recordTodayXP(xp) {
    const key = `portal_daily_xp_${todayISO()}`;
    const cur  = parseInt(localStorage.getItem(key) || '0');
    if (xp > cur) localStorage.setItem(key, String(xp));
}

function getWeekDays() {
    const today   = new Date();
    const dayNum  = (today.getDay() + 6) % 7; // Mon=0
    const days    = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - dayNum + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const label = ['MON','TUE','WED','THU','FRI','SAT','SUN'][i];
        const xp    = parseInt(localStorage.getItem(`portal_daily_xp_${iso}`) || '0');
        days.push({ iso, label, xp, isToday: i === dayNum });
    }
    return days;
}

function renderWeeklyProgress() {
    const wpc = document.getElementById('weekly-progress-content');
    if (!wpc) return;

    const days      = getWeekDays();
    const weekXP    = days.reduce((s,d) => s + d.xp, 0);
    const maxXP     = Math.max(...days.map(d => d.xp), 1);

    // Last week XP (rough estimate from 7–14 days ago)
    let lastWeekXP = 0;
    for (let i = 7; i < 14; i++) {
        const d  = new Date();
        d.setDate(d.getDate() - i);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        lastWeekXP += parseInt(localStorage.getItem(`portal_daily_xp_${iso}`) || '0');
    }

    const bestWeekXP = Math.max(parseInt(localStorage.getItem('portal_best_week_xp') || '0'), weekXP);
    localStorage.setItem('portal_best_week_xp', String(bestWeekXP));

    // Week label
    const monday = days[0];
    const sunday = days[6];
    const wLabel = document.getElementById('wp-week-label');
    if (wLabel) wLabel.textContent = `${monday.iso} → ${sunday.iso}`;

    const trend = weekXP > lastWeekXP ? '▲' : weekXP < lastWeekXP ? '▼' : '—';
    const trendColor = weekXP >= lastWeekXP ? '#4ade80' : '#f87171';

    wpc.innerHTML = `
        <div id="wp-summary">
            <div class="wp-stat">
                <div class="wp-stat-val">${weekXP}</div>
                <div class="wp-stat-label">THIS WEEK XP</div>
            </div>
            <div class="wp-stat">
                <div class="wp-stat-val" style="color:${trendColor}">${trend} ${lastWeekXP}</div>
                <div class="wp-stat-label">LAST WEEK XP</div>
            </div>
            <div class="wp-stat">
                <div class="wp-stat-val" style="color:#fbbf24">${bestWeekXP}</div>
                <div class="wp-stat-label">BEST WEEK XP</div>
            </div>
        </div>
        <div id="wp-bars">
            ${days.map(d => {
                const barH = maxXP > 0 ? Math.max(4, Math.round((d.xp / maxXP) * 100)) : 4;
                return `<div class="wp-day-col ${d.isToday ? 'today' : ''}">
                    <div class="wp-bar-wrap"><div class="wp-bar" style="height:${barH}%"></div></div>
                    <div class="wp-day-label">${d.label}</div>
                </div>`;
            }).join('')}
        </div>
    `;
}

// ════════════════════════════════════════════════════════
// STATISTICS PAGE
// ════════════════════════════════════════════════════════

function renderStats(stats) {
    const xp            = computeXP(stats);
    const level         = getLevel(xp);
    const achUnlocked   = Object.keys(state.achievements).length;
    const achTotal      = ACHIEVEMENTS.length;
    const achPct        = Math.round(achUnlocked / achTotal * 100);
    const totalGames    = stats.snake.games + stats.ultra.games + stats.void.games + stats.blob.games + stats.bingo.games;
    const streak        = stats.streak;
    const daysActive    = parseInt(localStorage.getItem('portal_total_days') || '1');

    // Track total days active
    const lastSeen = localStorage.getItem('portal_last_seen_day');
    const today    = todayISO();
    if (lastSeen !== today) {
        localStorage.setItem('portal_last_seen_day', today);
        const d = parseInt(localStorage.getItem('portal_total_days') || '0') + 1;
        localStorage.setItem('portal_total_days', String(d));
    }

    // Overview cards
    document.getElementById('stats-overview-cards').innerHTML = `
        <div class="stats-ov-card"><div class="soc-icon">⚡</div><div class="soc-val">${xp}</div><div class="soc-label">TOTAL XP</div></div>
        <div class="stats-ov-card"><div class="soc-icon">🎮</div><div class="soc-val">${totalGames}</div><div class="soc-label">TOTAL GAMES</div></div>
        <div class="stats-ov-card"><div class="soc-icon">🏆</div><div class="soc-val">${achPct}%</div><div class="soc-label">ACHIEVEMENTS</div></div>
        <div class="stats-ov-card"><div class="soc-icon">🔥</div><div class="soc-val">${streak}</div><div class="soc-label">DAY STREAK</div></div>
    `;

    // Per-game bars — normalize against highest values
    const maxGames = Math.max(stats.snake.games, stats.ultra.games, stats.void.games, stats.blob.games, stats.bingo.games, 1);
    const maxBest  = Math.max(stats.snake.best, 1);

    function barHtml(val, max, color) {
        const pct = Math.min(100, Math.round(val / max * 100));
        return `<div class="spg-bar-bg"><div class="spg-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
    }

    document.getElementById('stats-per-game-grid').innerHTML = [
        { name:'🐍 SNAKE',         color:'var(--snake)', games: stats.snake.games, metrics: [
            { label:'BEST SCORE', val: stats.snake.best,  bar: barHtml(stats.snake.best,  200,  'var(--snake)') },
            { label:'GAMES',      val: stats.snake.games, bar: barHtml(stats.snake.games, maxGames, 'var(--snake)') },
        ]},
        { name:'🔢 ULTRA 2048',    color:'var(--ultra)', games: stats.ultra.games, metrics: [
            { label:'BEST SCORE', val: formatNum(stats.ultra.best),  bar: barHtml(stats.ultra.best,  200000, 'var(--ultra)') },
            { label:'MAX TILE',   val: stats.ultra.maxTile || '?',   bar: barHtml(stats.ultra.maxTile, 8192, 'var(--ultra)') },
        ]},
        { name:'⚡ VOID SHIFT',    color:'var(--void)',  games: stats.void.games,  metrics: [
            { label:'BEST SCORE', val: formatNum(stats.void.best),   bar: barHtml(stats.void.best,   50000, 'var(--void)') },
            { label:'MAX LEVEL',  val: stats.void.level,             bar: barHtml(stats.void.level,  10,    'var(--void)') },
        ]},
        { name:'🧬 BLOB EVOLUTION', color:'var(--blob)', games: stats.blob.games,  metrics: [
            { label:'BEST MASS',  val: stats.blob.best,              bar: barHtml(stats.blob.best,  5000,  'var(--blob)') },
            { label:'GAMES',      val: stats.blob.games,             bar: barHtml(stats.blob.games, maxGames, 'var(--blob)') },
        ]},
        { name:'🎰 ARCADE BINGO',  color:'var(--bingo)', games: stats.bingo.games, metrics: [
            { label:'COINS WON',  val: stats.bingo.totalWon + ' 🪙', bar: barHtml(stats.bingo.totalWon, 10000, 'var(--bingo)') },
            { label:'JACKPOTS',   val: stats.bingo.jackpots,         bar: barHtml(stats.bingo.jackpots, 10,    'var(--bingo)') },
        ]},
        { name:'🏰 TOWER RUSH',   color:'#c4973a',      games: stats.tower.games,  metrics: [
            { label:'BEST LEVEL', val: (stats.tower.bestLevel || 0) + ' / 10', bar: barHtml(stats.tower.bestLevel, 10,  '#c4973a') },
            { label:'KILLS',      val: stats.tower.kills,             bar: barHtml(stats.tower.kills,    1000, '#c4973a') },
        ]},
    ].map(g => `
        <div class="spg-card">
            <div class="spg-header">
                <span class="spg-title" style="color:${g.color}">${g.name}</span>
                <span class="spg-games">${g.games} games</span>
            </div>
            ${g.metrics.map(m => `
                <div class="spg-metric">
                    <div class="spg-metric-label">${m.label}</div>
                    <div class="spg-bar-row">${m.bar}<span class="spg-bar-val">${m.val}</span></div>
                </div>
            `).join('')}
        </div>
    `).join('');

    // ── Fun Facts ────────────────────────────────────────
    const totalApples  = parseInt(localStorage.getItem('snake_total_apples')          || '0');
    const totalMerges  = parseInt(localStorage.getItem(`u2048_total_merges_${state.nickname}`) || '0');
    const blobTimeMs   = parseInt(localStorage.getItem('blobevo_total_time_ms')        || '0');
    const blobHours    = Math.round(blobTimeMs / 3_600_000 * 10) / 10;
    const totalBets    = stats.bingo.mpTotalSpent;
    const towerKills   = stats.tower.kills;
    const statsVisits  = parseInt(localStorage.getItem('portal_stats_visits')          || '0');
    const shopPurchases= parseInt(localStorage.getItem('portal_total_purchases')        || '0');
    const totalCoins   = getPortalCoins();

    const facts = [];
    if (totalApples > 0)   facts.push(`🍎 You've eaten <b>${totalApples}</b> apples in Snake — that snake is VERY well fed!`);
    if (totalMerges > 0)   facts.push(`🔢 You've made <b>${totalMerges}</b> tile merges in Ultra 2048!`);
    if (blobHours > 0)     facts.push(`🫧 You've spent <b>${blobHours}h</b> evolving your blob. Absolute unit!`);
    if (stats.bingo.jackpots > 0) facts.push(`🎰 You've won <b>${stats.bingo.jackpots}</b> Jackpot(s) in Bingo. Lucky!`);
    if (towerKills > 0)    facts.push(`⚔️ You've eliminated <b>${towerKills}</b> enemies in Tower Rush!`);
    if (totalGames > 20)   facts.push(`🎮 <b>${totalGames}</b> games played total. That's dedication!`);
    if (totalCoins > 500)  facts.push(`🪙 You're sitting on <b>${totalCoins}</b> portal coins. Spend wisely!`);
    if (shopPurchases > 0) facts.push(`🛒 You've made <b>${shopPurchases}</b> shop purchase${shopPurchases > 1 ? 's' : ''}!`);
    if (stats.streak >= 3) facts.push(`🔥 You're on a <b>${stats.streak}-day</b> streak. Don't break it!`);
    if (totalBets > 0)     facts.push(`💸 You've wagered <b>${totalBets}</b> coins in Jackpot Bingo!`);
    if (statsVisits > 1)   facts.push(`📊 You've checked the Stats page <b>${statsVisits}</b> times. Stats nerd confirmed!`);

    // Always show at least a default fact
    if (facts.length === 0) facts.push(`🎮 Start playing games to see fun stats about your arcade journey!`);

    // Weekly event participation tracking for Event Chaser achievement
    const evNow = getActiveWeeklyEvent();
    if (evNow) {
        const participated = JSON.parse(localStorage.getItem('portal_events_participated') || '[]');
        if (!participated.includes(evNow.id)) {
            participated.push(evNow.id);
            localStorage.setItem('portal_events_participated', JSON.stringify(participated));
        }
    }

    const funFactsHtml = `
        <div class="stats-fun-facts">
            <h3 class="section-title" style="margin:28px 0 16px">✨ FUN FACTS</h3>
            <div class="fun-facts-grid">
                ${facts.slice(0, 6).map(f => `<div class="fun-fact-card">${f}</div>`).join('')}
            </div>
        </div>
    `;

    // Records table
    const coins = getPortalCoins();
    document.getElementById('stats-records-table').innerHTML = `
        <div class="str-row header">
            <span></span><span>GAME</span><span style="text-align:right">BEST</span><span style="text-align:right">LEVEL</span>
        </div>
        <div class="str-row"><span class="str-icon">🐍</span><span class="str-game">Snake</span><span class="str-val">${stats.snake.best}</span><span class="str-date">–</span></div>
        <div class="str-row"><span class="str-icon">🔢</span><span class="str-game">Ultra 2048</span><span class="str-val">${formatNum(stats.ultra.best)}</span><span class="str-date">LVL ${getLevel(xp)}</span></div>
        <div class="str-row"><span class="str-icon">⚡</span><span class="str-game">Void Shift</span><span class="str-val">${formatNum(stats.void.best)}</span><span class="str-date">LVL ${stats.void.level}</span></div>
        <div class="str-row"><span class="str-icon">🧬</span><span class="str-game">Blob Evolution</span><span class="str-val">${stats.blob.best}</span><span class="str-date">–</span></div>
        <div class="str-row"><span class="str-icon">🎰</span><span class="str-game">Arcade Bingo</span><span class="str-val">${stats.bingo.totalWon} 🪙</span><span class="str-date">${stats.bingo.jackpots} JP</span></div>
        <div class="str-row"><span class="str-icon">🏰</span><span class="str-game">Tower Rush</span><span class="str-val">LVL ${stats.tower.bestLevel || '—'}</span><span class="str-date">${stats.tower.kills} kills</span></div>
        <div class="str-row"><span class="str-icon">💰</span><span class="str-game">Total Coins</span><span class="str-val">${coins} 🪙</span><span class="str-date">–</span></div>
        <div class="str-row"><span class="str-icon">🏆</span><span class="str-game">Achievements</span><span class="str-val">${achUnlocked}/${achTotal}</span><span class="str-date">${achPct}%</span></div>
    `;

    // Append fun facts (create container if needed)
    let ffEl = document.getElementById('stats-fun-facts-section');
    if (!ffEl) {
        ffEl = document.createElement('div');
        ffEl.id = 'stats-fun-facts-section';
        document.getElementById('stats-records-section').after(ffEl);
    }
    ffEl.innerHTML = funFactsHtml;
}

// ════════════════════════════════════════════════════════
// SOUND SYSTEM
// ════════════════════════════════════════════════════════

let _audioCtx  = null;
let _soundOn   = true;
let _soundVol  = 0.4;

function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

function playTone(freq, duration, type = 'sine', vol = _soundVol) {
    if (!_soundOn) return;
    try {
        const ctx  = getAudioCtx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

function toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.classList.toggle('open');
}

function mobileNavGo(page) {
    toggleMobileNav();
    navigate(page);
}

function toggleNavMute() {
    if (typeof ArcadeSound !== 'undefined') {
        const muted = ArcadeSound.toggleMute();
        const btn = document.getElementById('mute-btn');
        if (btn) btn.textContent = muted ? '🔇' : '🔊';
        _soundOn = !muted;
    }
}

function playSound(name) {
    if (!_soundOn) return;
    // Delegate to ArcadeSound engine if available
    if (typeof ArcadeSound !== 'undefined') {
        ArcadeSound.play(name);
        return;
    }
    switch(name) {
        case 'click':
            playTone(800, 0.06, 'square', 0.15);
            break;
        case 'navigate':
            playTone(440, 0.08, 'sine', 0.12);
            setTimeout(() => playTone(660, 0.08, 'sine', 0.08), 60);
            break;
        case 'achievement':
            [523, 659, 784, 1047].forEach((f,i) =>
                setTimeout(() => playTone(f, 0.18, 'sine', 0.2), i * 90));
            break;
        case 'levelup':
            [392, 523, 659, 784, 1047].forEach((f,i) =>
                setTimeout(() => playTone(f, 0.15, 'sine', 0.22), i * 70));
            break;
        case 'claim':
            [523, 784, 1047].forEach((f,i) =>
                setTimeout(() => playTone(f, 0.12, 'sine', 0.18), i * 60));
            break;
        case 'error':
            playTone(200, 0.15, 'sawtooth', 0.18);
            setTimeout(() => playTone(150, 0.2, 'sawtooth', 0.15), 120);
            break;
    }
}

function initSounds() {
    _soundOn  = localStorage.getItem('portal_sound') !== 'false';
    _soundVol = (parseInt(localStorage.getItem('portal_volume') || '40')) / 100;

    // Sync ArcadeSound engine
    if (typeof ArcadeSound !== 'undefined') {
        ArcadeSound.reload();
        const muted = localStorage.getItem('portal_muted') === 'true';
        if (!_soundOn) ArcadeSound.setMuted(true);
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) muteBtn.textContent = ArcadeSound.isMuted() ? '🔇' : '🔊';
    }

    const toggle = document.getElementById('sound-toggle');
    const slider = document.getElementById('volume-slider');
    const volVal = document.getElementById('vol-val');
    const volRow = document.getElementById('sound-volume-row');
    const testBtn= document.getElementById('test-sound-btn');

    if (toggle) {
        toggle.checked = _soundOn;
        if (volRow) volRow.style.opacity = _soundOn ? '1' : '0.4';
        toggle.addEventListener('change', () => {
            _soundOn = toggle.checked;
            localStorage.setItem('portal_sound', String(_soundOn));
            if (typeof ArcadeSound !== 'undefined') ArcadeSound.setMuted(!_soundOn);
            const muteBtn = document.getElementById('mute-btn');
            if (muteBtn) muteBtn.textContent = _soundOn ? '🔊' : '🔇';
            if (volRow) volRow.style.opacity = _soundOn ? '1' : '0.4';
            if (_soundOn) playSound('click');
        });
    }
    if (slider) {
        slider.value = Math.round(_soundVol * 100);
        if (volVal) volVal.textContent = slider.value + '%';
        slider.addEventListener('input', () => {
            _soundVol = parseInt(slider.value) / 100;
            if (typeof ArcadeSound !== 'undefined') ArcadeSound.setVolume(_soundVol);
            else localStorage.setItem('portal_volume', slider.value);
            if (volVal) volVal.textContent = slider.value + '%';
        });
    }
    if (testBtn) {
        testBtn.addEventListener('click', () => playSound('achievement'));
    }
}

// ════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════════════════

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Skip if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        // Skip if modifier keys
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const key = e.key.toUpperCase();
        switch(key) {
            case 'H': playSound('navigate'); navigate('home');         break;
            case 'P': playSound('navigate'); navigate('profile');      break;
            case 'A': playSound('navigate'); navigate('achievements'); break;
            case 'T': playSound('navigate'); navigate('stats');        break;
            case 'S': playSound('navigate'); navigate('shop');         break;
            case 'G': playSound('navigate'); navigate('settings');     break;
            case 'D': toggleDayMode(); playSound('click');             break;
            case 'ESCAPE':
                // Close any open panel, or go home
                if (_notifOpen) {
                    _notifOpen = false;
                    const dd = document.getElementById('notif-dropdown');
                    if (dd) dd.classList.add('hidden');
                } else if (!document.getElementById('avatar-modal').classList.contains('hidden')) {
                    document.getElementById('avatar-modal').classList.add('hidden');
                } else if (state.currentPage !== 'home') {
                    playSound('navigate');
                    navigate('home');
                }
                break;
        }
    });
}

// ════════════════════════════════════════════════════════
// DAILY SPIN WHEEL
// ════════════════════════════════════════════════════════

const SPIN_SECTORS = [
    { label: '50 🪙',       icon: '🪙',  color: '#d4a017', reward: { type: 'coins',   value: 50  } },
    { label: '100 XP',      icon: '⭐',  color: '#a855f7', reward: { type: 'xp',     value: 100 } },
    { label: 'REVIVE 💀',   icon: '💀',  color: '#ef4444', reward: { type: 'revive',  value: 1   } },
    { label: '25 🪙',       icon: '🪙',  color: '#b8860b', reward: { type: 'coins',   value: 25  } },
    { label: '5 🔮 SHARDS', icon: '🔮',  color: '#06b6d4', reward: { type: 'shards',  value: 5   } },
    { label: '50 XP',       icon: '⭐',  color: '#8b5cf6', reward: { type: 'xp',     value: 50  } },
    { label: '💣 BOMB',     icon: '💣',  color: '#f97316', reward: { type: 'bomb',    value: 1   } },
    { label: 'JACKPOT 💰',  icon: '💰',  color: '#fbbf24', reward: { type: 'coins',   value: 200 } },
];

let spinAngle     = 0;
let spinVelocity  = 0;
let spinRunning   = false;
let spinAnimFrame = null;
let spinResult    = null;

function canSpinToday() {
    return localStorage.getItem('portal_spin_date') !== todayISO();
}

function openSpinWheel() {
    const modal = document.getElementById('spin-modal');
    modal.classList.remove('hidden');
    document.getElementById('spin-result').classList.add('hidden');
    document.getElementById('spin-btn').classList.remove('hidden');
    document.getElementById('spin-close-btn').classList.add('hidden');
    const alreadySpun = !canSpinToday();
    document.getElementById('spin-btn').disabled = alreadySpun;
    document.getElementById('spin-btn').textContent = alreadySpun ? '✅ Already spun today!' : '🎰 SPIN!';
    spinAngle = 0;
    spinResult = null;
    drawSpinWheel(spinAngle);
}

function closeSpinModal() {
    document.getElementById('spin-modal').classList.add('hidden');
    // hide spin CTA if already used
    if (!canSpinToday()) document.getElementById('spin-cta').classList.add('hidden');
}

function drawSpinWheel(angle) {
    const canvas = document.getElementById('spin-canvas');
    const ctx    = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r  = cx - 8;
    const n  = SPIN_SECTORS.length;
    const arc = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    SPIN_SECTORS.forEach((s, i) => {
        const start = angle + i * arc - Math.PI / 2;
        const end   = start + arc;

        // Sector fill
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = s.color + (i % 2 === 0 ? 'ee' : 'bb');
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + arc / 2);
        ctx.textAlign = 'right';
        ctx.font      = 'bold 11px Courier New';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur  = 3;
        ctx.fillText(s.icon + ' ' + s.label, r - 8, 4);
        ctx.restore();
    });

    // Center cap
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎰', cx, cy);
}

function doSpin() {
    if (spinRunning || !canSpinToday()) return;
    spinRunning = true;
    document.getElementById('spin-btn').disabled = true;

    // Pick random result
    const resultIdx = Math.floor(Math.random() * SPIN_SECTORS.length);
    const arc = (Math.PI * 2) / SPIN_SECTORS.length;

    // IMPORTANT: full rotations MUST be an integer so that 2π*N % (2π) = 0 exactly.
    // If we used (5 + Math.random()*3) the fractional part would add a random offset
    // that shifts the landing sector unpredictably.
    const fullRotations = 5 + Math.floor(Math.random() * 4); // integer: 5, 6, 7 or 8

    // For sector `resultIdx` center to land at the pointer (top = -π/2):
    //   finalAngle + (resultIdx + 0.5)*arc - π/2  =  -π/2  (mod 2π)
    //   finalAngle  =  2π - (resultIdx + 0.5)*arc
    const targetAngle = Math.PI * 2 * fullRotations +
        (Math.PI * 2 - (resultIdx + 0.5) * arc);

    let elapsed = 0;
    const duration = 3800; // ms
    let lastTs = null;

    function tick(ts) {
        if (!lastTs) lastTs = ts;
        elapsed += ts - lastTs;
        lastTs = ts;

        const t = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        spinAngle = eased * targetAngle;
        drawSpinWheel(spinAngle % (Math.PI * 2));

        if (t < 1) {
            spinAnimFrame = requestAnimationFrame(tick);
        } else {
            // Done
            spinRunning = false;
            spinResult = SPIN_SECTORS[resultIdx];
            applySpinReward(spinResult);
            showSpinResult(spinResult);
            localStorage.setItem('portal_spin_date', todayISO());
            document.getElementById('spin-cta').classList.add('hidden');
        }
    }
    spinAnimFrame = requestAnimationFrame(tick);
}

function applySpinReward(sector) {
    const nick = state.nickname;
    switch (sector.reward.type) {
        case 'coins': {
            const c = parseInt(localStorage.getItem(`u2048_coins_${nick}`) || '0');
            localStorage.setItem(`u2048_coins_${nick}`, String(c + sector.reward.value));
            showPortalToast(`+${sector.reward.value} Coins added to your wallet!`, '🪙', 'coins');
            break;
        }
        case 'xp': {
            const x = parseInt(localStorage.getItem('portal_bonus_xp') || '0');
            localStorage.setItem('portal_bonus_xp', String(x + sector.reward.value));
            showPortalToast(`+${sector.reward.value} XP earned!`, '⭐', 'xp');
            break;
        }
        case 'revive': {
            const rv = parseInt(localStorage.getItem('snake_revives') || '0');
            localStorage.setItem('snake_revives', String(rv + sector.reward.value));
            showPortalToast('Snake Revive token saved!', '💀', '');
            break;
        }
        case 'bomb': {
            const b = parseInt(localStorage.getItem(`u2048_bombs_${nick}`) || '0');
            localStorage.setItem(`u2048_bombs_${nick}`, String(b + sector.reward.value));
            showPortalToast('2048 Bomb power-up saved!', '💣', '');
            break;
        }
        case 'shards': {
            addEventShards(sector.reward.value);
            showPortalToast(`+${sector.reward.value} Event Shards earned!`, '🔮', 'shards');
            break;
        }
    }
    playSound('achievement');
    refreshAll();
}

function showSpinResult(sector) {
    const res = document.getElementById('spin-result');
    document.getElementById('spin-result-icon').textContent = sector.icon;
    document.getElementById('spin-result-text').textContent = 'You won: ' + sector.label + '!';
    res.classList.remove('hidden');
    document.getElementById('spin-btn').classList.add('hidden');
    document.getElementById('spin-close-btn').classList.remove('hidden');
}

function renderSpinCTA() {
    const cta = document.getElementById('spin-cta');
    if (!cta) return;
    cta.classList.toggle('hidden', !canSpinToday());
}

// ════════════════════════════════════════════════════════
// SEASONAL EVENT SYSTEM
// ════════════════════════════════════════════════════════

const EVENTS = {
    winter: {
        name:   'WINTER FROST',
        icon:   '❄️',
        color:  '#06b6d4',
        badge:  '🧊',
        badgeLabel: 'Ice Champion',
        goal:   15,
        shardIcon: '❄️',
        quests: [
            { id: 'ev_games5',    desc: 'Play 5 games (any)',       goal: 5,   shards: 3, trackFn: s => s.snake.games + s.ultra.games + s.void.games + s.blob.games + s.bingo.games },
            { id: 'ev_xp100',     desc: 'Earn 100 portal XP',      goal: 100, shards: 3, trackFn: s => Math.min(computeXP(s), 100) },
            { id: 'ev_snake10',   desc: 'Score 10+ in Snake',       goal: 10,  shards: 2, trackFn: s => Math.min(s.snake.best, 10) },
            { id: 'ev_2048combo', desc: 'Get a 3× combo in 2048',   goal: 1,   shards: 2, trackFn: () => parseInt(localStorage.getItem('u2048_combo3_session') || '0') > 0 ? 1 : 0 },
            { id: 'ev_bingo1',    desc: 'Play a Jackpot Battle',    goal: 1,   shards: 5, trackFn: s => s.bingo.games > 0 ? 1 : 0 },
        ],
    },
    spring: {
        name:   'SPRING BLOOM',
        icon:   '🌸',
        color:  '#ec4899',
        badge:  '🌺',
        badgeLabel: 'Bloom Champion',
        goal:   15,
        shardIcon: '🌸',
        quests: [
            { id: 'ev_games5',    desc: 'Play 5 games (any)',       goal: 5,   shards: 3, trackFn: s => s.snake.games + s.ultra.games + s.void.games + s.blob.games + s.bingo.games },
            { id: 'ev_xp100',     desc: 'Earn 100 portal XP',      goal: 100, shards: 3, trackFn: s => Math.min(computeXP(s), 100) },
            { id: 'ev_blob5',     desc: 'Reach mass 500 in Blob',   goal: 500, shards: 2, trackFn: s => Math.min(s.blob.best, 500) },
            { id: 'ev_2048combo', desc: 'Get a 3× combo in 2048',   goal: 1,   shards: 2, trackFn: () => parseInt(localStorage.getItem('u2048_combo3_session') || '0') > 0 ? 1 : 0 },
            { id: 'ev_spin',      desc: 'Use the Daily Spin',       goal: 1,   shards: 5, trackFn: () => localStorage.getItem('portal_spin_date') === todayISO() ? 1 : 0 },
        ],
    },
    summer: {
        name:   'SUMMER SCORCHER',
        icon:   '☀️',
        color:  '#f59e0b',
        badge:  '🌞',
        badgeLabel: 'Summer Champion',
        goal:   15,
        shardIcon: '☀️',
        quests: [
            { id: 'ev_games5',    desc: 'Play 5 games (any)',       goal: 5,   shards: 3, trackFn: s => s.snake.games + s.ultra.games + s.void.games + s.blob.games + s.bingo.games },
            { id: 'ev_snake25',   desc: 'Score 25+ in Snake',       goal: 25,  shards: 3, trackFn: s => Math.min(s.snake.best, 25) },
            { id: 'ev_void5k',    desc: 'Score 5000+ in Void Shift',goal: 5000,shards: 2, trackFn: s => Math.min(s.void.best, 5000) },
            { id: 'ev_2048combo', desc: 'Get a 3× combo in 2048',   goal: 1,   shards: 2, trackFn: () => parseInt(localStorage.getItem('u2048_combo3_session') || '0') > 0 ? 1 : 0 },
            { id: 'ev_bingo1',    desc: 'Play a Jackpot Battle',    goal: 1,   shards: 5, trackFn: s => s.bingo.games > 0 ? 1 : 0 },
        ],
    },
    autumn: {
        name:   'AUTUMN QUEST',
        icon:   '🍂',
        color:  '#f97316',
        badge:  '🍁',
        badgeLabel: 'Harvest Champion',
        goal:   15,
        shardIcon: '🍂',
        quests: [
            { id: 'ev_games5',    desc: 'Play 5 games (any)',       goal: 5,   shards: 3, trackFn: s => s.snake.games + s.ultra.games + s.void.games + s.blob.games + s.bingo.games },
            { id: 'ev_ultra100',  desc: 'Score 1000+ in 2048',      goal: 1000,shards: 3, trackFn: s => Math.min(s.ultra.best, 1000) },
            { id: 'ev_streak3',   desc: 'Login 3 days in a row',    goal: 3,   shards: 2, trackFn: s => Math.min(s.streak, 3) },
            { id: 'ev_2048combo', desc: 'Get a 3× combo in 2048',   goal: 1,   shards: 2, trackFn: () => parseInt(localStorage.getItem('u2048_combo3_session') || '0') > 0 ? 1 : 0 },
            { id: 'ev_spin',      desc: 'Use the Daily Spin',       goal: 1,   shards: 5, trackFn: () => localStorage.getItem('portal_spin_date') === todayISO() ? 1 : 0 },
        ],
    },
};

function getCurrentSeason() {
    const m = new Date().getMonth();
    if (m <= 1 || m === 11) return 'winter';
    if (m <= 4)             return 'spring';
    if (m <= 7)             return 'summer';
    return 'autumn';
}

function getCurrentEvent() {
    return EVENTS[getCurrentSeason()];
}

function getEventShards() {
    return parseInt(localStorage.getItem('portal_event_shards') || '0');
}

function addEventShards(n) {
    const cur = getEventShards();
    localStorage.setItem('portal_event_shards', String(cur + n));
}

function getEventQuestProgress(quest, stats) {
    return Math.min(quest.goal, quest.trackFn(stats));
}

function isEventQuestClaimed(questId) {
    const key = `portal_event_quest_${getCurrentSeason()}_${questId}`;
    return !!localStorage.getItem(key);
}

function claimEventQuest(questId, shards) {
    const key = `portal_event_quest_${getCurrentSeason()}_${questId}`;
    localStorage.setItem(key, '1');
    addEventShards(shards);
    showPortalToast(`+${shards} Shards claimed from quest!`, '🔮', 'shards');
    playSound('claim');
    checkEventCompletion();
    refreshAll();
    renderEventSection(readGameStats());
}

function checkEventCompletion() {
    const ev = getCurrentEvent();
    const shards = getEventShards();
    const badgeKey = `portal_event_badge_${getCurrentSeason()}`;
    if (shards >= ev.goal && !localStorage.getItem(badgeKey)) {
        localStorage.setItem(badgeKey, '1');
        showEventReward(ev);
        playSound('levelup');
        flashScreen(ev.color);
    }
}

function showEventReward(ev) {
    document.getElementById('event-reward-emoji').textContent  = ev.badge;
    document.getElementById('event-reward-desc').textContent   = `You earned the "${ev.badgeLabel}" badge!`;
    document.getElementById('event-badge-preview').textContent = ev.badge;
    document.getElementById('event-reward-modal').classList.remove('hidden');
}

// Get end of current season (approximate)
function getSeasonEnd() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    // End of current season month-group
    const ends = { winter: new Date(y + (m === 11 ? 1 : 0), 2, 1),
                   spring: new Date(y, 6, 1),
                   summer: new Date(y, 9, 1),
                   autumn: new Date(y, 12, 1) };
    return ends[getCurrentSeason()];
}

function formatEventTimer() {
    const diff = getSeasonEnd() - Date.now();
    if (diff <= 0) return 'Ended';
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    if (d > 0) return `${d}d ${h}h`;
    const min = Math.floor((diff % 3_600_000) / 60_000);
    return `${h}h ${min}m`;
}

function renderEventSection(stats) {
    const sec = document.getElementById('event-section');
    if (!sec) return;
    const ev      = getCurrentEvent();
    const shards  = getEventShards();
    const badgeDone = !!localStorage.getItem(`portal_event_badge_${getCurrentSeason()}`);

    sec.classList.remove('hidden');
    sec.style.setProperty('--ev-color', ev.color);
    document.getElementById('event-icon').textContent         = ev.icon;
    document.getElementById('event-name').textContent         = ev.name;
    document.getElementById('event-timer').textContent        = formatEventTimer();
    document.getElementById('event-shards-count').textContent = shards;
    document.getElementById('event-shard-icon').textContent   = ev.shardIcon || '🔮';
    document.getElementById('event-goal-num').textContent     = ev.goal;

    // Progress bar
    const pct = Math.min(100, Math.floor(shards / ev.goal * 100));
    document.getElementById('event-progress-bar').style.width = pct + '%';

    // Reward display
    document.getElementById('event-reward-display').textContent = badgeDone
        ? `✅ ${ev.badge} ${ev.badgeLabel} — CLAIMED!`
        : `${ev.badge} ${ev.badgeLabel} badge`;

    // Quests
    const qRow = document.getElementById('event-quests-row');
    qRow.innerHTML = '';
    ev.quests.forEach(q => {
        const claimed  = isEventQuestClaimed(q.id);
        const progress = getEventQuestProgress(q, stats);
        const done     = progress >= q.goal;
        const pct      = Math.min(100, Math.floor(progress / q.goal * 100));

        const card = document.createElement('div');
        card.className = `ev-quest${claimed ? ' ev-done' : done ? ' ev-claimable' : ''}`;
        card.innerHTML = `
            <div class="ev-quest-desc">${q.desc}</div>
            <div class="ev-quest-progress-bg"><div class="ev-quest-progress-fill" style="width:${pct}%;background:${ev.color}"></div></div>
            <div class="ev-quest-bottom">
                <span class="ev-quest-count">${progress}/${q.goal}</span>
                <span class="ev-quest-reward">${ev.shardIcon || '🔮'} +${q.shards}</span>
                ${done && !claimed
                    ? `<button class="ev-claim-btn" onclick="claimEventQuest('${q.id}',${q.shards})" style="--ev-color:${ev.color}">CLAIM!</button>`
                    : claimed
                        ? '<span class="ev-claimed">✅</span>'
                        : ''}
            </div>
        `;
        qRow.appendChild(card);
    });
}

// ════════════════════════════════════════════════════════
// LOGIN STREAK WIDGET
// ════════════════════════════════════════════════════════

function renderStreakWidget() {
    const widget = document.getElementById('streak-widget');
    if (!widget) return;

    const streak = parseInt(localStorage.getItem('portal_streak') || '0');
    if (streak < 1) { widget.classList.add('hidden'); return; }
    widget.classList.remove('hidden');

    document.getElementById('streak-widget-count').textContent = `${streak} Day Streak`;

    // Next reward label
    const nextIdx = Math.min(streak, DAILY_REWARDS.length - 1);
    const nextReward = DAILY_REWARDS[nextIdx];
    const nextLabel  = document.getElementById('streak-next-label');
    nextLabel.textContent = streak >= 7
        ? '🌟 Max streak bonus!'
        : `Next: +${nextReward.xp} XP, +${nextReward.coins} 🪙 (Day ${Math.min(streak + 1, 7)})`;

    // 7-day calendar
    const row = document.getElementById('streak-days-row');
    row.innerHTML = '';
    const today   = todayISO();
    const lastLog = localStorage.getItem('portal_last_login') || '';
    const dayNames = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

    for (let i = 6; i >= 0; i--) {
        const d   = new Date(Date.now() - i * 86_400_000);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const dayName = dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1];

        // A day is "filled" if it's within the streak from today backwards
        const daysAgo = i;
        const filled  = daysAgo < streak && daysAgo >= 0;
        const isToday = iso === today;

        const cell = document.createElement('div');
        cell.className = `streak-day${filled ? ' streak-filled' : ''}${isToday ? ' streak-today' : ''}`;
        cell.innerHTML = `<span class="streak-day-icon">${filled ? '🔥' : '○'}</span><span class="streak-day-label">${dayName}</span>`;
        row.appendChild(cell);
    }
}

// ════════════════════════════════════════════════════════
// WEEKLY CROSS-GAME EVENTS
// ════════════════════════════════════════════════════════

const WEEKLY_EVENTS = [
    {
        id:    'fire_week',
        name:  '🔥 SAPTAMANA FOCULUI',
        icon:  '🔥',
        color: '#f97316',
        desc:  'Fire is boosted across ALL games this week!',
        bonuses: [
            { game:'blob',  text:'2× XP in Fire form' },
            { game:'ultra', text:'Red tiles give 2× coins' },
            { game:'snake', text:'Snake leaves a fire trail' },
            { game:'tower', text:'Fire towers deal 2× damage' },
        ],
    },
    {
        id:    'void_night',
        name:  '🌑 NOAPTEA VOID',
        icon:  '🌑',
        color: '#a855f7',
        desc:  'Void powers amplified across ALL games!',
        bonuses: [
            { game:'void',  text:'3× XP in Void Shift' },
            { game:'blob',  text:'Shadow form enhanced' },
            { game:'bingo', text:'Void numbers appear more often' },
            { game:'tower', text:'Shadow towers deal 2× damage' },
        ],
    },
    {
        id:    'electric_storm',
        name:  '⚡ FURTUNA ELECTRICA',
        icon:  '⚡',
        color: '#eab308',
        desc:  'Electric energy surges through everything!',
        bonuses: [
            { game:'blob',  text:'Storm form boosted' },
            { game:'ultra', text:'2× combo coins' },
            { game:'snake', text:'Speed +20%' },
            { game:'tower', text:'Storm towers chain to 5 enemies' },
        ],
    },
    {
        id:    'ice_era',
        name:  '❄️ ERA GHETII',
        icon:  '❄️',
        color: '#06b6d4',
        desc:  'Ice and cold dominate this week!',
        bonuses: [
            { game:'blob',  text:'Ice form boosted' },
            { game:'tower', text:'Slow effects last 2× longer' },
            { game:'snake', text:'Ghost mode lasts longer' },
            { game:'bingo', text:'I & N columns appear more' },
        ],
    },
    {
        id:    'divine_light',
        name:  '✨ LUMINA DIVINA',
        icon:  '✨',
        color: '#fbbf24',
        desc:  '2× XP in ALL games this entire week!',
        bonuses: [
            { game:'blob',  text:'Light form boosted' },
            { game:'all',   text:'2× XP everywhere' },
            { game:'snake', text:'Permanent magnet effect' },
            { game:'tower', text:'Light towers stun for 3 seconds' },
        ],
    },
];

function getActiveWeeklyEvent() {
    const weekIdx = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % WEEKLY_EVENTS.length;
    return WEEKLY_EVENTS[weekIdx];
}

function getWeeklyEventTimeLeft() {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekStart = Math.floor(Date.now() / msPerWeek) * msPerWeek;
    const diff      = weekStart + msPerWeek - Date.now();
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

function _gameIcon(game) {
    return { snake:'🐍', ultra:'🔢', void:'⚡', blob:'🧬', bingo:'🎰', tower:'🏰', all:'🌟' }[game] || '🎮';
}

function renderWeeklyEventBanner() {
    const el = document.getElementById('weekly-event-banner');
    if (!el) return;

    const ev = getActiveWeeklyEvent();

    // Persist to localStorage so games can read it
    localStorage.setItem('portal_current_event', ev.id);

    // Track participation for Event Chaser achievement
    const participated = JSON.parse(localStorage.getItem('portal_events_participated') || '[]');
    if (!participated.includes(ev.id)) {
        participated.push(ev.id);
        localStorage.setItem('portal_events_participated', JSON.stringify(participated));
    }

    el.style.setProperty('--wev-color', ev.color);
    el.classList.remove('hidden');
    el.innerHTML = `
        <div class="wev-header">
            <span class="wev-icon">${ev.icon}</span>
            <div class="wev-body">
                <div class="wev-name">${ev.name}</div>
                <div class="wev-desc">${ev.desc}</div>
            </div>
            <div class="wev-countdown">
                <div class="wev-cd-label">ENDS IN</div>
                <div class="wev-cd-val">${getWeeklyEventTimeLeft()}</div>
            </div>
        </div>
        <div class="wev-bonuses">
            ${ev.bonuses.map(b => `
                <div class="wev-bonus">
                    <span class="wev-bonus-game">${_gameIcon(b.game)}</span>
                    <span class="wev-bonus-text">${b.text}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════

// Spin wheel button events
document.addEventListener('DOMContentLoaded', () => {
    const spinBtn      = document.getElementById('spin-btn');
    const spinCloseBtn = document.getElementById('spin-close-btn');
    if (spinBtn)      spinBtn.addEventListener('click', doSpin);
    if (spinCloseBtn) spinCloseBtn.addEventListener('click', closeSpinModal);
    // Close spin modal on overlay click
    const spinModal = document.getElementById('spin-modal');
    if (spinModal) spinModal.addEventListener('click', e => {
        if (e.target === spinModal) closeSpinModal();
    });
    // Event reward modal close
    const evRewardClose = document.getElementById('event-reward-close');
    if (evRewardClose) evRewardClose.addEventListener('click', () => {
        document.getElementById('event-reward-modal').classList.add('hidden');
    });
    // Close event reward on overlay click
    const evRewardModal = document.getElementById('event-reward-modal');
    if (evRewardModal) evRewardModal.addEventListener('click', e => {
        if (e.target === evRewardModal) evRewardModal.classList.add('hidden');
    });
});

init();
