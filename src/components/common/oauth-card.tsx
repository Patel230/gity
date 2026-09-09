"use client";

import { useState } from "react";
import { CheckCircle2, Loader, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { authWorkerUrl, startLogin } from "@/lib/oauth";

/** Settings card: GitHub connect/disconnect + session state. */
export function OAuthCard() {
  const { kind, oauth, clearToken, refreshOAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerConfigured = authWorkerUrl().length > 0;

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await startLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start login.");
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Connect with GitHub
          {kind === "oauth" && <Badge variant="success">active</Badge>}
        </CardTitle>
        <CardDescription>
          One-click login via GitHub (PKCE flow) — public and private repos, no token
          pasting.{" "}
          {oauth?.expiresAt ? (
            <>Session expires {new Date(oauth.expiresAt).toLocaleString()}.</>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {kind === "oauth" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => refreshOAuth()}>
              <RefreshCw className="size-3.5" /> Refresh session now
            </Button>
            <Button size="sm" variant="ghost" onClick={clearToken}>
              Disconnect
            </Button>
          </div>
        ) : workerConfigured ? (
          <>
            <Button size="sm" onClick={connect} disabled={busy}>
              {busy ? <Loader className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              {busy ? "Redirecting…" : "Connect with GitHub"}
            </Button>
            {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            One-click login isn&apos;t configured on this deployment (missing worker URL).
            Use a personal access token below — identical access.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
