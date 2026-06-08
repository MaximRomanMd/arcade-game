# Abyss Hunter

A deep-sea skill-arcade fish shooter. Pure HTML5 Canvas + vanilla JS on the
client; a small Node API on the server for the **seamless wallet** integration.

**Live:** https://nextbytegames.com/ (landing) · https://nextbytegames.com/play/ (game)

## Layout
```
home/          static landing page (served at /)        — hero, leaderboard, PWA
fish-hunter/   the game (served at /play/)               — Canvas2D engine, sim, FX
  game.js        engine + sim + render (seeded, deterministic boards)
  wallet.js      wallet abstraction: LocalWallet (play-money) | ApiWallet (seamless)
  api.js         thin backend client (launch token, fetch wrapper)
server/        Node API (behind Caddy at /api/*)         — seamless wallet + settlement
  index.mjs      zero-dependency HTTP server, /api/* routing
  wallet/        provider adapter interface + mock (real provider drops in here)
```

## Edge / hosting
Served globally via **CloudFront** → origin `origin.nextbytegames.com` → **Caddy**
on the EC2. Caddy reverse-proxies `/api/*` to the Node backend (127.0.0.1).
Static assets cache at the edge; HTML/JS/CSS revalidate (fresh on deploy).

## Wallet model (seamless)
The browser is never trusted with money. Money flows server-to-server:
`bet` on room entry, `win` at settlement, both idempotent (txId), under a
launch-token session. `wallet/mock` implements the provider interface today;
a real operator/aggregator adapter slots into the same interface.

> Real-money operation is regulated and jurisdiction-specific — licensing,
> AML and compliance are the operator's responsibility.
