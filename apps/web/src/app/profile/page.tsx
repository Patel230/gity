"use client";

import Link from "next/link";
import { ExternalLink, GitBranch, KeyRound, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
import { PageHead } from "@/app/page";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, useViewerUser } from "@/lib/auth";
import { usePrefs } from "@/lib/preferences";

export default function ProfilePage() {
  const viewer = useViewerUser();
  const { storageMode, clearToken } = useAuth();
  const { appearance, theme } = usePrefs();

  if (viewer.error) return <ErrorState error={viewer.error} />;
  if (!viewer.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHead title="Profile" sub="Your GitHub identity and Gity workspace settings" />
        <Card><CardContent className="space-y-3 p-6"><Skeleton className="size-20 rounded-2xl" /><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64" /></CardContent></Card>
      </div>
    );
  }

  const user = viewer.data;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHead title="Profile" sub="Your GitHub identity and Gity workspace settings" />

      <Card accent={18} className="overflow-hidden">
        <div className="h-2 bg-[var(--primary)]" />
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <Avatar src={user.avatarUrl} alt={user.login} className="size-20 rounded-2xl border-2 border-border" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold tracking-tight">{user.name ?? user.login}</h2>
              <Badge variant="outline">@{user.login}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Authenticated GitHub profile</p>
            <a href={user.htmlUrl} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline">
              <GitBranch className="size-3.5" /> View on GitHub <ExternalLink className="size-3" />
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings"><Button size="sm"><KeyRound className="size-3.5" /> Settings</Button></Link>
            <Button size="sm" variant="secondary" onClick={clearToken}><LogOut className="size-3.5" /> Sign out</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={ShieldCheck} label="Connection" value="GitHub API" detail="Direct from this browser" accent={19} />
        <InfoCard icon={KeyRound} label="Token storage" value={storageMode === "local" ? "Persistent" : "This tab"} detail={storageMode === "local" ? "localStorage" : "sessionStorage"} accent={20} />
        <InfoCard icon={Palette} label="Workspace" value={appearance === "dark" ? "Dark mode" : "Light mode"} detail={theme.replaceAll("-", " ")} accent={1} />
      </div>

      <Card accent={2}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="size-4" /> About your Gity profile</CardTitle>
          <CardDescription>A private command center built around your GitHub account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
          <p><strong className="text-foreground">Identity</strong><br />Gity uses your authenticated GitHub viewer for repositories, organizations, activity, pull requests, issues, and Actions.</p>
          <p><strong className="text-foreground">Privacy</strong><br />Your credential remains in this browser and is sent only to GitHub. Review or remove it anytime in Settings.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, detail, accent }: { icon: typeof ShieldCheck; label: string; value: string; detail: string; accent: number }) {
  return (
    <Card accent={accent} className="p-4">
      <Icon className="size-4 text-[var(--primary)]" />
      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
    </Card>
  );
}
