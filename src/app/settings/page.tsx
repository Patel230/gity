"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader, RefreshCw, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeviceLogin } from "@/components/common/device-login";
import { RateLimitPanel } from "@/components/common/rate-limit";
import { PageHead } from "@/app/page";
import { useAuth, useViewerUser, type StorageMode } from "@/lib/auth";
import { checkToken } from "@/lib/github/rest";
import { POLL_LABEL, usePrefs, type PollInterval, type Theme } from "@/lib/preferences";

export default function SettingsPage() {
  const { token, kind, oauth, storageMode, setToken, clearToken, refreshOAuth } = useAuth();
  const viewer = useViewerUser();
  const { theme, setTheme, poll, setPoll } = usePrefs();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<StorageMode>("local");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const test = async (t: string) => {
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
      <PageHead title="Settings" sub="Token, Live Refresh, and security notes" />

      <div className="flex gap-2 rounded-md border border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
        <span>
          <strong className="text-foreground">Frontend-only token storage is suitable for personal/local use</strong>{" "}
          and is <strong className="text-foreground">not appropriate for a public multi-user deployment</strong>.
          The token lives in this browser's storage and is sent only to <code className="font-mono">api.github.com</code>.
          Anyone (or any script) with access to this browser profile can read it. Never paste a token
          on a shared machine, and prefer fine-grained tokens with minimum read scopes.
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Sign in with GitHub
            {kind === "oauth" && <Badge variant="success">active</Badge>}
          </CardTitle>
          <CardDescription>
            One-click login via Device Flow — works for public and private repos, no token
            pasting. {oauth?.expiresAt ? <>Session expires {new Date(oauth.expiresAt).toLocaleString()}.</> : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {kind === "oauth" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => refreshOAuth()}>
                <RefreshCw className="size-3.5" /> Refresh session now
              </Button>
              <Button size="sm" variant="ghost" onClick={clearToken}>
                Sign out
              </Button>
            </div>
          ) : (
            <DeviceLogin compact />
          )}
        </CardContent>
      </Card>

      <Card>
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
              <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">localStorage (persists)</SelectItem>
                <SelectItem value="session">sessionStorage (this tab only)</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!draft} onClick={() => { setToken(draft, mode); setDraft(""); setTestResult(null); }}>
              {token ? "Replace token" : "Save token"}
            </Button>
            <Button size="sm" variant="secondary" disabled={!token && !draft || testing} onClick={() => test(draft)}>
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

      <Card>
        <CardHeader>
          <CardTitle>Live Refresh</CardTitle>
          <CardDescription>Polling — not true real-time. No webhooks, no backend. Pauses aggressively when the tab is hidden and refetches on focus.</CardDescription>
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Dark mode first, light available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate limits</CardTitle>
          <CardDescription>Live budget from GitHub response headers</CardDescription>
        </CardHeader>
        <CardContent>
          <RateLimitPanel />
        </CardContent>
      </Card>

      <Card>
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
