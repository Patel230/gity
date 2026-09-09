"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth, useViewerUser } from "@/lib/auth";
import { usePrefs } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { BrandLogo } from "./brand-logo";
import { NAV, SETTINGS_NAV } from "./nav";
import { RateLimitBadge } from "@/components/common/rate-limit";
import { RefreshControl } from "@/components/common/refresh-control";
import { TokenGate } from "@/components/common/token-gate";
import { usePaletteData } from "@/features/search/use-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { token, setToken, clearToken } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <Header onMenu={() => setSidebarOpen(true)} onLogout={clearToken} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-5">{children}</main>
        <footer className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
          Gity — frontend-only GitHub command center. Data lives on GitHub; your token never
          leaves api.github.com.{" "}
          {process.env.NEXT_PUBLIC_REPO_URL ? (
            <a
              href={process.env.NEXT_PUBLIC_REPO_URL}
              target="_blank"
              rel="noopener"
              className="underline hover:text-foreground"
            >
              Star on GitHub
            </a>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { clearToken } = useAuth();
  const viewer = useViewerUser();
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
                active && "mx-1 gap-3.5 rounded-[20px] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-4 py-4 text-[15px] font-medium text-foreground shadow-[inset_5px_0_var(--primary)]",
              )}
            >
              <item.icon className={cn(active ? "size-5" : "size-4", "shrink-0", active ? "text-[var(--primary)]" : "group-hover:text-[var(--primary)]")} />
              {item.label}
            </Link>
          );
        })}
        <div className="mx-2 my-2 border-t border-border" />
        <Link
          href={SETTINGS_NAV.href}
          onClick={onNavigate}
          className={cn(
            "group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px] text-muted-foreground hover:bg-accent/70 hover:text-foreground",
            pathname.startsWith(SETTINGS_NAV.href) && "mx-1 gap-3.5 rounded-[20px] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-4 py-4 text-[15px] font-medium text-foreground shadow-[inset_5px_0_var(--primary)]",
          )}
        >
          <SETTINGS_NAV.icon className={cn("size-4 shrink-0", pathname.startsWith(SETTINGS_NAV.href) ? "text-[var(--primary)]" : "group-hover:text-[var(--primary)]")} />
          {SETTINGS_NAV.label}
        </Link>
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 -m-1 hover:bg-accent/70">
          <Avatar src={viewer.data?.avatarUrl} alt={viewer.data?.login ?? "?"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{viewer.data?.login ?? "…"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {viewer.data?.name ?? "GitHub user"}
            </p>
          </div>
          </Link>
          <button
            onClick={clearToken}
            title="Remove token (sign out)"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

function Header({ onMenu, onLogout }: { onMenu: () => void; onLogout: () => void }) {
  const pathname = usePathname();
  const { appearance, setAppearance } = usePrefs();
  const palette = usePaletteData();
  const current = [...NAV, SETTINGS_NAV].find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  void onLogout;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/75 px-3 backdrop-blur-xl sm:px-5">
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
      <RefreshControl />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
        title={`Switch to ${appearance === "dark" ? "light" : "dark"} mode`}
        aria-label="Toggle light and dark theme"
      >
        {appearance === "dark" ? <Sun className="size-4 text-[var(--primary)]" /> : <Moon className="size-4 text-[var(--primary)]" />}
      </Button>
    </header>
  );
}

export function MobileMenuIcon() {
  return <X className="size-4" />;
}
