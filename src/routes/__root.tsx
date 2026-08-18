import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { installClientErrorReporter } from "@/lib/client-error-reporter";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Oberthurgauer Wetter · Warnungen, Prognosen, Radar & Satellit" },
      { name: "description", content: "Wetterboard für den Oberthurgau: Wetterwarnungen, Regions- und Lokalprognose, Wind, Radar und Satellitenbilder." },
      { name: "author", content: "Oberthurgauer Wetter" },
      { name: "theme-color", content: "#2561a1" },
      { property: "og:title", content: "Oberthurgauer Wetter · Warnungen, Prognosen, Radar & Satellit" },
      { property: "og:description", content: "Wetterboard für den Oberthurgau: Warnkarte, Regions- und Lokalprognose, Wind, Radar und Satellit." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oberthurgauer-wetter.lovable.app/" },
      { property: "og:site_name", content: "Oberthurgauer Wetter" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@OberthurgauWetter" },
      { name: "twitter:title", content: "Oberthurgauer Wetter · Warnungen, Prognosen, Radar & Satellit" },
      { name: "twitter:description", content: "Wetterboard für den Oberthurgau: Warnkarte, Regions- und Lokalprognose, Wind, Radar und Satellit." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/22b507aa-a55b-49bc-b5f4-03d0a137199c/id-preview-97a24c55--190ceb62-232f-4af4-9fcc-a0a628f223d4.lovable.app-1779228758195.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/22b507aa-a55b-49bc-b5f4-03d0a137199c/id-preview-97a24c55--190ceb62-232f-4af4-9fcc-a0a628f223d4.lovable.app-1779228758195.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/icon-192.png",
      },
      // Manifest wird pro Route gesetzt (src/lib/pwa-links.ts),
      // damit /warnkarte ein eigenes Manifest ausliefert.

    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isEmbed = pathname.startsWith("/embed");
  return (
    <html lang="en" className={isEmbed ? "embed" : undefined}>

      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{localStorage.removeItem('wx-rq-cache-v1');sessionStorage.removeItem('wx-rq-cache-v1')}catch(e){}",
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}



function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Clear any old persisted query cache from previous PersistQueryClient setup
  // that could trigger AwaitInner/React.use() hook errors on hydration.
  useEffect(() => {
    try {
      window.localStorage.removeItem("wx-rq-cache-v1");
    } catch {
      // ignore
    }
  }, []);

  // Unbehandelte Fehler protokollieren, damit Abstürze nachvollziehbar sind.
  useEffect(() => installClientErrorReporter(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary label="Die Seite" height={320}>
        <Outlet />
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}



