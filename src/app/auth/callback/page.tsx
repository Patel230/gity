"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Loader, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { finishLogin } from "@/lib/oauth";

/**
 * OAuth callback: github.com redirects here with ?code=&state=.
 * Everything happens client-side on mount.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading label="Finishing sign-in…" />}>
      <CallbackInner />
    </Suspense>
  );
}

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { setOAuthSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    finishLogin(params.toString())
      .then((t) => {
        setOAuthSession(t.accessToken, {
          refreshToken: t.refreshToken ?? null,
          expiresAt: t.expiresIn ? Date.now() + t.expiresIn * 1000 : null,
        });
        router.replace("/");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Login failed."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
        <XCircle className="size-8 text-[var(--destructive)]" />
        <p className="text-sm font-medium">Couldn&apos;t finish signing in</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button size="sm" onClick={() => router.replace("/")}>
          Back to sign-in
        </Button>
      </div>
    );
  }
  return <CallbackLoading label="Finishing sign-in with GitHub…" />;
}

function CallbackLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader className="size-5 animate-spin" /> {label}
    </div>
  );
}
