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
  assert(Array.isArray(premBody.accepts) && premBody.accepts[0]?.network === "base", "x402 accepts base");

  const payload = tipUnlockPayload({});
  assert(payload.mode === "free-discovery", "tipUnlockPayload mode");

  console.log("\nAll smoke checks PASSED.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
