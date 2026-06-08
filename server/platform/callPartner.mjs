import { findEndpoint, buildCallbackUrl } from './callbacks.mjs';
import { sign, canonicalQuery } from './security.mjs';
import { mockWalletTx, getUserBalance, recordOutbound, finishOutbound } from '../db/index.mjs';

// Outbound seamless-wallet client + provider SEAM. In MOCK mode every op is the
// local SQLite-backed wallet (authoritative balance + ledger). Otherwise it's an
// HMAC-signed HTTPS call to the partner — SAME wire scheme as Bingo-System — and
// every attempt is written to the transactions ledger (PENDING -> DELIVERED/FAILED).
const MOCK = (process.env.MOCK_EXTERNAL_API_MODE ?? 'true') === 'true';
const GAME_TYPE = process.env.GAME_TYPE || 'FISH_ABYSS';
const TIMEOUT = Number(process.env.PARTNER_TIMEOUT_MS || 10000);
const CURRENCY = process.env.CURRENCY || 'USD';
export const isMock = () => MOCK;
export const gameType = () => GAME_TYPE;

async function signedCall(platform, endpointName, { query, body, audit } = {}) {
  const endpoint = findEndpoint(endpointName);
  const txId = recordOutbound({ platformId: platform.id, userId: audit?.userId, roundId: audit?.roundId, uniqueId: audit?.uniqueId, amount: audit?.amount, type: audit?.type || endpointName, payload: { query, body } });
  if (!platform.callbackBaseUrl || !platform.webhookSecret) { finishOutbound(txId, { status: 'FAILED', response: 'NO_PARTNER_CONFIG' }); return { ok: false, status: 0, error: 'NO_PARTNER_CONFIG' }; }
  const qs = query ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))).toString() : '';
  const url = buildCallbackUrl(platform.callbackBaseUrl, endpointName) + qs;
  const rawBody = body !== undefined ? JSON.stringify(body) : '';
  const ts = String(Math.floor(Date.now() / 1000));
  const sigv = sign(ts, endpoint.method, canonicalQuery(query), rawBody, platform.webhookSecret);
  const headers = { Accept: 'application/json', 'e2e-ts': ts, 'e2e-sig': sigv, 'X-Game-Platform': platform.slug };
  if (rawBody && endpoint.method !== 'GET') headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { method: endpoint.method, headers, body: endpoint.method === 'GET' ? undefined : rawBody, signal: ctrl.signal });
    const text = await resp.text().catch(() => ''); let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {}
    finishOutbound(txId, { status: resp.ok ? 'DELIVERED' : 'FAILED', responseCode: resp.status, response: typeof parsed === 'string' ? parsed : JSON.stringify(parsed) });
    return { ok: resp.ok, status: resp.status, body: parsed };
  } catch (e) { finishOutbound(txId, { status: 'FAILED', response: String(e.message || e) }); return { ok: false, status: 0, error: String(e.message || e) }; }
  finally { clearTimeout(timer); }
}

const bal = (b) => ({ ok: true, realMoney: Number(b).toFixed(2), bonusMoney: '0.00', currency: CURRENCY });

export async function walletBalance({ platform, userId, externalPlayerId }) {
  if (MOCK) return bal(getUserBalance(userId));
  const r = await signedCall(platform, 'balance', { query: { userId: externalPlayerId }, audit: { userId, type: 'balance' } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: 'BALANCE_FAILED' };
}

export async function walletWager({ platform, userId, externalPlayerId, roundId, uniqueId, amount, gameId }) {
  if (MOCK) { const m = mockWalletTx({ platformId: platform.id, userId, roundId, type: 'wager', uniqueId, amount }); return m.ok ? { ...bal(m.balance), replay: m.replay } : m; }
  const r = await signedCall(platform, 'wager', { body: { userId: externalPlayerId, gameId, gameType: GAME_TYPE, fundTransfer: { uniqueId, balance: { realMoney: String(amount) } } }, audit: { userId, roundId, uniqueId, amount, type: 'wager' } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: r.status === 402 ? 'INSUFFICIENT_FUNDS' : 'WAGER_FAILED' };
}

export async function walletWin({ platform, userId, externalPlayerId, roundId, uniqueId, amount, gameId }) {
  if (MOCK) { const m = mockWalletTx({ platformId: platform.id, userId, roundId, type: 'win', uniqueId, amount }); return m.ok ? { ...bal(m.balance), replay: m.replay } : m; }
  const r = await signedCall(platform, 'win', { body: { userId: externalPlayerId, gameId, gameType: GAME_TYPE, fundTransfer: { uniqueId, balance: { realMoney: String(amount) } } }, audit: { userId, roundId, uniqueId, amount, type: 'win' } });
  return r.ok ? { ok: true, ...r.body } : { ok: false, error: 'WIN_FAILED' };
}
