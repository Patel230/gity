"use client";

import { KeyRound, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeviceLogin } from "./device-login";

/** Rendered when no token is stored — GitHub login preferred, PAT fallback. */
export function TokenGate({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [showPat, setShowPat] = useState(false);
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <p className="font-mono text-2xl font-bold">Gity</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal GitHub command center
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Connect your GitHub
          </CardTitle>
          <CardDescription>
            Sign in to read your public and private repositories. The token stays in this
            browser only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <DeviceLogin />
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
          <div className="flex gap-2 rounded-md border border-[color-mix(in_srgb,var(--warning)_50%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
            <span>
              Frontend-only storage is suitable for personal/local use — it is{" "}
              <strong>not appropriate for a public multi-user deployment</strong>. Anyone with
              access to this browser profile can read the token.{" "}
              <Link href="/settings" className="underline">
                Learn more
              </Link>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
