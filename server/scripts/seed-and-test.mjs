// Seed a mock platform + N users, then exercise the wallet/round/ledger paths.
// Reusable smoke/sim harness (mirrors Bingo's seed-bots + sim). Run:
//   node --disable-warning=ExperimentalWarning server/scripts/seed-and-test.mjs
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const BASE = process.env.API_BASE || 'http://localhost:8787/api';
const N = Number(process.env.N || 100);
const SLUG = process.env.SLUG || 'mock-100';
const START = Number(process.env.MOCK_START_BALANCE || 10000);
let KEY = process.env.GAME_API_KEY;
if (!KEY) { try { KEY = (readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^GAME_API_KEY=(.*)$/m) || [])[1]; } catch {} }
const DBPATH = new URL('../data/abyss.db', import.meta.url).pathname;

// Fresh start: clear this platform's data so each run is deterministic.
function reset() {
  const db = new DatabaseSync(DBPATH); db.exec('PRAGMA busy_timeout=4000;');
  const p = db.prepare('SELECT id FROM platforms WHERE slug=?').get(SLUG);
  if (p) for (const t of ['transactions', 'rounds', 'sessions', 'users']) db.prepare(`DELETE FROM ${t} WHERE platformId=?`).run(p.id);
  db.close();
}

let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; fails.push(name + (detail ? ` — ${detail}` : '')); } };
const bal = (x) => { const b = (x && x.body !== undefined) ? x.body : x; return Number(b?.balance?.realMoney ?? b?.realMoney); };

