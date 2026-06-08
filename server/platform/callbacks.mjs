// Canonical list of callbacks the game issues TO the partner platform (the
// seamless wallet). The partner exposes these under their chosen base URL
// (PARTNER_CALLBACK_BASE_URL); we join `<base>/<path>` at call time.
//
// This mirrors the Bingo-System contract so the SAME HappyHippo partner adapter
// works unchanged — only the game-side mapping differs (a fish "round" = one
// wager on entry + one win on settlement).
export const CALLBACK_ENDPOINTS = [
  { name: 'balance',     method: 'GET',  path: '/balance', description: 'Read balance. Query: ?userId=<external id>' },
  { name: 'wager',       method: 'POST', path: '/wager',   description: 'Debit a stake. Body: { userId, gameId, gameType, fundTransfer }' },
  { name: 'wagerCancel', method: 'POST', path: '/refund',  description: 'Refund a wager. Body: { fundTransfer: { uniqueId } } (idempotent)' },
  { name: 'win',         method: 'POST', path: '/win',     description: 'Credit a win. Body: { userId, gameId, gameType, fundTransfer } (idempotent on uniqueId)' },
  { name: 'cancelGame',  method: 'POST', path: '/cancel',  description: 'Refund a whole game. Body: { gameId, gameType, code }' },
];

const normalizeBase = (b) => String(b || '').trim().replace(/\/+$/, '');

export function findEndpoint(name) {
  const e = CALLBACK_ENDPOINTS.find((x) => x.name === name);
  if (!e) throw new Error(`unknown callback endpoint "${name}"`);
  return e;
}

export function buildCallbackUrl(base, name) {
  if (!base) throw new Error('partner has no callbackBaseUrl configured');
  return `${normalizeBase(base)}${findEndpoint(name).path}`;
}
