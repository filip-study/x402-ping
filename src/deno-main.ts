import { handleRequest } from "./handler.js";

const port = Number(Deno.env.get("PORT") || "8787");

Deno.serve({ port }, (req) => {
  const env = {
    TREASURY: Deno.env.get("TREASURY"),
    TIP_URL: Deno.env.get("TIP_URL"),
    UNLOCK_URL: Deno.env.get("UNLOCK_URL"),
  };
  return handleRequest(req, env);
});

console.log(`x402-ping listening on http://127.0.0.1:${port}`);
