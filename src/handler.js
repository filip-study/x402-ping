/**
 * x402-ping — free GET returns tip/unlock JSON; /premium emits x402 PAYMENT-REQUIRED.
 * Compatible with Cloudflare Workers, Deno Deploy, and local Deno/Node.
 */

export const VERSION = "1.3.6";

/** Public origin x402scan registers. Spec servers[].url stays this host. */
export const PUBLIC_ORIGIN = "https://x402-ping.palmbeachpete.workers.dev";

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

/**
 * OpenAPI 3.1 discovery for x402scan single-endpoint register.
 * GET /premium is the only paid operation. Free routes have no x-payment-info.
 */
export function openApiDocument() {
  const pongSchema = {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      pong: { type: "boolean" },
      paid: { type: "boolean" },
      version: { type: "string" },
    },
    required: ["ok", "pong"],
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "x402-ping",
      version: VERSION,
      description:
        "Free tip/unlock discovery plus paid GET /premium (0.05 USDC on Base via x402).",
      "x-guidance":
        "The paid x402 resource is GET /premium at https://x402-ping.palmbeachpete.workers.dev/premium. An unpaid GET returns HTTP 402 and a PAYMENT-REQUIRED header for 0.05 USDC on Base (eip155:8453). Pay that challenge, then retry the same GET with an X-PAYMENT or PAYMENT-SIGNATURE header to receive pong JSON. GET /, GET /health, and GET /ping are free and do not require payment. GET /openapi.json is this document.",
      contact: {
        email: "palmbeachpete@agentmail.to",
        url: "https://github.com/filip-study/x402-ping",
      },
    },
    servers: [{ url: PUBLIC_ORIGIN }],
    paths: {
      "/premium": {
        get: {
          operationId: "premiumPing",
          summary: "Premium ping (paid x402)",
          description:
            "Paid x402 resource. Unpaid requests return HTTP 402 with PAYMENT-REQUIRED for 0.05 USDC on Base. No query or body is required.",
          tags: ["paid"],
          security: [{ x402: [] }],
          "x-payment-info": {
            price: { mode: "fixed", currency: "USD", amount: "0.05" },
            protocols: [{ x402: {} }],
          },
          parameters: [],
          requestBody: {
            required: false,
            description:
              "GET /premium takes no JSON body. This empty object schema marks the route invocable for discovery clients.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {},
                  additionalProperties: false,
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Paid pong JSON after a payment header is presented.",
              content: {
                "application/json": { schema: pongSchema },
              },
            },
            "402": {
              description: "Payment Required",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      error: { type: "string" },
                      x402Version: { type: "integer" },
                    },
                    required: ["error"],
                  },
                },
              },
            },
          },
        },
      },
      "/": {
        get: {
          operationId: "discovery",
          summary: "Free tip/unlock discovery",
          description:
            "Free discovery JSON: treasury, tip, and unlock links. No payment.",
          tags: ["free"],
          responses: {
            "200": {
              description: "Free discovery JSON",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/health": {
        get: {
          operationId: "health",
          summary: "Liveness",
          description: "Free liveness check.",
          tags: ["free"],
          responses: {
            "200": { description: "Liveness JSON" },
          },
        },
      },
      "/ping": {
        get: {
          operationId: "ping",
          summary: "Free echo",
          description: "Free echo of query parameters plus tip/unlock links.",
          tags: ["free"],
          parameters: [
            {
              name: "hello",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional echo field. Any query keys are echoed.",
            },
          ],
          responses: {
            "200": { description: "Pong JSON" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        x402: {
          type: "apiKey",
          in: "header",
          name: "X-PAYMENT",
          description:
            "x402 payment proof. PAYMENT-SIGNATURE is also accepted. Unpaid GET /premium returns HTTP 402.",
        },
      },
    },
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

  if (path === "/openapi.json") {
    return json(openApiDocument());
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
