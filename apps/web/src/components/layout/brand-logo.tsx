import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, markClassName, showName = true }: { className?: string; markClassName?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-transparent", markClassName)}>
        <Image src="/gity-logo.png" alt="Gity logo" width={256} height={256} className="brand-logo-image size-full object-contain" priority />
      </span>
      {showName ? <span className="font-display font-semibold tracking-tight">Gity</span> : null}
    </span>
  );
}
