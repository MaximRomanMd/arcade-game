import { createHmac, timingSafeEqual } from 'node:crypto';

// HMAC scheme — IDENTICAL to Bingo-System / HappyHippo middleware so the same
// partner verifies our outbound calls and we verify their inbound ones:
//
//   canonical = ts + METHOD + (query ? "?" + sortedQuery : "") + rawBody
//   signature = HMAC_SHA256(canonical, key).hex
//
// If the shared secret is even-length pure hex, the key is the DECODED BYTES
// (hex2bin) — matches the partner's BingoEngageMiddleware. Otherwise raw UTF-8.
const TS_WINDOW_SECONDS = 300;

function secretKey(secret) {
  const isHex = /^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0;
  return isHex ? Buffer.from(secret, 'hex') : secret;
}

// Query params sorted alphabetically (matches PHP Symfony ksort), or "".
export function canonicalQuery(query) {
  if (!query) return '';
  const pairs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${String(v)}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export function sign(ts, method, cQuery, rawBody, secret) {
  const canonical = `${ts}${method}${cQuery}${rawBody}`;
  return createHmac('sha256', secretKey(secret)).update(canonical, 'utf8').digest('hex');
}

// Verify an inbound signature against current + optional next secret (rotation).
// Returns 'current' | 'next' | null. Constant-time compare.
export function verify(canonical, providedHex, secret, secretNext) {
  if (!providedHex) return null;
  const provided = Buffer.from(String(providedHex).toLowerCase(), 'utf8');
  for (const [label, s] of [['current', secret], ['next', secretNext]]) {
    if (!s) continue;
    const expected = Buffer.from(createHmac('sha256', secretKey(s)).update(canonical, 'utf8').digest('hex'), 'utf8');
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) return label;
  }
  return null;
}

export function freshTimestamp(tsHeader) {
  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - ts) <= TS_WINDOW_SECONDS;
}

// Inbound server-to-server auth for partner/admin routes (bearer API key).
export function requirePlatformAuth(req) {
  const expected = process.env.GAME_API_KEY || '';
  if (!expected) return false;
  const h = req.headers['authorization'] || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : '';
  const key = bearer || req.headers['x-game-api-key'] || '';
  if (!key) return false;
  const a = Buffer.from(String(key)); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Verify a partner-minted launch token: HMAC(`${userId}.${ts}`, secret).
// Signed with the platform's webhookSecret (or LAUNCH_SECRET fallback).
// Returns { userId } or null. (Mirrors the iframe launch-session handshake.)
export function verifyLaunch(userId, ts, sig, secret = process.env.LAUNCH_SECRET || '') {
  if (!secret || !userId || !freshTimestamp(ts)) return null;
  const expected = createHmac('sha256', secretKey(secret)).update(`${userId}.${ts}`, 'utf8').digest('hex');
  const a = Buffer.from(String(sig || '').toLowerCase()); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? { userId: String(userId) } : null;
}
