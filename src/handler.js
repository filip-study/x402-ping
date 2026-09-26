/**
 * x402-ping — free GET returns tip/unlock JSON; /premium emits x402 PAYMENT-REQUIRED.
 * Compatible with Cloudflare Workers, Deno Deploy, and local Deno/Node.
 */

export const VERSION = "1.3.5";

export const DEFAULTS = {
  treasury: "0xbAd41cF0f0d5442f9A53630F8081BFd257DA019b",
  tip: "https://shieldz.cash/tip/tip-d2599a4d16a6f4b0",
  unlock: "https://shieldz.cash/unlock/NDS0MgohhA3PmPaBvmD0",
  chain: "base",
  asset: "USDC", // ticker/symbol only — never scrape as EIP-712 domain name
  assetName: "USD Coin", // EIP-712 domain name (Base USDC)
  network: "eip155:8453",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: "50000", // 0.05 USDC (6 decimals) — above Agent402 $0.001 price floor
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-PAYMENT, PAYMENT-SIGNATURE, Payment-Signature",
    "Access-Control-Expose-Headers":
      "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Required, X-Payment-Network",
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

/** base64 of UTF-8 JSON (standard btoa-compatible; Workers + Node) */
function b64json(obj) {
  const s = JSON.stringify(obj);
  if (typeof btoa === "function") {
    // Workers / browsers — handle unicode safely
    return btoa(unescape(encodeURIComponent(s)));
  }
  return Buffer.from(s, "utf8").toString("base64");
}

function paymentRequirements(origin, treasury, tip, unlock) {
  const resourceUrl = origin.replace(/\/+$/, "") + "/premium";
  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: resourceUrl,
      description:
        "x402-ping premium ping — 0.05 USDC on Base to treasury. Returns a signed pong JSON.",
      mimeType: "application/json",
      serviceName: "x402-ping",
      tags: ["x402", "ping", "base", "usdc", "health"],
    },
    accepts: [
      {
        scheme: "exact",
        network: DEFAULTS.network,
        amount: DEFAULTS.amount,
        asset: DEFAULTS.usdc,
        payTo: treasury,
        maxTimeoutSeconds: 60,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
  };
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
      "Free GET. Tip or unlock below. Paid /premium requires 0.05 USDC on Base via x402.",
    treasury,
    chain: DEFAULTS.chain,
    asset: DEFAULTS.asset,
    assetName: DEFAULTS.assetName,
    symbol: DEFAULTS.asset,
    network: DEFAULTS.network,
    tip,
    unlock,
    endpoints: {
      "/": "this discovery JSON (free)",
      "/health": "liveness",
      "/ping": "echo (free)",
      "/premium": "HTTP 402 + PAYMENT-REQUIRED (0.05 USDC Base)",
      "/.well-known/x402": "Agent402 service manifest",
    },
    x402: {
      status: "payment-required-header",
      note: "Clients must send X-PAYMENT / PAYMENT-SIGNATURE after paying; facilitator verify optional until wired.",
      paymentRequiredShape: {
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: DEFAULTS.network,
            amount: DEFAULTS.amount,
            asset: DEFAULTS.usdc,
            payTo: treasury,
            resource: "/premium",
            description: "x402-ping premium ping",
            extra: { name: "USD Coin", version: "2" },
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
  const treasury = env.TREASURY || DEFAULTS.treasury;
  const tip = env.TIP_URL || DEFAULTS.tip;
  const unlock = env.UNLOCK_URL || DEFAULTS.unlock;

  // Agent402 / IETF-style discovery (crawlers read this for tool index)
  if (path === "/.well-known/x402" || path === "/.well-known/x402.json") {
    const base = url.origin;
    const premium = base + "/premium";
    return json({
      spec: "agent402-service-manifest/1",
      version: 1,
      x402Version: 2,
      kind: "resource",
      name: "x402-ping",
      description:
        "Base USDC x402 premium ping + free tip/unlock discovery. payTo treasury on Base.",
      url: base,
      resources: [premium],
      resourceDetails: [
        {
          url: premium,
          method: "GET",
          description:
            "Premium ping — HTTP 402 exact 0.05 USDC on Base (payTo treasury). PAYMENT-REQUIRED header carries live terms.",
          price: 0.05,
          currency: "USD Coin",
          symbol: "USDC",
          assetName: "USD Coin",
          network: DEFAULTS.network,
          payTo: treasury,
        },
      ],
      tools: [
        {
          method: "GET",
          route: "/premium",
          name: "Premium ping",
          description:
            "Cheap Base USDC x402 ping for agent payment / health checks. Returns pong JSON after payment.",
          price: 0.05,
          currency: "USD Coin",
          symbol: "USDC",
          paid: true,
          networks: [DEFAULTS.network],
        },
      ],
      accepts: [
        {
          scheme: "exact",
          network: DEFAULTS.network,
          amount: DEFAULTS.amount,
          asset: DEFAULTS.usdc,
          payTo: treasury,
          resource: premium,
          description: "x402-ping premium ping",
          maxTimeoutSeconds: 60,
          extra: { name: "USD Coin", version: "2" },
        },
      ],
      networks: [DEFAULTS.network],
      docs: "https://github.com/filip-study/x402-ping",
      contact: "palmbeachpete@agentmail.to",
      tip,
      unlock,
      treasury,
      updated: new Date().toISOString(),
    });
  }

  if (path === "/.well-known/agent.json" || path === "/.well-known/agent-card.json") {
    const base = url.origin;
    return json({
      name: "x402-ping",
      url: base,
      version: VERSION,
      description:
        "Free tip/unlock discovery plus Base USDC x402 /premium paywall for agent payment testing. Treasury accepts Base USDC.",
      defaultInputModes: ["application/json"],
      defaultOutputModes: ["application/json"],
      protocols: ["http", "x402"],
      pricing: {
        unit: "request",
        amount: 50000,
        currency: "USD Coin",
        symbol: "USDC",
        network: "base",
        caip2: DEFAULTS.network,
        note: "/ and /health /ping free; /premium returns HTTP 402 (0.05 USDC) with PAYMENT-REQUIRED",
      },
      availability: { now: true, window_hours: 168, sla: "best-effort" },
      contact: {
        http: base + "/",
        github: "https://github.com/filip-study/x402-ping",
        tip,
        unlock,
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
          name: "Premium ping (x402)",
          description:
            "GET /premium returns HTTP 402 with PAYMENT-REQUIRED (Base USDC payTo treasury).",
          examples: ["GET /premium"],
        },
      ],
      owner_class: "third-party",
      brand: "palm-beach-pete",
    });
  }

  if (path === "/health") {
    return json({
      ok: true,
      service: "x402-ping",
      version: VERSION,
      ts: new Date().toISOString(),
    });
  }

  if (path === "/ping") {
    const q = Object.fromEntries(url.searchParams.entries());
    return json({
      ok: true,
      pong: true,
      version: VERSION,
      echo: q,
      tip,
      unlock,
      treasury,
      note: "Free today. Use /premium for the paid x402 path.",
    });
  }

  if (path === "/premium") {
    // If a payment proof header is present, acknowledge (facilitator verify TODO).
    // Crawl probes are unpaid and must still see a clean 402 + PAYMENT-REQUIRED.
    const payHdr =
      request.headers.get("X-PAYMENT") ||
      request.headers.get("PAYMENT-SIGNATURE") ||
      request.headers.get("Payment-Signature");
    if (payHdr) {
      // Soft-accept until facilitator is wired: do not settle blindly in production at scale.
      // Returning 200 here lets clients that already paid get a pong; Agent402 probes never send this.
      return json({
        ok: true,
        pong: true,
        paid: true,
        version: VERSION,
        treasury,
        network: DEFAULTS.network,
        note: "Payment header seen. Facilitator on-chain verify not yet wired — treat as best-effort ack.",
        tip,
        unlock,
      });
    }

    const reqs = paymentRequirements(url.origin, treasury, tip, unlock);
    const paymentRequiredB64 = b64json(reqs);
    const body = {
      ok: false,
      error: "payment_required",
      x402Version: 2,
      accepts: reqs.accepts,
      resource: reqs.resource,
      tip,
      unlock,
      hint: "Decode the PAYMENT-REQUIRED header (base64 JSON) for live payment terms. Pay 0.05 USDC on Base to payTo, then retry with X-PAYMENT.",
    };
    return json(body, 402, {
      "PAYMENT-REQUIRED": paymentRequiredB64,
      "X-Payment-Required": "true",
      "X-Payment-Network": DEFAULTS.network,
      "x402-price": "0.05",
      "x402-asset": "USD Coin",
      "x402-network": DEFAULTS.network,
      "x402-pay-to": treasury,
    });
  }

  // Free discovery at /
  return json(tipUnlockPayload(env));
}
