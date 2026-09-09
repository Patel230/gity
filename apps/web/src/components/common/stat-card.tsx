import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "destructive" | "warning" | "info";
  accent?: number;
}) {
  const tones: Record<string, { value: string; icon: string }> = {
    default: { value: "text-foreground", icon: "text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]" },
    success: { value: "text-[var(--success)]", icon: "text-[var(--success)] bg-[color-mix(in_srgb,var(--success)_15%,transparent)]" },
    destructive: { value: "text-[var(--destructive)]", icon: "text-[var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)]" },
    warning: { value: "text-[var(--warning)]", icon: "text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_15%,transparent)]" },
    info: { value: "text-[var(--primary)]", icon: "text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]" },
  };
  const currentTone = tones[tone ?? "default"];
  return (
    <Card accent={accent} className="group p-3.5 transition-transform hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {Icon ? <span className={cn("flex size-7 items-center justify-center rounded-lg", currentTone.icon)}><Icon className="size-3.5 shrink-0" /></span> : null}
      </div>
      <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", currentTone.value)}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

export function StatCardLoading() {
  return (
    <Card className="p-3.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-7 w-16" />
    </Card>
  );
}
