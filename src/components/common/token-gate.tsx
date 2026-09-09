"use client";

import { KeyRound, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Rendered when no token is stored — PAT sign-in (the supported browser path). */
export function TokenGate({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState("");
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
            <KeyRound className="size-4" /> Connect with a GitHub token
          </CardTitle>
          <CardDescription>
            Paste a personal access token to read your public and private repositories.
            It stays in this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
          <p className="text-[11px] leading-relaxed text-muted-foreground">
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
  );
}
