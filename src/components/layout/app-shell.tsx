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
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-border bg-card/40 lg:flex">
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-4">{children}</main>
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
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
          G
        </span>
        <span className="font-mono text-base font-bold tracking-tight">Gity</span>
      </div>
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
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground",
                active && "bg-accent font-medium text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div className="mx-2 my-2 border-t border-border" />
        <Link
          href={SETTINGS_NAV.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground",
            pathname.startsWith(SETTINGS_NAV.href) && "bg-accent font-medium text-foreground",
          )}
        >
          <SETTINGS_NAV.icon className="size-4 shrink-0" />
          {SETTINGS_NAV.label}
        </Link>
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Avatar src={viewer.data?.avatarUrl} alt={viewer.data?.login ?? "?"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{viewer.data?.login ?? "…"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {viewer.data?.name ?? "GitHub user"}
            </p>
          </div>
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
  const { theme, setTheme } = usePrefs();
  const palette = usePaletteData();
  void onLogout;
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-4">
      <Button size="icon" variant="ghost" className="lg:hidden" onClick={onMenu} aria-label="Menu">
        <Menu className="size-4" />
      </Button>
      <span className="font-mono text-sm font-bold lg:hidden">Gity</span>
      <div className="flex-1" />
      <CommandPalette data={palette} />
      <RateLimitBadge />
      <RefreshControl />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  );
}

export function MobileMenuIcon() {
  return <X className="size-4" />;
}
