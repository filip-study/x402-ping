# x402-ping

[![smoke](https://img.shields.io/badge/smoke-local%20PASS-brightgreen)](./test/smoke.mjs)
[![Tip jar](https://img.shields.io/badge/tip-shieldz.cash-purple)](https://shieldz.cash/tip/tip-d2599a4d16a6f4b0)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**Tiny free-to-host micro-endpoint** for agents on [Base](https://base.org): a free `GET /` returns tip + unlock JSON today; `/premium` returns an **HTTP 402** stub shaped like [x402](https://www.x402.org/) so you can wire USDC payments later — **$0 capital to ship**.

Sibling of [`base-usdc-tip-kit`](https://github.com/filip-study/base-usdc-tip-kit), [`free-rpc-map`](https://github.com/filip-study/free-rpc-map), [`base-usdc-paylink`](https://github.com/filip-study/base-usdc-paylink).

## Why

Agents need a public URL that (1) advertises a tip/unlock funnel without a backend bill, and (2) can grow into a paid route via HTTP 402 / x402 without rewriting the product. This repo is that starter.

## Endpoints

| Path | Status | Behavior |
|------|--------|----------|
| `GET /` | **200 free** | Discovery JSON: treasury, tip, unlock, x402 stub docs |
| `GET /health` | **200 free** | Liveness |
| `GET /ping?…` | **200 free** | Echo + tip/unlock (gate later) |
| `GET /premium` | **402 stub** | x402-shaped `accepts[]` for Base USDC → treasury |

## Quick start (local smoke — no account)

```bash
git clone https://github.com/filip-study/x402-ping.git
cd x402-ping
node test/smoke.mjs
```

Expected: `All smoke checks PASSED.`

### Live local server (Deno — free)

```bash
deno task start
# → http://127.0.0.1:8787/
curl -s http://127.0.0.1:8787/ | jq .
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/premium   # 402
```

## Deploy (free tiers — your account)

No Cloudflare / Deno Deploy login is baked into this repo. After you create a free account:

### Cloudflare Workers

```bash
npm i -g wrangler   # or use npx
wrangler login
wrangler deploy
```

Uses `wrangler.toml` + `src/cf-worker.js`. Free tier is enough for discovery traffic.

### Deno Deploy

```bash
# https://dash.deno.com → New Project → link this repo
# Entrypoint: src/deno-main.ts
# Or CLI:
deployctl deploy --project=x402-ping src/deno-main.ts
```

Optional env vars (defaults match the Pete treasury funnel):

| Var | Default |
|-----|---------|
| `TREASURY` | `0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b` |
| `TIP_URL` | `https://shieldz.cash/tip/tip-d2599a4d16a6f4b0` |
| `UNLOCK_URL` | `https://shieldz.cash/unlock/NDS0MgohhA3PmPaBvmD0` |

## Support / tip ($0 for you to try)

| | |
|---|---|
| **Treasury (Base USDC)** | `0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b` |
| **Tip jar** | https://shieldz.cash/tip/tip-d2599a4d16a6f4b0 |
| **Cash kit unlock** | https://shieldz.cash/unlock/NDS0MgohhA3PmPaBvmD0 |

## Attach x402 / USDC later

Today `/premium` returns **402** with an `accepts[]` object (network `base`, USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, `payTo` = treasury). To take money:

1. Pick a facilitator (e.g. Coinbase x402 / CDP, or a self-hosted verifier).
2. On paid routes: if no valid `X-PAYMENT` (or protocol header), keep returning 402 + `accepts`.
3. On valid proof: settle / verify, then return 200 with the premium payload.
4. Keep `GET /` free forever as the tip/unlock discovery surface.

This repo intentionally ships the **shape + free discovery** first so agents can publish a URL at $0 capital.

## Layout

```
src/handler.js      shared request logic
src/cf-worker.js    Cloudflare Workers entry
src/deno-main.ts    Deno Deploy / local Deno
test/smoke.mjs      local smoke (Node)
wrangler.toml       CF config + default tip/unlock vars
deno.json           Deno tasks
```

## License

MIT — see [`LICENSE`](./LICENSE).

## Disclaimer

Public discovery + documented payment stub only. Does not move funds until you wire a facilitator. Not financial advice. gh=@filip-study
