/**
 * Local smoke — import handler, hit free GET + /premium 402 without deploying.
 * Run: node --experimental-vm-modules test/smoke.mjs
 * Or:  deno run --allow-read test/smoke.mjs  (after dynamic import adapts)
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const handlerUrl = pathToFileURL(path.join(__dirname, "../src/handler.js")).href;

const { handleRequest, tipUnlockPayload, openApiDocument, VERSION } = await import(handlerUrl);

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
  assert(spec.openapi === "3.1.0", "openapi 3.1.0");
  assert(spec.info?.title === "x402-ping", "openapi title");
  assert(spec.info?.version === VERSION, "openapi info.version");
  assert(typeof spec.info?.["x-guidance"] === "string", "openapi x-guidance");
  assert(spec.info?.contact?.email === "palmbeachpete@agentmail.to", "openapi contact email");
  assert(
    spec.servers?.[0]?.url === "https://x402-ping.palmbeachpete.workers.dev",
    "openapi servers url"
  );
  const premiumOp = spec.paths?.["/premium"]?.get;
  assert(premiumOp, "paths./premium GET");
  const pay = premiumOp["x-payment-info"];
  assert(pay?.price?.mode === "fixed", "openapi premium fixed price");
  assert(pay?.price?.currency === "USD", "openapi premium currency USD");
  assert(pay?.price?.amount === "0.050000", "openapi premium amount 0.050000");
  assert(pay?.protocols?.[0]?.x402 && typeof pay.protocols[0].x402 === "object", "openapi x402 protocol");
  assert(premiumOp.responses?.["200"]?.content?.["application/json"]?.schema, "openapi premium 200 schema");
  assert(premiumOp.responses?.["402"], "openapi premium 402 response");
  assert(premiumOp.requestBody?.content?.["application/json"]?.schema, "openapi premium input schema");
  for (const freePath of ["/", "/health", "/ping", "/.well-known/x402"]) {
    const op = spec.paths?.[freePath]?.get;
    assert(op && !op["x-payment-info"], `${freePath} free in spec`);
    assert(Array.isArray(op.security) && op.security.length === 0, `${freePath} security []`);
  }
  assert(spec.mode !== "free-discovery", "openapi is not free-discovery payload");

  const pagesSpec = JSON.parse(
    readFileSync(path.join(__dirname, "../docs/openapi.json"), "utf8")
  );
  assert(
    JSON.stringify(pagesSpec) === JSON.stringify(openApiDocument()),
    "docs/openapi.json matches openApiDocument()"
  );

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
