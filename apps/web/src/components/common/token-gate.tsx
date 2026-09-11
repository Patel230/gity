"use client";

import { Activity, ArrowRight, Bot, Building2, Database, GitBranch, KeyRound, Loader, Map as MapIcon, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/lib/oauth";
import { BrandLogo } from "@/components/layout/brand-logo";
import { GithubStarLink } from "@/components/common/github-star";

/** Rendered when no server session or local PAT is available. */
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
        <SystemMapPreview />
      </div>
      <div>
      <Card accent={18} className="shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Connect your GitHub
          </CardTitle>
          <CardDescription>
            Connect with GitHub to read your public and private repositories.
            OAuth credentials stay in an encrypted server-side session. A local PAT is available as
            a compatibility fallback.
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
              OAuth keeps GitHub credentials off the browser. If you use a PAT fallback, it stays in
              this browser—use it only on a trusted device and never share this browser profile.
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
            OAuth requests use a short-lived encrypted server session; PAT fallback credentials stay
            in this browser.
          </CardContent>
        </Card>
        <Card accent={2} className="bg-card/60">
          <CardHeader className="pb-2">
            <MapIcon className="size-5 text-[var(--primary)]" />
            <CardTitle className="text-sm">See the system</CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Map ownership, delivery flow, and repository health in one visual frame.
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

function SystemMapPreview() {
  return (
    <div className="mt-9 max-w-2xl rounded-xl border border-border/80 bg-card/55 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:p-4">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--primary)]"><MapIcon className="size-3" /> System map preview</p>
          <p className="mt-1 text-xs font-medium">See the shape of the work before opening a single tab.</p>
        </div>
        <span className="shrink-0 rounded-full border border-border/70 px-2 py-1 font-mono text-[9px] text-muted-foreground">example workspace</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_24px_minmax(0,1fr)] sm:items-center">
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] p-3">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-accent text-[var(--primary)]"><Building2 className="size-3.5" /></span><span className="font-mono text-xs font-semibold">acme</span></div>
          <p className="mt-2 text-[10px] text-muted-foreground">one owning org</p>
        </div>
        <ArrowRight className="mx-auto hidden size-4 text-[var(--primary)] sm:block" />
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewRepo name="storefront" stack="Next.js" state="healthy" />
          <PreviewRepo name="payments" stack="Go" state="attention" />
          <PreviewRepo name="design-system" stack="TypeScript" state="healthy" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-2">
        <PreviewSignal icon={GitBranch} label="code flow" value="payments → storefront" />
        <PreviewSignal icon={Activity} label="delivery" value="2 healthy · 1 needs attention" />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Ownership, repository relationships, exact code references, delivery signals, and codebase shape—together, with evidence behind each edge.</p>
    </div>
  );
}

function PreviewRepo({ name, stack, state }: { name: string; stack: string; state: "healthy" | "attention" }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/35 p-2.5">
      <div className="flex items-start gap-2"><span className="grid size-6 shrink-0 place-items-center rounded bg-accent text-[var(--primary)]"><Database className="size-3.5" /></span><span className="min-w-0"><span className="block truncate font-mono text-[10px] font-semibold">{name}</span><span className="block truncate text-[9px] text-muted-foreground">{stack}</span></span></div>
      <div className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground"><span className={state === "healthy" ? "size-1.5 rounded-full bg-[var(--success)]" : "size-1.5 rounded-full bg-[var(--warning)]"} />{state === "healthy" ? "healthy" : "needs attention"}</div>
    </div>
  );
}

function PreviewSignal({ icon: Icon, label, value }: { icon: typeof GitBranch; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/25 px-2.5 py-2"><Icon className="size-3.5 shrink-0 text-[var(--primary)]" /><span className="min-w-0"><span className="block text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span><span className="block truncate font-mono text-[10px]">{value}</span></span></div>;
}
