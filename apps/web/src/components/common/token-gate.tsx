"use client";

import { Bot, KeyRound, Loader, ShieldAlert, ShieldCheck, Workflow } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/lib/oauth";
import { BrandLogo } from "@/components/layout/brand-logo";
import { GithubStarLink } from "@/components/common/github-star";

/** Rendered when no token is stored — GitHub login preferred, PAT fallback. */
export function TokenGate({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setLoginError(null);
    try {
      await startLogin(); // redirects to github.com
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Could not start login.");
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-start px-4 pb-8 pt-8 sm:px-6 sm:pt-10 lg:pt-12">
      <div className="grid w-full items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <BrandLogo className="text-2xl" markClassName="size-10 rounded-xl" />
            <GithubStarLink />
          </div>
        </div>
        <div className="mt-12 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]"><span className="size-1.5 rounded-full bg-[var(--primary)]" /> GitHub, without the noise</div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">Developers &amp; agents managing GitHub together.</h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Gity brings repositories, organizations, pull requests, issues, Actions, and activity into one focused command center.</p>
        </div>
      </div>
      <div>
      <Card accent={18} className="shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Connect your GitHub
          </CardTitle>
          <CardDescription>
            Connect with GitHub to read your public and private repositories.
            Gity reads data directly from GitHub and keeps your token in this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={connect} disabled={busy}>
            {busy ? <Loader className="size-4 animate-spin" /> : null}
            {busy ? "Redirecting to GitHub…" : "Connect with GitHub"}
          </Button>
          {loginError && (
            <p className="text-xs text-[var(--destructive)]">{loginError}</p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use a personal access token
            <span className="h-px flex-1 bg-border" />
          </div>
          {showPat ? (
            <>
              <Input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="github_pat_… or ghp_…"
                value={value}
                onChange={(e) => setValue(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && value) onSave(value);
                }}
              />
              <Button className="w-full" disabled={!value} onClick={() => onSave(value)}>
                Save token locally
              </Button>
            </>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setShowPat(true)}>
              Paste a token instead
            </Button>
          )}
          <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            No token yet? GitHub → Settings → Developer settings → Personal access tokens →
            Fine-grained tokens. See Settings for the minimum read permissions.
          </p>
          <div className="flex gap-2 rounded-md border border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
            <span>
              Your token stays in this browser. Use Gity on a trusted device and never share this
              browser profile. For team or public deployments, use a server-side authentication flow.
            </span>
          </div>
        </CardContent>
      </Card>
      </div>
      </div>
      <div className="mt-10 grid w-full gap-3 border-t border-border/70 pt-6 sm:grid-cols-3">
        <Card accent={1} className="bg-card/60">
          <CardHeader className="pb-2">
            <ShieldCheck className="size-5 text-[var(--success)]" />
            <CardTitle className="text-sm">Private by default</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Your credential stays in this browser and requests go directly to GitHub.
          </CardContent>
        </Card>
        <Card accent={2} className="bg-card/60">
          <CardHeader className="pb-2">
            <Workflow className="size-5 text-[var(--primary)]" />
            <CardTitle className="text-sm">One focused workspace</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Repositories, pull requests, issues, Actions, and activity in one clear view.
          </CardContent>
        </Card>
        <Card accent={3} className="bg-card/60">
          <CardHeader className="pb-2">
            <Bot className="size-5 text-[var(--info)]" />
            <CardTitle className="text-sm">Ready for agents</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Give developers and automation the same calm, searchable GitHub command center.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
