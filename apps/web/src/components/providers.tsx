"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { PrefsProvider } from "@/lib/preferences";

/**
 * Persisted query cache: dashboard paints instantly from last session's
 * data, then background-refetches live from GitHub (staleTime < maxAge, so
 * mount always revalidates). Still 100% live data — just zero blank loads
 * on revisit. Keys already include a token fingerprint, so caches never leak
 * across tokens. Only successful queries are persisted (errors re-throw).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Smart refresh: LIVE-tier queries (runs, events) poll on the
            // user's interval; CALM-tier options set a slower 15-minute
            // interval for heavier GitHub reads.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true,
            retryDelay: (i) => Math.min(1000 * 2 ** i, 10_000),
          },
        },
      }),
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "gity.query-cache",
      throttleTime: 2000,
    }),
  );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 12 * 60 * 60 * 1000,
        // Bump when server-side configuration changes could make a persisted
        // client response incorrect (for example, Linear OAuth becoming enabled).
        buster: "gity-v3-linear-config",
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success",
        },
      }}
    >
      <PrefsProvider>
        <AuthProvider>{children}</AuthProvider>
      </PrefsProvider>
    </PersistQueryClientProvider>
  );
}
