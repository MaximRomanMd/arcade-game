// In-memory mock wallet — stands in for the partner's seamless wallet while
// MOCK_EXTERNAL_API_MODE=true (no real provider URLs yet). Authoritative
// balance + idempotency on fundTransfer.uniqueId, exactly like the real one.
const START = Number(process.env.MOCK_START_BALANCE || 10000);
const CURRENCY = process.env.CURRENCY || 'USD';

const balances = new Map();          // userId -> realMoney (number)
const applied = new Map();           // uniqueId -> { balance } (idempotent ledger)

const bal = (u) => { if (!balances.has(u)) balances.set(u, START); return balances.get(u); };
const fmt = (u) => ({ ok: true, realMoney: bal(u).toFixed(2), bonusMoney: '0.00', currency: CURRENCY });

export function mockBalance(userId) {
  return fmt(userId);
}

// Debit. Idempotent on uniqueId. Returns { ok:false, error:'INSUFFICIENT_FUNDS' } when broke.
export function mockWager(userId, uniqueId, amount) {
  if (applied.has(uniqueId)) return { ok: true, ...fmt(userId), replay: true };
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!(amt >= 0)) return { ok: false, error: 'BAD_AMOUNT' };
  if (bal(userId) < amt) return { ...fmt(userId), ok: false, error: 'INSUFFICIENT_FUNDS' };
  balances.set(userId, Math.round((bal(userId) - amt) * 100) / 100);
  applied.set(uniqueId, true);
  return fmt(userId);
}

// Credit. Idempotent on uniqueId.
export function mockWin(userId, uniqueId, amount) {
  if (applied.has(uniqueId)) return { ok: true, ...fmt(userId), replay: true };
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!(amt >= 0)) return { ok: false, error: 'BAD_AMOUNT' };
  balances.set(userId, Math.round((bal(userId) + amt) * 100) / 100);
  applied.set(uniqueId, true);
  return fmt(userId);
}
