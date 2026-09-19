/**
 * x402-ping — free GET returns tip/unlock JSON; stubs for later x402/USDC paywall.
 * Compatible with Cloudflare Workers, Deno Deploy, and local Deno/Node.
 */

export const VERSION = "1.2.1";

export const DEFAULTS = {
  treasury: "0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b",
  tip: "https://shieldz.cash/tip/tip-d2599a4d16a6f4b0",
  unlock: "https://shieldz.cash/unlock/NDS0MgohhA3PmPaBvmD0",
  chain: "base",
  asset: "USDC",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, Payment-Signature",
    "Access-Control-Expose-Headers": "X-Payment-Required, X-Payment-Network",
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-x402-ping": VERSION,
      ...corsHeaders(),
      ...extra,
    },
  });
}

/**
 * Free discovery payload — no payment required.
 */
export function tipUnlockPayload(env = {}) {
  const treasury = env.TREASURY || DEFAULTS.treasury;
  const tip = env.TIP_URL || DEFAULTS.tip;
  const unlock = env.UNLOCK_URL || DEFAULTS.unlock;
  return {
    ok: true,
    service: "x402-ping",
    version: VERSION,
    mode: "free-discovery",
    message:
      "Free GET. Tip or unlock below. Paid /ping and /premium attach x402/USDC later — see README.",
    treasury,
    chain: DEFAULTS.chain,
    asset: DEFAULTS.asset,
    tip,
    unlock,
    endpoints: {
      "/": "this discovery JSON (free)",
      "/health": "liveness",
      "/ping": "echo — free now; document x402 gate in README",
      "/premium": "stub 402 Payment Required (x402-shaped)",
    },
    x402: {
      status: "documented-stub",
      note: "Wire Coinbase x402 or equivalent facilitator; see README § Attach x402/USDC",
      paymentRequiredShape: {
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "base",
            maxAmountRequired: "10000",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            payTo: treasury,
            resource: "/premium",
            description: "x402-ping premium ping",
          },
        ],
      },
    },
    gh: "@filip-study",
    siblings: [
      "https://github.com/filip-study/base-usdc-tip-kit",
      "https://github.com/filip-study/free-rpc-map",
      "https://github.com/filip-study/base-usdc-paylink",
    ],
  };
}

export function handleRequest(request, env = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Agent402 / IETF-style discovery (crawlers read this for tool index)
  if (path === "/.well-known/x402" || path === "/.well-known/x402.json") {
    const treasury = env.TREASURY || DEFAULTS.treasury;
    const base = url.origin;
    const premium = base + "/premium";
    return json({
      spec: "agent402-service-manifest/1",
      version: 1,
      x402Version: 1,
      kind: "resource",
      name: "x402-ping",
      description:
        "Base USDC x402-shaped premium ping + free tip/unlock discovery. payTo treasury on Base.",
      resources: [premium],
      resourceDetails: [
        {
          url: premium,
          method: "GET",
          description:
            "Premium ping — HTTP 402 exact 0.01 USDC on Base (payTo treasury). Tip/unlock fallbacks in 402 extra.",
        },
      ],
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "10000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: treasury,
          resource: premium,
          description: "x402-ping premium ping",
          maxTimeoutSeconds: 60,
        },
      ],
      docs: "https://github.com/filip-study/x402-ping",
      contact: "palmbeachpete@agentmail.to",
      tip: env.TIP_URL || DEFAULTS.tip,
      unlock: env.UNLOCK_URL || DEFAULTS.unlock,
      treasury,
      updated: new Date().toISOString(),
    });
  }

  if (path === "/.well-known/agent.json" || path === "/.well-known/agent-card.json") {
    const treasury = env.TREASURY || DEFAULTS.treasury;
    const base = url.origin;
    return json({
      name: "x402-ping",
      url: base,
      version: VERSION,
      description:
        "Free tip/unlock discovery plus Base USDC x402-shaped /premium paywall stub for agent payment testing. Treasury accepts Base USDC.",
      defaultInputModes: ["application/json"],
      defaultOutputModes: ["application/json"],
      protocols: ["http", "x402"],
      pricing: {
        unit: "request",
        amount: 10000,
        currency: "USDC",
        network: "base",
        note: "/ and /health /ping free; /premium returns HTTP 402 (0.01 USDC stub until facilitator wired)",
      },
      availability: { now: true, window_hours: 168, sla: "best-effort" },
      contact: {
        http: base + "/",
        github: "https://github.com/filip-study/x402-ping",
        tip: env.TIP_URL || DEFAULTS.tip,
        unlock: env.UNLOCK_URL || DEFAULTS.unlock,
        treasury,
      },
      skills: [
        {
          id: "discovery",
          name: "Free tip/unlock discovery",
          description: "GET / returns treasury + tip + unlock links (no payment).",
          examples: ["GET /", "GET /health"],
        },
        {
          id: "premium",
          name: "Premium ping (x402 stub)",
          description: "GET /premium returns HTTP 402 with Base USDC payTo treasury.",
          examples: ["GET /premium"],
        },
      ],
      owner_class: "third-party",
      brand: "palm-beach-pete",
    });
  }

  if (path === "/health") {
    return json({ ok: true, service: "x402-ping", version: VERSION, ts: new Date().toISOString() });
  }

  if (path === "/ping") {
    const q = Object.fromEntries(url.searchParams.entries());
    return json({
      ok: true,
      pong: true,
      version: VERSION,
      echo: q,
      tip: env.TIP_URL || DEFAULTS.tip,
      unlock: env.UNLOCK_URL || DEFAULTS.unlock,
      treasury: env.TREASURY || DEFAULTS.treasury,
      note: "Free today. Gate this route with x402 when ready (README).",
    });
  }

  if (path === "/premium") {
    // Stub: HTTP 402 with an x402-shaped body. No facilitator wired yet — free tip/unlock still in payload.
    const treasury = env.TREASURY || DEFAULTS.treasury;
    const resourceUrl = url.origin + "/premium";
    const body = {
      ok: false,
      error: "payment_required",
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "10000",
          amount: "10000",
          resource: resourceUrl,
          description: "x402-ping premium ping (0.01 USDC on Base)",
          mimeType: "application/json",
          payTo: treasury,
          maxTimeoutSeconds: 60,
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: {
            name: "USDC",
            version: "2",
            tip: env.TIP_URL || DEFAULTS.tip,
            unlock: env.UNLOCK_URL || DEFAULTS.unlock,
            note: "Until x402 facilitator is attached, tip/unlock above still work.",
          },
        },
      ],
    };
    return json(body, 402, {
      "X-Payment-Required": "true",
      "X-Payment-Network": "eip155:8453",
      "x402-price": "0.01",
      "x402-asset": "USDC",
      "x402-network": "eip155:8453",
      "x402-pay-to": treasury,
    });
  }

  // Free discovery at /
  return json(tipUnlockPayload(env));
}
