import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Internal datastore — mirrors Bingo's model (platforms / users / sessions /
// rounds / transactions ledger), on SQLite (ACID, ~MB RAM — right for a t3.micro;
// the repo API below abstracts it, so swapping to Postgres later is contained).
const CURRENCY = process.env.CURRENCY || 'USD';
const START = Number(process.env.MOCK_START_BALANCE || 10000);
const now = () => new Date().toISOString();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, displayName TEXT,
  callbackBaseUrl TEXT, webhookSecret TEXT, webhookSecretNext TEXT,
  allowedIps TEXT, isActive INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, platformId TEXT NOT NULL, externalPlayerId TEXT,
  displayName TEXT, currency TEXT NOT NULL DEFAULT '${CURRENCY}', mockBalance REAL,
  createdAt TEXT NOT NULL, lastSeenAt TEXT,
  UNIQUE(platformId, externalPlayerId));
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, platformId TEXT NOT NULL, userId TEXT NOT NULL,
  createdAt TEXT NOT NULL, lastActivityAt TEXT NOT NULL, expiresAt TEXT,
  revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY, platformId TEXT NOT NULL, userId TEXT NOT NULL,
  gameType TEXT NOT NULL, seed INTEGER NOT NULL, stake REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN', score INTEGER, payout REAL,
  createdAt TEXT NOT NULL, settledAt TEXT);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, platformId TEXT, userId TEXT, roundId TEXT,
  type TEXT NOT NULL, direction TEXT NOT NULL, uniqueId TEXT UNIQUE,
  amount REAL, currency TEXT, status TEXT NOT NULL, responseCode INTEGER,
  payload TEXT, response TEXT, createdAt TEXT NOT NULL, updatedAt TEXT);
