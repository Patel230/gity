import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-5xl font-bold text-muted-foreground">404</p>
      <p className="text-sm">This view doesn&apos;t exist.</p>
      <Link href="/">
        <Button size="sm">Back to Overview</Button>
      </Link>
    </div>
  );
}
