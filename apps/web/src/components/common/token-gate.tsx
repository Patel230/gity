"use client";

import { Activity, CircleDot, Database, GitMerge, GitPullRequest, KeyRound, Loader, Play, ShieldAlert, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/lib/oauth";
import { BrandLogo } from "@/components/layout/brand-logo";

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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid w-full items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
      <div>
        <div className="flex items-center justify-between gap-3">
          <BrandLogo className="text-2xl" markClassName="size-10 rounded-xl" />
          <span className="hidden rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">Developer dashboard</span>
        </div>
        <div className="mt-12 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]"><span className="size-1.5 rounded-full bg-[var(--primary)]" /> GitHub, without the noise</div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">A calmer way to run your GitHub day.</h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Gity brings repositories, organizations, pull requests, issues, Actions, and activity into one focused command center.</p>
        </div>
        <LandingPreview />
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ShieldAlert className="size-3.5 text-[var(--primary)]" /> Token stays in your browser</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5 text-[var(--primary)]" /> No setup beyond GitHub</span>
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
              Frontend-only storage is suitable for personal/local use — it is{" "}
              <strong>not appropriate for a public multi-user deployment</strong>. Anyone with
              access to this browser profile can read the token.
            </span>
          </div>
        </CardContent>
      </Card>
      </div>
      <div className="col-span-full grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-3">
        <LandingFeature icon={Database} title="Everything in view" detail="Repos, orgs, PRs, issues, and Actions in one workspace." />
        <LandingFeature icon={GitMerge} title="Follow the flow" detail="Spot what changed, what is blocked, and what needs you." />
        <LandingFeature icon={ShieldAlert} title="Private by design" detail="No database, no proxy, and no token leaving your browser." />
      </div>
      </div>
    </div>
  );
}

function LandingPoint({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/45 p-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]"><Icon className="size-3.5" /></span>
      <span><strong className="block text-xs text-foreground">{title}</strong><span className="mt-0.5 block text-[11px] text-muted-foreground">{detail}</span></span>
    </div>
  );
}

function LandingPreview() {
  return (
    <Card accent={11} className="mt-9 max-w-xl overflow-hidden bg-card/70">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="font-mono text-[10px] text-muted-foreground">gity / overview</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--success)]"><span className="size-1.5 rounded-full bg-[var(--success)]" /> Live</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <PreviewStat icon={Database} value="24" label="repos" />
        <PreviewStat icon={GitPullRequest} value="08" label="open PRs" />
        <PreviewStat icon={CircleDot} value="13" label="issues" />
        <PreviewStat icon={Play} value="02" label="running" />
      </div>
      <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground">
        <Activity className="size-3.5 text-[var(--primary)]" /> <span>Recent activity across your workspace</span><span className="ml-auto font-mono text-[10px]">just now</span>
      </div>
    </Card>
  );
}

function PreviewStat({ icon: Icon, value, label }: { icon: typeof Database; value: string; label: string }) {
  return <div className="bg-card px-3 py-3"><Icon className="size-3.5 text-[var(--primary)]" /><p className="mt-2 font-mono text-lg font-semibold text-foreground">{value}</p><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p></div>;
}

function LandingFeature({ icon: Icon, title, detail }: { icon: typeof Database; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/35 p-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"><Icon className="size-4" /></span>
      <span><strong className="block text-xs text-foreground">{title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{detail}</span></span>
    </div>
  );
}
