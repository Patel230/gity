/**
 * GET /api/config — returns the public GitHub-App Client ID so the
 * frontend can start PKCE login. Client IDs are public by design.
 * Same-origin with the frontend, so no CORS involved at all.
 */
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export async function onRequestGet({
  env,
}: {
  env: Env;
}): Promise<Response> {
  return Response.json(
    { client_id: env.GITHUB_CLIENT_ID || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
