import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { walletBalance, walletWager, walletWin, walletWagerCancel, isMock, audit } from './platform/callPartner.mjs';
import { verifyLaunch, requirePlatformAuth } from './platform/security.mjs';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const ORIGIN = process.env.CORS_ORIGIN || 'https://nextbytegames.com';

// Server-authoritative board pool (mirrors the client MATCH_SEEDS).
const SEEDS = [73737,7,1337,3141,6789,24680,5050,8128,42424,100001,42,999,12321,31415,271828];
const rand = (a) => a[Math.floor(Math.random() * a.length)];

const sessions = new Map();   // sessionToken -> { userId }
const rounds = new Map();     // roundId -> { userId, seed, stake, settled, payout }

const cors = () => ({
  'Access-Control-Allow-Origin': ORIGIN, 'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
});
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors() }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); });
const session = (req) => { const h = req.headers.authorization || ''; return sessions.get(h.startsWith('Bearer ') ? h.slice(7) : ''); };

const routes = {
  'GET /api/health': async () => ({ code: 200, body: { ok: true, mock: isMock() } }),

  // Launch handshake: a partner-minted HMAC launch token, or (mock only) a dev guest.
  'POST /api/launch': async (req) => {
    const b = await readBody(req);
    let userId = null;
    if (b.sig) { const v = verifyLaunch(b.userId, b.ts, b.sig); if (!v) return { code: 401, body: { error: 'BAD_LAUNCH_TOKEN' } }; userId = v.userId; }
    else if (isMock()) { userId = String(b.userId || ('guest-' + randomUUID().slice(0, 8))); }
    else return { code: 401, body: { error: 'LAUNCH_REQUIRED' } };
    const token = randomUUID(); sessions.set(token, { userId });
    const bal = await walletBalance(userId);
    return { code: 200, body: { token, userId, balance: bal } };
  },

  'GET /api/wallet/balance': async (req) => {
    const s = session(req); if (!s) return { code: 401, body: { error: 'NO_SESSION' } };
    return { code: 200, body: await walletBalance(s.userId) };
  },

  // Enter a round: server picks the board (seed) and debits the stake via the wallet.
  'POST /api/round/start': async (req) => {
    const s = session(req); if (!s) return { code: 401, body: { error: 'NO_SESSION' } };
    const b = await readBody(req); const stake = Math.max(0, Number(b.stake || 0));
    const roundId = randomUUID(); const seed = rand(SEEDS);
    if (stake > 0) {
      const w = await walletWager({ userId: s.userId, uniqueId: `wager:${roundId}`, amount: stake, gameId: roundId });
      if (!w.ok) return { code: 402, body: { error: w.error || 'WAGER_FAILED' } };
    }
    rounds.set(roundId, { userId: s.userId, seed, stake, settled: false });
    return { code: 200, body: { roundId, seed, stake, balance: await walletBalance(s.userId) } };
  },

  // Settle: derive payout and credit the win. (MOCK payout; real version replays
  // seed+inputs server-side to derive an authoritative score — never trust b.score.)
  'POST /api/round/settle': async (req) => {
    const s = session(req); if (!s) return { code: 401, body: { error: 'NO_SESSION' } };
    const b = await readBody(req); const r = rounds.get(b.roundId);
    if (!r || r.userId !== s.userId) return { code: 404, body: { error: 'ROUND_NOT_FOUND' } };
    if (r.settled) return { code: 200, body: { payout: r.payout, balance: await walletBalance(s.userId), replay: true } };
    const score = Math.max(0, Number(b.score || 0));
    const payout = Math.round(Math.min(score / 2000, 5) * (r.stake || 1) * 100) / 100;
    if (payout > 0) await walletWin({ userId: s.userId, uniqueId: `win:${b.roundId}`, amount: payout, gameId: b.roundId });
    r.settled = true; r.payout = payout;
    return { code: 200, body: { payout, balance: await walletBalance(s.userId), seed: r.seed } };
  },

  // Ops: outbound transaction audit (server-to-server API key).
  'GET /api/admin/audit': async (req) => requirePlatformAuth(req) ? { code: 200, body: { count: audit.length, recent: audit.slice(-50) } } : { code: 401, body: { error: 'UNAUTHORIZED' } },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors()); return res.end(); }
  const h = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (!h) return send(res, 404, { error: 'NOT_FOUND' });
  try { const { code, body } = await h(req); send(res, code, body); }
  catch (e) { send(res, 500, { error: 'SERVER_ERROR', detail: String(e.message || e) }); }
});
server.listen(PORT, HOST, () => console.log(`[abyss-api] http://${HOST}:${PORT}  mock=${isMock()}`));
