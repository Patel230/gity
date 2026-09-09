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
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "destructive" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    success: "text-[var(--success)]",
    destructive: "text-[var(--destructive)]",
    warning: "text-[var(--warning)]",
    info: "text-[var(--primary)]",
  };
  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      </div>
      <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", tones[tone ?? "default"])}>
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
