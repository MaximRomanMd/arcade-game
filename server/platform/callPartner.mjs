import { randomUUID } from 'node:crypto';
import { findEndpoint, buildCallbackUrl } from './callbacks.mjs';
import { sign, canonicalQuery } from './security.mjs';
import { mockBalance, mockWager, mockWin } from '../wallet/mock.mjs';

// Outbound seamless-wallet client. The provider SEAM lives here: in MOCK mode
// every call is served by the local mock wallet; otherwise it's an HMAC-signed
// HTTPS call to the partner (same scheme as Bingo-System callPartner).
const MOCK = (process.env.MOCK_EXTERNAL_API_MODE ?? 'true') === 'true';
const BASE = process.env.PARTNER_CALLBACK_BASE_URL || '';
const SECRET = process.env.PARTNER_WEBHOOK_SECRET || '';
const SLUG = process.env.PARTNER_SLUG || 'abyss';
const GAME_TYPE = process.env.GAME_TYPE || 'FISH_ABYSS';
const TIMEOUT = Number(process.env.PARTNER_TIMEOUT_MS || 10000);

// In-memory audit trail (mirrors PlatformTransaction). Swap for a DB later.
export const audit = [];
function record(row) { audit.push({ id: randomUUID(), at: new Date().toISOString(), ...row }); if (audit.length > 5000) audit.shift(); }

async function callPartner(endpointName, { query, body } = {}) {
  const endpoint = findEndpoint(endpointName);
  if (MOCK) return { ok: true, status: 200, body: null, mock: true };   // real branch below is bypassed in mock mode
  if (!BASE || !SECRET) throw new Error('partner BASE/SECRET not configured (set MOCK_EXTERNAL_API_MODE=true for local)');
  const url = `${buildCallbackUrl(BASE, endpointName)}${query ? '?' + new URLSearchParams(
    Object.fromEntries(Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))).toString() : ''}`;
  const rawBody = body !== undefined ? JSON.stringify(body) : '';
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = sign(ts, endpoint.method, canonicalQuery(query), rawBody, SECRET);
  const headers = { Accept: 'application/json', 'e2e-ts': ts, 'e2e-sig': signature, 'X-Game-Platform': SLUG };
  if (rawBody && endpoint.method !== 'GET') headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const started = Date.now();
  try {
    const resp = await fetch(url, { method: endpoint.method, headers, body: endpoint.method === 'GET' ? undefined : rawBody, signal: ctrl.signal });
    const text = await resp.text().catch(() => '');
    let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {}
    const res = { ok: resp.ok, status: resp.status, body: parsed, latencyMs: Date.now() - started };
    record({ endpoint: endpointName, direction: 'OUTBOUND', status: res.ok ? 'DELIVERED' : 'FAILED', code: res.status });
    return res;
  } catch (e) {
    record({ endpoint: endpointName, direction: 'OUTBOUND', status: 'FAILED', error: String(e.message || e) });
    return { ok: false, status: 0, body: null, error: String(e.message || e) };
  } finally { clearTimeout(timer); }
}

// ── typed wrappers (the only API the game handlers use) ──
export async function walletBalance(userId) {
  if (MOCK) return mockBalance(userId);
  const r = await callPartner('balance', { query: { userId } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: 'BALANCE_FAILED' };
}

// Debit a stake. uniqueId is the idempotency key (one per round entry).
export async function walletWager({ userId, uniqueId, amount, gameId }) {
  if (MOCK) return mockWager(userId, uniqueId, amount);
  const r = await callPartner('wager', { body: { userId, gameId, gameType: GAME_TYPE, fundTransfer: { uniqueId, balance: { realMoney: String(amount) } } } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: r.status === 402 ? 'INSUFFICIENT_FUNDS' : 'WAGER_FAILED' };
}

// Credit a win. uniqueId idempotency key (one per round settlement).
export async function walletWin({ userId, uniqueId, amount, gameId }) {
  if (MOCK) return mockWin(userId, uniqueId, amount);
  const r = await callPartner('win', { body: { userId, gameId, gameType: GAME_TYPE, fundTransfer: { uniqueId, balance: { realMoney: String(amount) } } } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: 'WIN_FAILED' };
}

// Refund a wager (round cancelled before settle).
export async function walletWagerCancel({ uniqueId }) {
  if (MOCK) return { ok: true };
  const r = await callPartner('wagerCancel', { body: { fundTransfer: { uniqueId }, action: 'cancel' } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: 'CANCEL_FAILED' };
}

export const isMock = () => MOCK;
export const gameType = () => GAME_TYPE;
