"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { PrefsProvider } from "@/lib/preferences";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Near-live frontend refresh behavior:
            refetchOnWindowFocus: true, // refetch immediately when tab regains focus
            refetchOnReconnect: true,
            refetchOnMount: true,
            retryDelay: (i) => Math.min(1000 * 2 ** i, 10_000),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PrefsProvider>
        <AuthProvider>{children}</AuthProvider>
      </PrefsProvider>
    </QueryClientProvider>
  );
}