CREATE INDEX IF NOT EXISTS idx_tx_round ON transactions(roundId);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(userId);
`;

let db;
export function openDb(path = process.env.DB_PATH || new URL('../data/abyss.db', import.meta.url).pathname) {
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000;');
  db.exec(SCHEMA);
  return db;
}

// ── platforms ──
export function upsertPlatform(p) {
  const ex = getPlatformBySlug(p.slug);
  if (ex) {
    db.prepare(`UPDATE platforms SET displayName=?,callbackBaseUrl=?,webhookSecret=?,webhookSecretNext=?,allowedIps=?,isActive=? WHERE id=?`)
      .run(p.displayName ?? ex.displayName, p.callbackBaseUrl ?? ex.callbackBaseUrl, p.webhookSecret ?? ex.webhookSecret,
           p.webhookSecretNext ?? ex.webhookSecretNext, p.allowedIps ?? ex.allowedIps, p.isActive ?? ex.isActive, ex.id);
    return getPlatformBySlug(p.slug);
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO platforms(id,slug,displayName,callbackBaseUrl,webhookSecret,webhookSecretNext,allowedIps,isActive,createdAt) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(id, p.slug, p.displayName ?? null, p.callbackBaseUrl ?? null, p.webhookSecret ?? null, p.webhookSecretNext ?? null, p.allowedIps ?? null, p.isActive ?? 1, now());
  return getPlatform(id);
}
export const getPlatform = (id) => db.prepare('SELECT * FROM platforms WHERE id=?').get(id) || null;
export const getPlatformBySlug = (slug) => db.prepare('SELECT * FROM platforms WHERE slug=?').get(slug) || null;
export const listPlatforms = () => db.prepare('SELECT id,slug,displayName,callbackBaseUrl,isActive,createdAt FROM platforms').all();

// ── users (one per external player, per platform) ──
export function upsertUser(platformId, externalPlayerId, displayName) {
  const ex = db.prepare('SELECT * FROM users WHERE platformId=? AND externalPlayerId IS ?').get(platformId, externalPlayerId ?? null);
  if (ex) { db.prepare('UPDATE users SET lastSeenAt=? WHERE id=?').run(now(), ex.id); return ex; }
  const id = randomUUID();
  db.prepare('INSERT INTO users(id,platformId,externalPlayerId,displayName,currency,mockBalance,createdAt,lastSeenAt) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, platformId, externalPlayerId ?? null, displayName ?? null, CURRENCY, START, now(), now());
  return getUser(id);
}
export const getUser = (id) => db.prepare('SELECT * FROM users WHERE id=?').get(id) || null;
export const getUserBalance = (id) => { const u = getUser(id); return u ? Number(u.mockBalance) : 0; };

// ── sessions (embed/launch session with activity + expiry) ──
export function createSession(platformId, userId, maxHours = Number(process.env.EMBED_SESSION_MAX_HOURS || 8)) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + maxHours * 3600e3).toISOString();
  db.prepare('INSERT INTO sessions(token,platformId,userId,createdAt,lastActivityAt,expiresAt,revoked) VALUES(?,?,?,?,?,?,0)')
    .run(token, platformId, userId, now(), now(), expiresAt);
  return token;
}
export function getSession(token) {
  const s = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!s || s.revoked) return null;
  if (s.expiresAt && s.expiresAt < now()) return null;
  const idleMin = Number(process.env.EMBED_SESSION_IDLE_MINUTES || 15);
  if (Date.now() - Date.parse(s.lastActivityAt) > idleMin * 60e3) { db.prepare('UPDATE sessions SET revoked=1 WHERE token=?').run(token); return null; }
  return s;
}
export const touchSession = (token) => db.prepare('UPDATE sessions SET lastActivityAt=? WHERE token=?').run(now(), token);

// ── rounds ──
export function createRound({ platformId, userId, gameType, seed, stake }) {
  const id = randomUUID();
  db.prepare('INSERT INTO rounds(id,platformId,userId,gameType,seed,stake,status,createdAt) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, platformId, userId, gameType, seed, stake, 'OPEN', now());
  return getRound(id);
}
export const getRound = (id) => db.prepare('SELECT * FROM rounds WHERE id=?').get(id) || null;
export const settleRound = (id, score, payout) => db.prepare("UPDATE rounds SET status='SETTLED',score=?,payout=?,settledAt=? WHERE id=?").run(score, payout, now(), id);

// ── transactions ledger ──
export const getTxByUniqueId = (uniqueId) => db.prepare('SELECT * FROM transactions WHERE uniqueId=?').get(uniqueId) || null;
export const recentTx = (limit = 50) => db.prepare('SELECT id,platformId,userId,roundId,type,direction,uniqueId,amount,status,responseCode,createdAt FROM transactions ORDER BY createdAt DESC LIMIT ?').all(limit);

// Atomic MOCK wallet op: idempotency + balance change + ledger row in one tx.
export function mockWalletTx({ platformId, userId, roundId, type, uniqueId, amount }) {
  const dup = getTxByUniqueId(uniqueId);
  if (dup) return { ok: true, replay: true, balance: getUserBalance(userId) };
  amount = Math.round(Number(amount) * 100) / 100;
  if (!(amount >= 0)) return { ok: false, error: 'BAD_AMOUNT' };
  db.exec('BEGIN');
  try {
    const bal = getUserBalance(userId);
    let nb;
    if (type === 'wager') {
      if (bal < amount) { db.exec('ROLLBACK'); return { ok: false, error: 'INSUFFICIENT_FUNDS', balance: bal }; }
      nb = Math.round((bal - amount) * 100) / 100;
    } else { nb = Math.round((bal + amount) * 100) / 100; }   // win / refund-credit
    db.prepare('UPDATE users SET mockBalance=?,lastSeenAt=? WHERE id=?').run(nb, now(), userId);
    db.prepare('INSERT INTO transactions(id,platformId,userId,roundId,type,direction,uniqueId,amount,currency,status,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(), platformId, userId, roundId ?? null, type, 'INTERNAL', uniqueId, amount, CURRENCY, 'DELIVERED', now(), now());
    db.exec('COMMIT');
    return { ok: true, balance: nb };
  } catch (e) { try { db.exec('ROLLBACK'); } catch {} return { ok: false, error: 'TX_ERROR' }; }
}

// Outbound (real partner) audit: PENDING before the call, finalized after.
export function recordOutbound({ platformId, userId, roundId, type, uniqueId, amount, payload }) {
  const id = randomUUID();
  db.prepare('INSERT INTO transactions(id,platformId,userId,roundId,type,direction,uniqueId,amount,currency,status,payload,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, platformId ?? null, userId ?? null, roundId ?? null, type, 'OUTBOUND', uniqueId ?? null, amount ?? null, CURRENCY, 'PENDING', payload ? JSON.stringify(payload) : null, now(), now());
  return id;
}
export const finishOutbound = (id, { status, responseCode, response }) =>
  db.prepare('UPDATE transactions SET status=?,responseCode=?,response=?,updatedAt=? WHERE id=?')
    .run(status, responseCode ?? null, response ? String(response).slice(0, 4000) : null, now(), id);
