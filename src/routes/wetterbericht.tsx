import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { WeatherReportView } from '@/components/weather-report-view';
import { Button } from '@/components/ui/button';
import { weatherReportQuery } from '@/lib/weather-report.functions';

export const Route = createFileRoute('/wetterbericht')({
  loader: ({ context }) => context.queryClient.ensureQueryData(weatherReportQuery()),
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.report?.title ?? 'Wetterbericht'} · Oberthurgauer Wetter` },
    { name: 'description', content: loaderData?.report?.summary ?? 'Der aktuelle Wetterbericht für den Oberthurgau und Bodensee.' },
    { property: 'og:title', content: `${loaderData?.report?.title ?? 'Wetterbericht'} · Oberthurgauer Wetter` },
    { property: 'og:description', content: loaderData?.report?.summary ?? 'Der aktuelle Wetterbericht für den Oberthurgau und Bodensee.' },
    { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ReportPage,
});
function ReportPage() {
  const { data } = useSuspenseQuery(weatherReportQuery());
  return <DashboardLayout title="Wetterbericht" subtitle="Oberthurgauer Wetter">
    <article className="mx-auto max-w-3xl px-5 py-5 sm:px-8 sm:py-8">
      <Button asChild variant="link" className="px-0 text-accent"><Link to="/"><ArrowLeft />Wetterübersicht</Link></Button>
      <WeatherReportView {...data} detail />
      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">Redaktion: Oberthurgauer Wetter</p>
    </article>
  </DashboardLayout>;
}