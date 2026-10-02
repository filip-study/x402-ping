/**
 * Local smoke — import handler, hit free GET + /premium 402 without deploying.
 * Run: node --experimental-vm-modules test/smoke.mjs
 * Or:  deno run --allow-read test/smoke.mjs  (after dynamic import adapts)
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const handlerUrl = pathToFileURL(path.join(__dirname, "../src/handler.js")).href;

const { handleRequest, tipUnlockPayload, VERSION } = await import(handlerUrl);

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  PASS:", msg);
}

async function run() {
  console.log(`x402-ping smoke v${VERSION}`);

  const free = await handleRequest(new Request("http://local/"));
  assert(free.status === 200, "GET / → 200");
  const freeBody = await free.json();
  assert(freeBody.ok === true, "body.ok");
  assert(freeBody.tip?.includes("shieldz.cash/tip"), "tip URL present");
  assert(freeBody.unlock?.includes("shieldz.cash/unlock"), "unlock URL present");
  assert(
    freeBody.treasury === "0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b",
    "treasury wallet"
  );

  const health = await handleRequest(new Request("http://local/health"));
  assert(health.status === 200, "GET /health → 200");

  const ping = await handleRequest(new Request("http://local/ping?hello=world"));
  assert(ping.status === 200, "GET /ping → 200");
  const pingBody = await ping.json();
  assert(pingBody.pong === true && pingBody.echo?.hello === "world", "ping echo");

  const prem = await handleRequest(new Request("http://local/premium"));
  assert(prem.status === 402, "GET /premium → 402");
  const premBody = await prem.json();
  assert(premBody.error === "payment_required", "402 payment_required");
  assert(
    Array.isArray(premBody.accepts) && premBody.accepts[0]?.network === "eip155:8453",
    "x402 accepts eip155:8453"
  );
  const pr = prem.headers.get("PAYMENT-REQUIRED");
  assert(pr && pr.length > 20, "PAYMENT-REQUIRED header present");
  const decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
  assert(decoded.x402Version === 2, "PAYMENT-REQUIRED x402Version 2");
  assert(decoded.accepts?.[0]?.network === "eip155:8453", "PAYMENT-REQUIRED network");
  assert(
    decoded.accepts?.[0]?.payTo === "0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b",
    "PAYMENT-REQUIRED payTo treasury"
  );

  const wk = await handleRequest(new Request("http://local/.well-known/x402"));
  assert(wk.status === 200, "GET /.well-known/x402 → 200");
  const wkBody = await wk.json();
  assert(Array.isArray(wkBody.networks) && wkBody.networks[0] === "eip155:8453", "manifest networks");
  assert(wkBody.tools?.[0]?.price === 0.05, "manifest tool price");

  const specRes = await handleRequest(new Request("http://local/openapi.json"));
  assert(specRes.status === 200, "GET /openapi.json → 200");
  assert(specRes.headers.get("X-x402-ping") === VERSION, "x-x402-ping version header");
  const spec = await specRes.json();
  assert(spec.openapi?.startsWith("3."), "openapi 3.x");
  assert(spec.info?.title === "x402-ping", "openapi title");
  assert(spec.info?.version === VERSION, "openapi info.version");
  assert(
    spec.servers?.[0]?.url === "https://x402-ping.palmbeachpete.workers.dev",
    "openapi servers url"
  );
  const premiumOp = spec.paths?.["/premium"]?.get;
  assert(premiumOp, "paths./premium GET");
  assert(premiumOp["x-payment-info"]?.price?.amount === "0.05", "openapi premium price 0.05");
  assert(premiumOp["x-payment-info"]?.price?.mode === "fixed", "openapi premium fixed price");
  assert(premiumOp.responses?.["402"], "openapi premium 402 response");
  assert(spec.paths?.["/"]?.get && !spec.paths["/"]?.get["x-payment-info"], "GET / free in spec");
  assert(spec.paths?.["/health"]?.get, "paths./health");
  assert(spec.paths?.["/ping"]?.get, "paths./ping");
  assert(spec.mode !== "free-discovery", "openapi is not free-discovery payload");

  assert(freeBody.mode === "free-discovery", "GET / stays free discovery");
  assert(!freeBody.openapi, "GET / is not an OpenAPI document");
  assert(freeBody.version === VERSION, "discovery version");
  assert(prem.headers.get("x402-price") === "0.05", "premium x402-price 0.05");
  assert(premBody.accepts?.[0]?.amount === "50000", "premium amount 50000");
  assert(
    premBody.accepts?.[0]?.payTo === "0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b",
    "premium payTo unchanged"
  );

  const payload = tipUnlockPayload({});
  assert(payload.mode === "free-discovery", "tipUnlockPayload mode");

  console.log("\nAll smoke checks PASSED.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
