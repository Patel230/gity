"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  alt,
  className,
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle",
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={alt ?? ""} className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback className="text-[10px] font-medium text-muted-foreground">
        {(alt ?? "?").slice(0, 2).toUpperCase()}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
