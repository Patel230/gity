import { AlertTriangle, Inbox, KeyRound, Timer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GithubApiError } from "@/lib/github/types";
import { timeAgo } from "@/lib/utils";

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <Card accent={3} className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Inbox className="size-7 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  const isGithub = error instanceof GithubApiError;
  const kind = isGithub ? error.kind : null;

  let title = "Something went wrong";
  let hint = error.message;
  let action: React.ReactNode = null;

  if (kind === "auth") {
    title = "Token rejected";
    hint =
      "GitHub returned 401. Your token may be expired or revoked. Replace it in Settings.";
    action = (
      <Link href="/settings">
        <Button size="sm">Open Settings</Button>
      </Link>
    );
  } else if (kind === "forbidden") {
    title = "Permission denied";
    hint =
      "GitHub returned 403. Your token is missing a required read permission (or SSO is needed for an org). See Settings for the minimum permission list.";
    action = (
      <Link href="/settings">
        <Button size="sm" variant="secondary">
          <KeyRound className="size-3.5" /> Check permissions
        </Button>
      </Link>
    );
  } else if (kind === "rate-limit") {
    const reset = isGithub && error.resetAt ? timeAgo(new Date(error.resetAt).toISOString()) : null;
    title = "Rate limit exhausted";
    hint = `GitHub is throttling requests${reset ? ` (resets ${reset.replace(" ago", " from now")})` : ""}. Live Refresh backs off automatically — or pause it in Settings.`;
    action = onRetry ? (
      <Button size="sm" variant="secondary" onClick={onRetry}>
        <Timer className="size-3.5" /> Retry
      </Button>
    ) : null;
  } else if (kind === "blocked") {
    title = "Request blocked before reaching GitHub";
    hint =
      "Your browser couldn't complete the request (shows as a CORS/network error in the console). GitHub's API itself allows browser calls — so this is a local blocker: an ad-blocker or privacy extension, Brave Shields, VPN, corporate firewall, or antivirus. Try an incognito window with extensions off, or another network. Details in Settings → Connection test.";
    action = (
      <Link href="/settings">
        <Button size="sm" variant="secondary">
          Open Connection test
        </Button>
      </Link>
    );
  } else if (onRetry) {
    action = (
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    );
  }

  return (
    <Card accent={3} className="flex flex-col items-center gap-2 border-[color-mix(in_srgb,var(--destructive)_40%,var(--border))] px-6 py-10 text-center">
      <AlertTriangle className="size-7 text-[var(--destructive)]" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{hint}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
