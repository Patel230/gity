import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-transparent bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
        destructive: "border-transparent bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] text-[var(--destructive)]",
        warning: "border-transparent bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
        info: "border-transparent bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
