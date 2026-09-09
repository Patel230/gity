import type { CiState } from "@/lib/github/types";
import { cn } from "@/lib/utils";

const STYLES: Record<CiState, { dot: string; label: string }> = {
  passing: { dot: "bg-[var(--success)]", label: "Passing" },
  failing: { dot: "bg-[var(--destructive)]", label: "Failing" },
  pending: { dot: "bg-[var(--warning)]", label: "Pending" },
  "no-checks": { dot: "bg-muted-foreground", label: "No checks" },
  unknown: { dot: "bg-muted-foreground/50", label: "Unknown" },
};

export function CiDot({ state, showLabel }: { state: CiState; showLabel?: boolean }) {
  const s = STYLES[state];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`CI: ${s.label}`}>
      <span className={cn("size-2 rounded-full", s.dot)} />
      {showLabel ? <span className="text-xs text-muted-foreground">{s.label}</span> : null}
    </span>
  );
}
