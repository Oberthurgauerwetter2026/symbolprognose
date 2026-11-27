import { createFileRoute, Link, type ErrorComponentProps } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard-layout';
import { TickerList } from '@/components/ticker/ticker-view';
import { visiblePosts } from '@/lib/ticker';
import { tickerQuery } from '@/lib/ticker-query';
import { APP_MANIFEST_LINK } from '@/lib/pwa-links';

export const Route = createFileRoute('/ticker')({
  loader: ({ context }) => context.queryClient.fetchQuery(tickerQuery()),
  head: () => ({ meta: [
    { title: 'Wetter-Ticker · Oberthurgauer Wetter' },
    { name: 'description', content: 'Aktuelle Kurzmeldungen, Fotos und Messwerte zum Wetter im Oberthurgau.' },
    { property: 'og:title', content: 'Wetter-Ticker · Oberthurgauer Wetter' },
    { property: 'og:description', content: 'Aktuelle Kurzmeldungen, Fotos und Messwerte zum Wetter im Oberthurgau.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ], links: [APP_MANIFEST_LINK] }),
  component: TickerPage,
  errorComponent: TickerError,
  notFoundComponent: TickerMissing,
});

function TickerPage() {
  // Loader-Daten als Startwert: der Zwischenspeicher reist nicht mit in den Browser.
  const { data } = useQuery({ ...tickerQuery(), initialData: Route.useLoaderData() });
  return <DashboardLayout title="Wetter-Ticker">
    <div className="ticker-night mx-auto w-full max-w-3xl px-4 py-6"><TickerList posts={visiblePosts(data, Date.now())} /></div>
  </DashboardLayout>;
}

function TickerError({ error }: ErrorComponentProps) {
  console.error(error);
  return <DashboardLayout title="Wetter-Ticker"><p className="mx-auto max-w-3xl px-4 py-6 text-sm">Der Ticker ist momentan nicht erreichbar. Bitte später nochmals versuchen.</p></DashboardLayout>;
}

function TickerMissing() {
  return <DashboardLayout title="Wetter-Ticker"><p className="mx-auto max-w-3xl px-4 py-6 text-sm">Diese Seite gibt es nicht. <Link to="/" className="underline">Zur Wetterübersicht</Link></p></DashboardLayout>;
}
