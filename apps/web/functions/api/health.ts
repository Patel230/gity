const GITHUB_HEALTH_URL = "https://api.github.com/rate_limit";

/** Lightweight, unauthenticated reachability probe for deployment monitoring. */
export async function onRequestGet(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const upstream = await fetch(GITHUB_HEALTH_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Gity-Health-Check",
      },
    });
    return Response.json(
      {
        ok: upstream.ok,
        upstreamStatus: upstream.status,
        latencyMs: Date.now() - startedAt,
      },
      {
        status: upstream.ok ? 200 : 502,
        headers: {
          "Cache-Control": "no-store",
          "X-Gity-Health": "github",
        },
      },
    );
  } catch {
    return Response.json(
      { ok: false, upstreamStatus: null, latencyMs: Date.now() - startedAt },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "X-Gity-Health": "github",
        },
      },
    );
  }
}
