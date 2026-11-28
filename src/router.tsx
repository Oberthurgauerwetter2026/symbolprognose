import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupQueryPersistence } from "./lib/query-persist";

function DefaultErrorComponent({
  error,
  reset,
}: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error | undefined)?.message ?? "Something went wrong on our end."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // gcTime must be >= persister maxAge so hydrated cache survives
        gcTime: 1000 * 60 * 60 * 24, // 24h
      },
    },
  });

  // Letzter Kartenstand aus localStorage, damit nach Neuladen sofort Daten da sind.
  setupQueryPersistence(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Route-Code + Loader schon beim Hovern/Antippen starten.
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 0,

    defaultErrorComponent: DefaultErrorComponent,

    // Serverseitig geladene Abfragen reisen mit der Seite in den Browser. Ohne das muss der
    // Browser beim Start alle Daten neu holen und die Seite bleibt bis dahin unbedienbar
    // (hängt eine Anfrage, öffnen sich weder Kacheln noch Regionskarte).
    dehydrate: () => ({
      // Abfragedaten sind schon Rückgaben serialisierbarer Serverfunktionen; der Router-Typ kann das nicht prüfen.
      queryClientState: dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === "success",
      }) as unknown as Record<string, string>,
    }),
    hydrate: (dehydrated: { queryClientState?: Record<string, string> } | undefined) => {
      const state = dehydrated?.queryClientState as unknown as DehydratedState | undefined;
      if (state) hydrate(queryClient, state);
    },
  });

  return router;
};
