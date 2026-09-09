"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, KeyRound, Loader, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DeviceFlowError,
  githubClientId,
  pollDeviceToken,
  requestDeviceCode,
  type DeviceCode,
} from "@/lib/device-flow";
import { useAuth } from "@/lib/auth";

type Phase = "idle" | "starting" | "waiting" | "done" | "error";

/**
 * "Sign in with GitHub" via Device Flow. Shown when the deployer configured
 * NEXT_PUBLIC_GITHUB_CLIENT_ID (a public GitHub-App client ID). Otherwise
 * shows PAT-only setup guidance.
 */
export function DeviceLogin({ compact }: { compact?: boolean }) {
  const clientId = githubClientId();
  const { setOAuthSession } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secsLeft, setSecsLeft] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== "waiting" || !code) return;
    setSecsLeft(code.expiresIn);
    const t = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, code]);

  if (!clientId) {
    return (
      <div className="rounded-md border border-border p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <KeyRound className="size-3.5" /> GitHub login is not configured on this deployment
        </p>
        <p className="mt-1">
          The site owner can enable one-click sign-in by creating a GitHub App (with Device Flow)
          and setting <code className="font-mono">NEXT_PUBLIC_GITHUB_CLIENT_ID</code> at build
          time. Meanwhile, sign in with a personal access token below — it works identically,
          including private repositories.
        </p>
      </div>
    );
  }

  const start = async () => {
    setPhase("starting");
    setError(null);
    try {
      const c = await requestDeviceCode(clientId);
      setCode(c);
      setPhase("waiting");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const t = await pollDeviceToken(clientId, c.deviceCode, c.interval, ctrl.signal);
      setOAuthSession(t.accessToken, {
        refreshToken: t.refreshToken ?? null,
        expiresAt: t.expiresIn ? Date.now() + t.expiresIn * 1000 : null,
      });
      setPhase("done");
    } catch (e) {
      if (e instanceof DeviceFlowError && e.kind === "expired" && abortRef.current?.signal.aborted) {
        setPhase("idle"); // user cancelled
        setCode(null);
      } else {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
        setPhase("error");
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setCode(null);
  };

  if (phase === "waiting" && code) {
    return (
      <div className="space-y-3 rounded-md border border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Enter this code on GitHub (expires in {Math.floor(secsLeft / 60)}:
          {`${secsLeft % 60}`.padStart(2, "0")})
        </p>
        <p className="font-mono text-3xl font-bold tracking-[0.2em]">{code.userCode}</p>
        <div className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row"} justify-center gap-2`}>
          <a href={code.verificationUri} target="_blank" rel="noopener">
            <Button size="sm" className="w-full">
              <ExternalLink className="size-3.5" /> Open github.com/login/device
            </Button>
          </a>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(code.userCode).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Loader className="size-3.5 animate-spin" /> Waiting for authorization…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={start} disabled={phase === "starting"}>
        {phase === "starting" ? <Loader className="size-4 animate-spin" /> : null}
        {phase === "starting" ? "Contacting GitHub…" : "Sign in with GitHub"}
      </Button>
      {phase === "error" && error && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--destructive)]">
          <XCircle className="size-3.5" /> {error}{" "}
          <button className="underline" onClick={start}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
