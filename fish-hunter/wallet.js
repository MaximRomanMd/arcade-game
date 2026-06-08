// Seamless-wallet client + mode seam for the game.
//
//   local (default) — play-money in localStorage (unchanged behavior).
//   api             — drives the Node backend: launch -> session, room entry ->
//                     wager, settlement -> win; balance is the server's wallet.
//
// API mode turns on with ?api=1, window.ABYSS_WALLET_MODE='api', or a real
// partner launch token in the URL (?p=&u=&ts=&sig=). game.js reads window.ABYSS_API
// and calls window.AbyssWallet at the wager/settle touchpoints.
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = window.ABYSS_API_BASE || 'https://origin.nextbytegames.com/api';
  const launch = { platform: qs.get('p') || undefined, userId: qs.get('u') || undefined, ts: qs.get('ts') || undefined, sig: qs.get('sig') || undefined };
  const MODE = window.ABYSS_WALLET_MODE || ((qs.get('api') === '1' || launch.sig) ? 'api' : 'local');
  window.ABYSS_API = MODE === 'api';

  let token = null;
  async function call(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && token) headers.Authorization = 'Bearer ' + token;
    let r;
    try { r = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch (e) { return { ok: false, status: 0, error: 'NETWORK' }; }
    let j = null; try { j = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, ...(j || {}) };
  }
  const num = (r) => Number((r && (r.balance ? r.balance.realMoney : r.realMoney)) ?? NaN);
  function guestId() { let id = localStorage.getItem('abyss_player_id'); if (!id) { id = 'web-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('abyss_player_id', id); } return id; }

  const Wallet = {
    mode: MODE,
    base: API_BASE,
    ready: Promise.resolve(NaN),
    async launch() {
      const body = launch.sig ? launch : { platform: launch.platform, userId: launch.userId || guestId() };
      const r = await call('/launch', { method: 'POST', body, auth: false });
      if (r.ok && r.token) { token = r.token; return num(r); }
      throw new Error(r.error || 'launch failed');
    },
    async balance() { const r = await call('/wallet/balance'); return r.ok ? num(r) : NaN; },
    async startRound(stake) { const r = await call('/round/start', { method: 'POST', body: { stake } }); return r.ok ? { ok: true, roundId: r.roundId, seed: r.seed, balance: num(r) } : { ok: false, error: r.error || 'WAGER_FAILED' }; },
    async settleRound(roundId, score, inputs) { const r = await call('/round/settle', { method: 'POST', body: { roundId, score, inputs } }); return r.ok ? { ok: true, payout: r.payout, score: r.score, balance: num(r), verified: r.verified } : { ok: false, error: r.error || "SETTLE_FAILED" }; },
  };
  window.AbyssWallet = Wallet;
  if (MODE === 'api') Wallet.ready = Wallet.launch().catch((e) => { console.warn('[wallet] launch failed:', e.message); return NaN; });
})();
