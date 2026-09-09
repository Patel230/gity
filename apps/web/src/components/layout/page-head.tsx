import type { ReactNode } from "react";

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
      <div className="relative pl-3">
        <span className="absolute bottom-0 left-0 top-0 w-0.5 rounded-full bg-primary" />
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">gity / {title.toLowerCase()}</p>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}
