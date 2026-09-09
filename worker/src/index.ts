/**
 * Gity auth exchange worker — the ONLY backend piece in Gity.
 *
 * Why it exists: GitHub requires `client_secret` to exchange an OAuth code
 * and sends no CORS headers on its login endpoints, so no pure-browser app
 * can complete login. This worker holds the secret server-side and swaps
 * short-lived codes for tokens. It stores nothing, logs no tokens, and
 * only talks to the configured Pages origin (CORS-locked).
 *
 * Endpoints:
 *   GET  /api/config    -> { client_id } (public, safe for frontend)
 *   POST /api/exchange  -> { code, code_verifier, redirect_uri, state }
 *                          returns { access_token, expires_in?, refresh_token?, ... }
 *   POST /api/refresh   -> { refresh_token } returns fresh tokens
 *
 * Deploy: `npx wrangler login && npx wrangler deploy` from worker/,
 * then `wrangler secret put GITHUB_CLIENT_SECRET` (+ set vars in wrangler.toml).
 */

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  /** e.g. https://patel230.github.io — browser origin allowed to call this worker */
  ALLOWED_ORIGIN: string;
}

const TOKEN_URL = "https://github.com/login/oauth/access_token";

function cors(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(env: Env, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(env), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function exchangeCode(
  env: Env,
  body: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        ...body,
      }),
    });
  } catch {
    return { ok: false, status: 502, data: { error: "upstream_unreachable" } };
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.error || !data.access_token) {
    // Never forward the secret or raw upstream internals; map to safe codes.
    const code = typeof data.error === "string" ? data.error : "exchange_failed";
    return { ok: false, status: 400, data: { error: code } };
  }
  // Return ONLY token fields — strip everything else.
  const { access_token, expires_in, refresh_token, refresh_token_expires_in, token_type } = data;
  return {
    ok: true,
    status: 200,
    data: { access_token, expires_in, refresh_token, refresh_token_expires_in, token_type },
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (url.pathname === "/api/config" && req.method === "GET") {
      return json(env, { client_id: env.GITHUB_CLIENT_ID || null });
    }

    if (url.pathname === "/api/exchange" && req.method === "POST") {
      let body: Record<string, string>;
      try {
        body = (await req.json()) as Record<string, string>;
      } catch {
        return json(env, { error: "bad_request" }, 400);
      }
      if (!body.code || !body.code_verifier || !body.redirect_uri) {
        return json(env, { error: "bad_request" }, 400);
      }
      const r = await exchangeCode(env, {
        code: body.code,
        code_verifier: body.code_verifier,
        redirect_uri: body.redirect_uri,
      });
      return json(env, r.data, r.status);
    }

    if (url.pathname === "/api/refresh" && req.method === "POST") {
      let body: Record<string, string>;
      try {
        body = (await req.json()) as Record<string, string>;
      } catch {
        return json(env, { error: "bad_request" }, 400);
      }
      if (!body.refresh_token) return json(env, { error: "bad_request" }, 400);
      const r = await exchangeCode(env, {
        grant_type: "refresh_token",
        refresh_token: body.refresh_token,
      });
      return json(env, r.data, r.status);
    }

    return json(env, { error: "not_found" }, 404);
  },
};
