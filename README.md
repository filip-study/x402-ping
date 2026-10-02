# x402-ping

[![smoke](https://img.shields.io/badge/smoke-local%20PASS-brightgreen)](./test/smoke.mjs)
[![Tip jar](https://img.shields.io/badge/tip-shieldz.cash-purple)](https://shieldz.cash/tip/tip-d2599a4d16a6f4b0)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**Palm Beach Pete** micro-endpoint for agents on [Base](https://base.org): a free `GET /` returns tip + unlock JSON today; `/premium` returns an **HTTP 402** stub shaped like [x402](https://www.x402.org/) so you can wire USDC payments later — **$0 capital to ship**.

**Primary live Worker:** https://x402-ping.palmbeachpete.workers.dev

That is the host to call and to register. `filip-study.workers.dev` returns HTTP 500 — do not use it.

Sibling of [`base-usdc-tip-kit`](https://github.com/filip-study/base-usdc-tip-kit), [`free-rpc-map`](https://github.com/filip-study/free-rpc-map), [`base-usdc-paylink`](https://github.com/filip-study/base-usdc-paylink).

## Why

Agents need a public URL that (1) advertises a tip/unlock funnel without a backend bill, and (2) can grow into a paid route via HTTP 402 / x402 without rewriting the product. This repo is that starter.

## Endpoints

| Path | Status | Behavior |
|------|--------|----------|
| `GET /` | **200 free** | Discovery JSON: treasury, tip, unlock, x402 stub docs |
| `GET /health` | **200 free** | Liveness |
| `GET /ping?…` | **200 free** | Echo + tip/unlock (gate later) |
| `GET /openapi.json` | **200 free** | OpenAPI 3.1 document. Paid operation is `GET /premium` |
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

## Live Worker and OpenAPI

| Surface | URL |
|---------|-----|
| **Primary live Worker** | https://x402-ping.palmbeachpete.workers.dev |
| **x402scan OpenAPI** (Worker, after deploy) | https://x402-ping.palmbeachpete.workers.dev/openapi.json |
| GitHub Pages OpenAPI (static copy) | https://filip-study.github.io/x402-ping/openapi.json |
| Pages index | https://filip-study.github.io/x402-ping/ |

`docs/openapi.json` is a static copy of `openApiDocument()` (OpenAPI 3.1, server `https://x402-ping.palmbeachpete.workers.dev`, paid `GET /premium` with the `x402` security scheme, free routes `security: []`). GitHub Pages can serve it before the Worker is redeployed.

**x402scan needs the live Worker `/openapi.json` after deploy.** The Worker currently on `palmbeachpete` can still answer `GET /openapi.json` with free-discovery JSON until this workflow (or a local `wrangler deploy`) publishes handler `1.3.6`. Pages is the stand-in document; registration should use the Worker URL once that route returns the OpenAPI document (`openapi: 3.1.0`), not the discovery payload.

The **Metropolis** window through **2026-10-13** is a separate track. It does not gate this Worker deploy or the x402scan registration above.

## Deploy (free tiers — your account)

No Cloudflare / Deno Deploy token is committed in this repo.

### Cloudflare Workers (GitHub Actions)

[`.github/workflows/deploy-worker.yml`](./.github/workflows/deploy-worker.yml) runs `npx wrangler deploy` on every push to `main` and on `workflow_dispatch`.

The token must belong to the Palm Beach Pete Cloudflare account that serves `x402-ping.palmbeachpete.workers.dev`. Add secrets under **Settings → Secrets and variables → Actions**. Do not commit them.

| Secret | Required | Notes |
|--------|----------|---|
| `CLOUDFLARE_API_TOKEN` | **yes** | API token with Workers Scripts:Edit and Account:Read. If this secret is missing or empty, the workflow **fails immediately** and does not deploy. |
| `CLOUDFLARE_ACCOUNT_ID` | no | Set when the token can see more than one account. When unset, it is not passed to Wrangler. |

Local deploy still works when Wrangler can start:

```bash
npx wrangler login
npx wrangler deploy
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
src/handler.js                      shared request logic (openApiDocument)
src/cf-worker.js                    Cloudflare Workers entry
src/deno-main.ts                    Deno Deploy / local Deno
docs/openapi.json                   static copy of openApiDocument() for Pages
docs/index.html                     Pages index (Worker URL, OpenAPI, agent card, tip/unlock)
.github/workflows/deploy-worker.yml push-to-main Wrangler deploy
test/smoke.mjs                      local smoke (Node)
wrangler.toml                       CF config + default tip/unlock vars
deno.json                           Deno tasks
```

## License

MIT — see [`LICENSE`](./LICENSE).

## Disclaimer

Public discovery + documented payment stub only. Does not move funds until you wire a facilitator. Not financial advice. gh=@filip-study
