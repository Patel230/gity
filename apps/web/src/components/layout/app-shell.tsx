"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth, useViewerUser } from "@/lib/auth";
import { usePrefs } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { BrandLogo } from "./brand-logo";
import { NAV } from "./nav";
import { RateLimitBadge } from "@/components/common/rate-limit";
import { TokenGate } from "@/components/common/token-gate";
import { usePaletteData } from "@/features/search/use-palette";
import { GithubStarLink } from "@/components/common/github-star";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, setToken } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname?.startsWith("/auth/callback")) {
    return <>{children}</>;
  }

  if (!token) {
    return <TokenGate onSave={(t) => setToken(t, "local")} />;
  }
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border/70 bg-card/55 backdrop-blur-xl lg:flex">
        <SidebarBody onNavigate={() => {}} />
      </aside>
      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-60 flex-col border-r border-border bg-card">
            <SidebarBody onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-5">{children}</main>
        <footer className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
          Developers &amp; agents managing GitHub together. Your token stays in this browser and is
          forwarded only for GitHub requests. <GithubStarLink compact />
        </footer>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className="px-4 pb-3 pt-4"><BrandLogo /></div>
      <nav className="flex-1 space-y-0.5 overflow-auto px-2">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px] text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                active && "nav-active mx-1 gap-3.5 rounded-[20px] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-4 py-4 text-[15px] font-medium text-foreground",
              )}
            >
              <item.icon className={cn(active ? "size-5" : "size-4", "shrink-0", active ? "text-[var(--primary)]" : "group-hover:text-[var(--primary)]")} />
              {item.label}
            </Link>
          );
        })}
        <div className="mx-2 my-2 border-t border-border" />
      </nav>
    </>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const viewer = useViewerUser();
  const { clearToken } = useAuth();
  const { appearance, setAppearance } = usePrefs();
  const palette = usePaletteData();
  const current = NAV.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
      <Button size="icon" variant="ghost" className="lg:hidden" onClick={onMenu} aria-label="Menu">
        <Menu className="size-4" />
      </Button>
      <BrandLogo className="lg:hidden" markClassName="size-7 rounded-md" />
      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">gity</span>
        <span className="text-border">/</span>
        <span className="truncate text-xs font-medium text-foreground">{current?.label ?? "Workspace"}</span>
      </div>
      <div className="flex-1" />
      <CommandPalette data={palette} />
      <RateLimitBadge />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
        title={`Switch to ${appearance === "dark" ? "light" : "dark"} mode`}
        aria-label="Toggle light and dark theme"
      >
        {appearance === "dark" ? <Sun className="size-4 text-[var(--primary)]" /> : <Moon className="size-4 text-[var(--primary)]" />}
      </Button>
      <AccountMenu viewer={viewer.data} onLogout={clearToken} />
    </header>
  );
}

function AccountMenu({
  viewer,
  onLogout,
}: {
  viewer?: { login: string; name: string | null; avatarUrl: string; htmlUrl: string };
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((value) => !value)} className="rounded-full p-0.5 hover:bg-accent" title="Open account menu" aria-label="Open account menu" aria-expanded={open}>
        <Avatar src={viewer?.avatarUrl} alt={viewer?.login ?? "GitHub profile"} className="size-8" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-2 py-2.5">
            <Avatar src={viewer?.avatarUrl} alt={viewer?.login ?? "GitHub profile"} className="size-9" />
            <div className="min-w-0"><p className="truncate text-xs font-semibold">{viewer?.name ?? viewer?.login ?? "GitHub profile"}</p><p className="truncate text-[11px] text-muted-foreground">@{viewer?.login ?? "…"}</p></div>
          </div>
          <div className="py-1">
            <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-2.5 py-2 text-xs hover:bg-accent">Profile</Link>
          </div>
          <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg border-t border-border px-2.5 py-2.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="size-3.5" /> Sign out</button>
        </div>
      ) : null}
    </div>
  );
}

export function MobileMenuIcon() {
  return <X className="size-4" />;
}
