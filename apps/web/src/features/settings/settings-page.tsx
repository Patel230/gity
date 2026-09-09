"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader, Moon, ShieldAlert, Sun, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OAuthCard } from "@/components/common/oauth-card";
import { RateLimitPanel } from "@/components/common/rate-limit";
import { ConnectionTest } from "@/components/common/connection-test";
import { PageHead } from "@/components/layout/page-head";
import { useAuth, useViewerUser, type StorageMode } from "@/lib/auth";
import { checkToken } from "@/lib/github/rest";
import { FEATURED_THEMES, POLL_LABEL, THEMES, usePrefs, type PollInterval, type Theme } from "@/lib/preferences";

export type SettingsSection = "access" | "appearance" | "refresh" | "github";

export default function SettingsRoute() {
  redirect("/profile");
}

export function SettingsPage({ embedded = false, section }: { embedded?: boolean; section?: SettingsSection } = {}) {
  if (!embedded) redirect("/profile");
  const { token, storageMode, setToken, clearToken } = useAuth();
  const viewer = useViewerUser();
  const { theme, setTheme, appearance, setAppearance, poll, setPoll } = usePrefs();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<StorageMode>("local");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const user = await checkToken(draft || token || "");
      setTestResult({ ok: true, message: `Token works — authenticated as ${user.login}.` });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Token test failed." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!embedded ? <PageHead title="Settings" sub="Token, Live Refresh, and security notes" /> : null}

      {(!section || section === "access") && <>
      <div className="flex gap-2 rounded-md border border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
        <span>
          <strong className="text-foreground">Your token is stored only in this browser</strong> and is sent
          to GitHub directly, or through Gity&apos;s short-lived relay when your browser blocks direct access.
          Use Gity on a trusted device, never share this browser profile, and prefer a fine-grained token
          with the minimum read permissions. For team or public deployments, use a server-side
          authentication flow.
        </span>
      </div>

      <OAuthCard />

      <Card accent={12}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> GitHub token</CardTitle>
          <CardDescription>
            {token ? (
              <>Stored ({storageMode === "local" ? "localStorage — persists" : "sessionStorage — this tab only"}) · {viewer.data ? <>authenticated as <strong>{viewer.data.login}</strong></> : "validating…"}</>
            ) : (
              "No token stored."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {token && (
            <div className="flex items-center gap-2">
              <Input type={show ? "text" : "password"} readOnly value={token} className="font-mono text-xs" />
              <Button size="icon" variant="ghost" onClick={() => setShow((v) => !v)} title={show ? "Hide" : "Show"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={token ? "Paste a replacement token…" : "github_pat_… or ghp_…"}
              value={draft}
              onChange={(e) => setDraft(e.target.value.trim())}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mode} onValueChange={(v) => setMode(v as StorageMode)}>
            <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">localStorage (persists)</SelectItem>
                <SelectItem value="session">sessionStorage (this tab only)</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!draft} onClick={() => { setToken(draft, mode); setDraft(""); setTestResult(null); }}>
              {token ? "Replace token" : "Save token"}
            </Button>
            <Button size="sm" variant="secondary" disabled={!token && !draft || testing} onClick={test}>
              {testing ? <Loader className="size-3.5 animate-spin" /> : null} Test {draft ? "new token" : "current token"}
            </Button>
            {token && (
              <Button size="sm" variant="destructive" onClick={() => { clearToken(); setTestResult(null); }}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            )}
          </div>
          {testResult && (
            <p className={`flex items-center gap-1.5 text-xs ${testResult.ok ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}>
              {testResult.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
              {testResult.message}
            </p>
          )}
        </CardContent>
      </Card>
      </>}

      {(!section || section === "refresh") && <Card accent={13}>
        <CardHeader>
          <CardTitle>Live Refresh</CardTitle>
          <CardDescription>Polling — not true real-time. Workflow runs and recent activity poll on this interval; heavier data (repos, PRs, issues, CI) refreshes on page open, window focus, and manual Refresh to protect GitHub rate limits.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Poll important data</span>
            <Select value={poll} onValueChange={(v) => setPoll(v as PollInterval)}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(POLL_LABEL) as PollInterval[]).map((p) => (
                  <SelectItem key={p} value={p}>{POLL_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>}

      {(!section || section === "appearance") && <Card accent={14}>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose a default or one of 20 curated open-source palettes, then switch between Dark and Light appearances.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEATURED_THEMES.map((id) => <SelectItem key={id} value={id}>{THEMES[id].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Appearance</span>
            <Button size="sm" variant={appearance === "dark" ? "default" : "outline"} onClick={() => setAppearance("dark")}><Moon className="size-3" /> Dark</Button>
            <Button size="sm" variant={appearance === "light" ? "default" : "outline"} onClick={() => setAppearance("light")}><Sun className="size-3" /> Light</Button>
          </div>
        </CardContent>
      </Card>}

      {(!section || section === "github") && <>
      <Card accent={15}>
        <CardHeader>
          <CardTitle>Rate limits</CardTitle>
          <CardDescription>Live budget from GitHub response headers</CardDescription>
        </CardHeader>
        <CardContent>
          <RateLimitPanel />
        </CardContent>
      </Card>
      <ConnectionTest />
      <Card accent={16}>
          <CardHeader>
            <CardTitle>Fine-grained token setup</CardTitle>
            <CardDescription>Minimum read permissions for full Gity functionality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>At <span className="font-mono">github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens</span>, create a token with:</p>
            <ul className="space-y-1">
              <Perm name="Metadata" why="required on every fine-grained token" />
              <Perm name="Contents: read" why="repos, languages, branches" />
              <Perm name="Pull requests: read" why="PR lists, reviews" />
              <Perm name="Issues: read" why="issue lists, labels" />
              <Perm name="Actions: read" why="workflow runs" />
              <Perm name="Commit statuses / Checks: read" why="CI state (or use Checks: read)" />
              <Perm name="Members / Organization: read" why="org listing (Members: read)" />
            </ul>
            <p className="flex items-center gap-1.5 pt-1">
              <Badge variant="outline">Classic fallback</Badge>
              scopes <code className="font-mono">repo</code> + <code className="font-mono">read:org</code> cover everything but grant more than needed.
            </p>
            <p>Tip: organization SSO — if an org requires SAML, click “Authorize” / “Configure SSO” on the token for that org, or org data will 404.</p>
          </CardContent>
        </Card>
      </>}
    </div>
  );
}

function Perm({ name, why }: { name: string; why: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="size-3.5 shrink-0 text-[var(--success)]" />
      <code className="font-mono text-foreground">{name}</code>
      <span>— {why}</span>
    </li>
  );
}
