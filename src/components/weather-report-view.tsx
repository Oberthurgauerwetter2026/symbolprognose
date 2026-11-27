import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { MchPictogram } from '@/components/weather-icons/mch-pictogram';
import { Button } from '@/components/ui/button';
import { reportTime, type WeatherReport } from '@/lib/weather-report';

export function WeatherReportView({ report, unavailable, detail = false }: { report: WeatherReport | null; unavailable: boolean; detail?: boolean }) {
  return <section aria-label="Wetterbericht" className={detail ? 'py-6' : 'weather-dark rounded-lg border border-border bg-card px-4 py-6 sm:px-6 sm:py-8'}>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-accent">Aus der Wetterredaktion</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{detail ? report?.title ?? 'Wetterbericht' : 'Wetterbericht'}</h2>
      </div>
      {report ? <MchPictogram code={report.symbol} size={56} className="shrink-0" /> : <Clock3 className="mt-3 size-6 text-muted-foreground" />}
    </div>
    {report ? <>
      {!detail && <h3 className="mt-3 text-lg font-semibold break-words">{report.title}</h3>}
      <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed text-foreground/85">{report.summary}</p>
      {detail && <div className="mt-6 space-y-5 border-t border-border pt-6">{report.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i} className="whitespace-pre-wrap break-words text-base leading-7">{paragraph}</p>)}</div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Aktualisiert: {reportTime(report.published_at)}</p>
        {!detail && <Button variant="link" asChild className="px-0 text-accent"><Link to="/wetterbericht">Ganzer Wetterbericht<ArrowUpRight /></Link></Button>}
      </div>
    </> : <><p className="mt-3 text-sm text-muted-foreground">{unavailable ? 'Der Wetterbericht ist momentan nicht erreichbar.' : 'Ein neuer Wetterbericht folgt.'}</p>{!detail && <Button variant="link" asChild className="mt-2 px-0 text-accent"><Link to="/wetterbericht">Zum Wetterbericht<ArrowUpRight /></Link></Button>}</>}
  </section>;
}