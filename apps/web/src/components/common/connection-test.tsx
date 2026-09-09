"use client";

import { useState } from "react";
import { CheckCircle2, Loader, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

interface Probe {
  name: string;
  url: string;
  authed: boolean;
}

/**
 * Connection self-test: pings REST + GraphQL with and without auth and
 * reports exactly which leg fails — distinguishes token problems (401/403)
 * from local blockers (blocked fetch = ad-blocker/VPN/firewall).
 */
export function ConnectionTest() {
  const { token } = useAuth();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<
    { name: string; status: "ok" | "fail" | "blocked"; detail: string }[] | null
  >(null);

  const run = async () => {
    setRunning(true);
    setResults(null);
    const probes: Probe[] = [
      { name: "REST (public)", url: "https://api.github.com/rate_limit", authed: false },
      { name: "GraphQL (public probe)", url: "https://api.github.com/graphql", authed: false },
      ...(token
        ? [
            { name: "REST (your token)", url: "https://api.github.com/user", authed: true },
            { name: "GraphQL (your token)", url: "https://api.github.com/graphql", authed: true },
          ]
        : []),
    ];
    const out: NonNullable<typeof results> = [];
    for (const p of probes) {
      try {
        let res: Response;
        if (p.url.endsWith("/graphql")) {
          res = await fetch(p.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(p.authed && token ? { Authorization: `Bearer ${token}` } : {}),
            },
            // Introspection-free minimal probe; auth errors still prove reachability.
            body: JSON.stringify({ query: "query { __typename }" }),
          });
        } else {
          res = await fetch(p.url, {
            headers: p.authed && token ? { Authorization: `Bearer ${token}` } : {},
          });
        }
        if (res.status === 401) {
          out.push({
            name: p.name,
            status: "fail",
            detail: "Reached GitHub, but the token was rejected (401). Replace it.",
          });
        } else if (res.status === 403) {
          out.push({
            name: p.name,
            status: "fail",
            detail: "Reached GitHub, but access was refused (403). Check token permissions.",
          });
        } else {
          out.push({
            name: p.name,
            status: "ok",
            detail: `Reached GitHub (HTTP ${res.status}).`,
          });
        }
      } catch {
        out.push({
          name: p.name,
          status: "blocked",
          detail:
            "Browser blocked the request (CORS/network failure). Disable ad-blocker/privacy extensions for this site, pause VPN, or try incognito / another network.",
        });
      }
    }
    setResults(out);
    setRunning(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="size-4" /> Connection test
        </CardTitle>
        <CardDescription>
          Finds out whether failures are your token (fix in Gity) or a local blocker
          like an ad-blocker, VPN, or firewall (fix in your browser/network).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button size="sm" variant="secondary" onClick={run} disabled={running}>
          {running ? <Loader className="size-3.5 animate-spin" /> : null}
          {running ? "Testing…" : "Run test"}
        </Button>
        {results && (
          <ul className="space-y-1.5 pt-1">
            {results.map((r) => (
              <li key={r.name} className="flex items-start gap-2 text-xs">
                {r.status === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" />
                ) : (
                  <XCircle
                    className={`mt-0.5 size-3.5 shrink-0 ${r.status === "blocked" ? "text-[var(--warning)]" : "text-[var(--destructive)]"}`}
                  />
                )}
                <span>
                  <strong>{r.name}</strong> — {r.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
