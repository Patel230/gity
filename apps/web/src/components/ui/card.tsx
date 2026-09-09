import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, accent, ...props }: React.HTMLAttributes<HTMLDivElement> & { accent?: number }) {
  return (
    <div
      data-card-accent={accent}
      className={cn(
        "rounded-md border border-border bg-card text-card-foreground transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--card-accent,var(--primary))_55%,var(--border))]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-4 pt-3.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold leading-none", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 pt-3", className)} {...props} />;
}
