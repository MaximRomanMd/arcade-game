import http from 'node:http';
import {
  openDb, upsertPlatform, getPlatformBySlug, getPlatform, listPlatforms,
  upsertUser, getUser, createSession, getSession, touchSession,
  createRound, getRound, settleRound, recentTx,
} from './db/index.mjs';
import { walletBalance, walletWager, walletWin, isMock, gameType } from './platform/callPartner.mjs';
import { verifyLaunch, requirePlatformAuth } from './platform/security.mjs';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const ORIGIN = process.env.CORS_ORIGIN || 'https://nextbytegames.com';
const DEFAULT_SLUG = process.env.PARTNER_SLUG || 'abyss';

openDb();
// Seed the default platform (mock by default; real config from env if present).
if (!getPlatformBySlug(DEFAULT_SLUG)) {
  upsertPlatform({ slug: DEFAULT_SLUG, displayName: 'Abyss (default)', callbackBaseUrl: process.env.PARTNER_CALLBACK_BASE_URL || null, webhookSecret: process.env.PARTNER_WEBHOOK_SECRET || null, isActive: 1 });
}

const SEEDS = [73737,7,1337,3141,6789,24680,5050,8128,42424,100001,42,999,12321,31415,271828];
const pick = () => SEEDS[Math.floor(Math.random() * SEEDS.length)];

const cors = () => ({ 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Cache-Control': 'no-store' });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors() }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); });
function ctx(req) { const h = req.headers.authorization || ''; const s = getSession(h.startsWith('Bearer ') ? h.slice(7) : ''); if (!s) return null; touchSession(s.token); const u = getUser(s.userId); const p = getPlatform(s.platformId); return u && p ? { session: s, user: u, platform: p } : null; }

const routes = {
  'GET /api/health': async () => ({ code: 200, body: { ok: true, mock: isMock(), gameType: gameType() } }),

  // Launch handshake. Real: partner mints HMAC(`${userId}.${ts}`, platform secret).
  // Mock: dev guest allowed. Resolves platform → upserts user → opens a session.
  'POST /api/launch': async (req) => {
    const b = await readBody(req);
    const platform = getPlatformBySlug(String(b.platform || DEFAULT_SLUG));
    if (!platform || !platform.isActive) return { code: 401, body: { error: 'UNKNOWN_PLATFORM' } };
    let externalPlayerId = null;
    if (b.sig) { const v = verifyLaunch(b.userId, b.ts, b.sig, platform.webhookSecret || undefined); if (!v) return { code: 401, body: { error: 'BAD_LAUNCH_TOKEN' } }; externalPlayerId = v.userId; }
    else if (isMock()) externalPlayerId = String(b.userId || ('guest-' + Math.random().toString(36).slice(2, 10)));
    else return { code: 401, body: { error: 'LAUNCH_REQUIRED' } };
    const user = upsertUser(platform.id, externalPlayerId, b.displayName);
    const token = createSession(platform.id, user.id);
    const balance = await walletBalance({ platform, userId: user.id, externalPlayerId });
    return { code: 200, body: { token, userId: user.id, externalPlayerId, platform: platform.slug, balance } };
  },

  'GET /api/wallet/balance': async (req) => {
    const c = ctx(req); if (!c) return { code: 401, body: { error: 'NO_SESSION' } };
    return { code: 200, body: await walletBalance({ platform: c.platform, userId: c.user.id, externalPlayerId: c.user.externalPlayerId }) };
  },

  // Enter a round: server picks the board (seed) + debits the stake (wager).
  'POST /api/round/start': async (req) => {
    const c = ctx(req); if (!c) return { code: 401, body: { error: 'NO_SESSION' } };
    const b = await readBody(req); const stake = Math.max(0, Number(b.stake || 0));
    const round = createRound({ platformId: c.platform.id, userId: c.user.id, gameType: gameType(), seed: pick(), stake });
    if (stake > 0) {
      const w = await walletWager({ platform: c.platform, userId: c.user.id, externalPlayerId: c.user.externalPlayerId, roundId: round.id, uniqueId: `wager:${round.id}`, amount: stake, gameId: round.id });
      if (!w.ok) return { code: 402, body: { error: w.error || 'WAGER_FAILED' } };
    }
    return { code: 200, body: { roundId: round.id, seed: round.seed, stake, balance: await walletBalance({ platform: c.platform, userId: c.user.id, externalPlayerId: c.user.externalPlayerId }) } };
  },

  // Settle: derive payout, credit the win, persist the round result.
  // MOCK payout formula; real version replays seed+inputs server-side (never trust b.score).
  'POST /api/round/settle': async (req) => {
    const c = ctx(req); if (!c) return { code: 401, body: { error: 'NO_SESSION' } };
    const b = await readBody(req); const round = getRound(b.roundId);
    if (!round || round.userId !== c.user.id) return { code: 404, body: { error: 'ROUND_NOT_FOUND' } };
    if (round.status === 'SETTLED') return { code: 200, body: { payout: round.payout, balance: await walletBalance({ platform: c.platform, userId: c.user.id, externalPlayerId: c.user.externalPlayerId }), replay: true } };
    const score = Math.max(0, Number(b.score || 0));
    const payout = Math.round(Math.min(score / 2000, 5) * (round.stake || 1) * 100) / 100;
    if (payout > 0) await walletWin({ platform: c.platform, userId: c.user.id, externalPlayerId: c.user.externalPlayerId, roundId: round.id, uniqueId: `win:${round.id}`, amount: payout, gameId: round.id });
    settleRound(round.id, score, payout);
    return { code: 200, body: { payout, seed: round.seed, balance: await walletBalance({ platform: c.platform, userId: c.user.id, externalPlayerId: c.user.externalPlayerId }) } };
  },

  // ── ops / admin (server-to-server API key) ──
  'GET /api/admin/audit': async (req) => requirePlatformAuth(req) ? { code: 200, body: { recent: recentTx(50) } } : { code: 401, body: { error: 'UNAUTHORIZED' } },
  'GET /api/admin/platforms': async (req) => requirePlatformAuth(req) ? { code: 200, body: { platforms: listPlatforms() } } : { code: 401, body: { error: 'UNAUTHORIZED' } },
  'POST /api/admin/platforms': async (req) => {
    if (!requirePlatformAuth(req)) return { code: 401, body: { error: 'UNAUTHORIZED' } };
    const b = await readBody(req); if (!b.slug) return { code: 400, body: { error: 'slug required' } };
    const p = upsertPlatform({ slug: b.slug, displayName: b.displayName, callbackBaseUrl: b.callbackBaseUrl, webhookSecret: b.webhookSecret, webhookSecretNext: b.webhookSecretNext, allowedIps: b.allowedIps, isActive: b.isActive ?? 1 });
    return { code: 200, body: { id: p.id, slug: p.slug, isActive: p.isActive } };
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors()); return res.end(); }
  const h = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (!h) return send(res, 404, { error: 'NOT_FOUND' });
  try { const { code, body } = await h(req); send(res, code, body); }
  catch (e) { send(res, 500, { error: 'SERVER_ERROR', detail: String(e.message || e) }); }
});
server.listen(PORT, HOST, () => console.log(`[abyss-api] http://${HOST}:${PORT}  mock=${isMock()}  platform=${DEFAULT_SLUG}`));