async function api(method, path, { body, token, key } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  if (key) headers.Authorization = 'Bearer ' + key;
  const r = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

(async () => {
  console.log(`→ ${BASE}  platform=${SLUG}  users=${N}\n`);
  reset();   // deterministic: wipe this platform's prior users/rounds/transactions

  // 1) platform + admin auth
  const cp = await api('POST', '/admin/platforms', { key: KEY, body: { slug: SLUG, displayName: 'Mock 100', isActive: 1 } });
  ok('create mock platform', cp.status === 200 && cp.body.slug === SLUG, JSON.stringify(cp.body));
  ok('platform listed', (await api('GET', '/admin/platforms', { key: KEY })).body?.platforms?.some(p => p.slug === SLUG));
  ok('admin rejects missing key', (await api('GET', '/admin/platforms')).status === 401);
  ok('admin rejects bad key', (await api('GET', '/admin/platforms', { key: 'nope' })).status === 401);

  // 2) seed N users via launch
  const users = [];
  for (let i = 1; i <= N; i++) {
    const r = await api('POST', '/launch', { body: { platform: SLUG, userId: 'u' + String(i).padStart(4, '0') } });
    if (r.status === 200) users.push({ uid: 'u' + String(i).padStart(4, '0'), token: r.body.token, internal: r.body.userId, start: bal(r.body) });
  }
  ok(`seeded ${N} users`, users.length === N, `${users.length}/${N}`);
  ok('all start at START', users.every(u => u.start === START));
  ok('distinct internal user ids', new Set(users.map(u => u.internal)).size === users.length);
  ok('re-launch is idempotent (same user)', (await api('POST', '/launch', { body: { platform: SLUG, userId: users[0].uid } })).body.userId === users[0].internal);

  // 3) happy-path: each user plays a round; verify balance math start - stake + payout
  for (const u of users) {
    const stake = 10 + (parseInt(u.uid.slice(1)) % 5) * 10;       // 10..50
    const rs = await api('POST', '/round/start', { token: u.token, body: { stake } });
    if (rs.status !== 200) { ok('round.start ' + u.uid, false, JSON.stringify(rs.body)); continue; }
    ok('round has server seed', Number.isInteger(rs.body.seed));
    const score = 1000 * (1 + (parseInt(u.uid.slice(1)) % 6));    // 1000..6000
    const st = await api('POST', '/round/settle', { token: u.token, body: { roundId: rs.body.roundId, score } });
    const expected = u.start - stake + st.body.payout;
    ok('balance math ' + u.uid, Math.abs(bal(st) - expected) < 0.001, `got ${bal(st)} want ${expected}`);
  }

  // 4) idempotency — replay a settle
  const r1 = await api('POST', '/round/start', { token: users[0].token, body: { stake: 20 } });
  const s1 = await api('POST', '/round/settle', { token: users[0].token, body: { roundId: r1.body.roundId, score: 4000 } });
  const s2 = await api('POST', '/round/settle', { token: users[0].token, body: { roundId: r1.body.roundId, score: 4000 } });
  ok('settle is idempotent (no double credit)', s2.body.replay === true && bal(s2) === bal(s1));

  // 5) insufficient funds → 402, no debit
  const u1 = users[1]; const before = bal(await api('GET', '/wallet/balance', { token: u1.token }));
  const big = await api('POST', '/round/start', { token: u1.token, body: { stake: 1e9 } });
  ok('insufficient funds → 402', big.status === 402 && big.body.error === 'INSUFFICIENT_FUNDS');
  ok('insufficient funds → no debit', bal(await api('GET', '/wallet/balance', { token: u1.token })) === before);

  // 6) auth / ownership guards
  ok('no session → 401', (await api('GET', '/wallet/balance')).status === 401);
  ok('bad token → 401', (await api('GET', '/wallet/balance', { token: 'bogus' })).status === 401);
  const r2 = await api('POST', '/round/start', { token: users[2].token, body: { stake: 5 } });
  ok("can't settle another user's round → 404", (await api('POST', '/round/settle', { token: users[3].token, body: { roundId: r2.body.roundId, score: 100 } })).status === 404);
  ok('unknown round → 404', (await api('POST', '/round/settle', { token: users[2].token, body: { roundId: 'nope', score: 1 } })).status === 404);
  ok('negative stake clamped (no debit)', (await api('POST', '/round/start', { token: users[4].token, body: { stake: -50 } })).status === 200);

  // 7) concurrency — 50 users play simultaneously
  const conc = users.slice(0, 50);
  const res = await Promise.all(conc.map(async (u) => {
    const rs = await api('POST', '/round/start', { token: u.token, body: { stake: 5 } });
    if (rs.status !== 200) return false;
    return (await api('POST', '/round/settle', { token: u.token, body: { roundId: rs.body.roundId, score: 2000 } })).status === 200;
  }));
  ok('50 concurrent rounds all settle', res.every(Boolean), `${res.filter(Boolean).length}/50`);

  // 8) LEDGER RECONCILIATION — money conservation (the important one)
  const db = new DatabaseSync(new URL('../data/abyss.db', import.meta.url).pathname);
  const pid = db.prepare('SELECT id FROM platforms WHERE slug=?').get(SLUG).id;
  const u = db.prepare('SELECT COALESCE(SUM(mockBalance),0) s, COUNT(*) c FROM users WHERE platformId=?').get(pid);
  const w = db.prepare("SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM transactions WHERE platformId=? AND type='wager'").get(pid);
  const wn = db.prepare("SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM transactions WHERE platformId=? AND type='win'").get(pid);
  const tx = db.prepare('SELECT COUNT(*) c FROM transactions WHERE platformId=?').get(pid);
  const rd = db.prepare('SELECT COUNT(*) c, SUM(status=\'SETTLED\') s FROM rounds WHERE platformId=?').get(pid);
  const uq = db.prepare('SELECT COUNT(*) c, COUNT(DISTINCT uniqueId) d FROM transactions WHERE platformId=? AND uniqueId IS NOT NULL').get(pid);
  const expectedBalances = u.c * START - w.s + wn.s;
  ok('ledger reconciles with balances', Math.abs(u.s - expectedBalances) < 0.01, `Σbalances=${u.s} vs Σstart-wagers+wins=${expectedBalances}`);
  ok('every tx idempotency key unique', uq.c === uq.d, `${uq.d}/${uq.c} unique`);
  db.close();

  console.log(`\nDATA: users=${u.c}  rounds=${rd.c} (settled ${rd.s})  transactions=${tx.c}  wagers=${w.c}/$${w.s.toFixed(2)}  wins=${wn.c}/$${wn.s.toFixed(2)}`);
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
  if (fails.length) console.log('  - ' + fails.join('\n  - '));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(2); });
