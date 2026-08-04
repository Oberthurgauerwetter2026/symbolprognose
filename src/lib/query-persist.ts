/**
 * Leichtgewichtige Cache-Persistenz für die Kartenabfragen.
 *
 * Absichtlich OHNE `PersistQueryClientProvider`: dieser hatte in einer
 * früheren Version Hydration-/Suspense-Fehler (AwaitInner / React.use)
 * ausgelöst. Hier wird der Cache rein synchron aus `localStorage`
 * hydriert und danach entprellt zurückgeschrieben.
 */

import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

import { PERSISTED_QUERY_PREFIXES } from "@/lib/map-queries";

const STORAGE_KEY = "wx-rq-cache-v2";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 1_000;

const PREFIXES = new Set<string>(PERSISTED_QUERY_PREFIXES);

type Persisted = { at: number; state: unknown };

export function setupQueryPersistence(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed && Date.now() - parsed.at < MAX_AGE_MS) {
        hydrate(queryClient, parsed.state);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const state = dehydrate(queryClient, {
          shouldDehydrateQuery: (q) =>
            q.state.status === "success" && PREFIXES.has(String(q.queryKey[0])),
        });
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ at: Date.now(), state } satisfies Persisted),
        );
      } catch {
        /* Quota o.ä. – Persistenz ist optional */
      }
    }, WRITE_DEBOUNCE_MS);
  });
}
