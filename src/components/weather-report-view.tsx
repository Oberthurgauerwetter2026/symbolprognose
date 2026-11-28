import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import authorAsset from '@/assets/bruno-rutishauser.jpg.asset.json';
import { REPORT_AUTHOR, reportTime, reportTimeLong, type WeatherReport } from '@/lib/weather-report';

function Author({ size }: { size: number }) {
  return <span className="flex min-w-0 items-center gap-2.5">
    <img src={authorAsset.url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full border border-border object-cover" style={{ width: size, height: size }} />
    <span className="min-w-0 truncate text-sm font-semibold">{REPORT_AUTHOR}</span>
  </span>;
}

/** Startseiten-Kachel: Titel, Autor und Stand; die ganze Kachel öffnet den Wetterbericht. */
export function WeatherReportTile({ report, unavailable, morph = false, onOpen }: { report: WeatherReport | null; unavailable: boolean; morph?: boolean; onOpen?: () => void }) {
  return <Link to="/wetterbericht" viewTransition {...(onOpen ? { onClick: onOpen } : {})} aria-label="Wetterbericht öffnen"
    className={`weather-dark group block rounded-lg border border-border bg-card px-4 py-5 text-card-foreground shadow-lg transition-colors hover:border-accent sm:px-6 sm:py-6${morph ? ' morph-card' : ''}`}>
    <h2 className="flex items-center justify-between gap-1 font-semibold">Wetterbericht<ArrowUpRight className="size-4 shrink-0 text-accent" /></h2>
    {report ? <>
      <p className="mt-2 break-words font-display text-xl font-semibold leading-snug sm:text-2xl">{report.title}</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Author size={40} />
        <p className="text-right text-xs text-muted-foreground">Aktualisiert<br />{reportTime(report.published_at)}</p>
      </div>
    </> : <p className="mt-2 text-sm text-muted-foreground">{unavailable ? 'Der Wetterbericht ist momentan nicht erreichbar.' : 'Ein neuer Wetterbericht folgt.'}</p>}
  </Link>;
}

/** Absätze durch Leerzeilen, **fett** für Hervorhebungen. */
function Prose({ text }: { text: string }) {
  return <div className="space-y-4">{text.split(/\n\s*\n/).filter(paragraph => paragraph.trim()).map((paragraph, i) =>
    <p key={i} className="whitespace-pre-wrap break-words text-base leading-7">{paragraph.split(/\*\*(.+?)\*\*/g).map((part, j) => j % 2 ? <strong key={j}>{part}</strong> : <Fragment key={j}>{part}</Fragment>)}</p>)}</div>;
}

/** Bodendruckkarte Europa; fehlt sie, bleibt der Abschnitt ohne Karte statt mit einem kaputten Bild. */
function PressureMap() {
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Ein Ladefehler vor dem Start der Seite löst kein Ereignis mehr aus.
  useEffect(() => { const img = ref.current; if (img?.complete && img.naturalWidth === 0) setMissing(true); }, []);
  if (missing) return null;
  return <figure className="mt-5 overflow-hidden rounded-lg border border-border shadow-lg">
    <img ref={ref} src="/api/public/maps/europe-pressure.svg" alt="Bodendruckkarte Europa mit Isobaren, Hoch- und Tiefdruckgebieten" width={1200} height={840} loading="lazy" onError={() => setMissing(true)} className="block h-auto w-full" />
  </figure>;
}

const heading = 'font-display text-xl font-semibold sm:text-2xl';

export function WeatherReportArticle({ report, unavailable }: { report: WeatherReport | null; unavailable: boolean }) {
  if (!report) return <section aria-label="Wetterbericht" className="py-6">
    <h2 className={heading}>Wetterbericht</h2>
    <p className="mt-3 text-sm text-muted-foreground">{unavailable ? 'Der Wetterbericht ist momentan nicht erreichbar.' : 'Ein neuer Wetterbericht folgt.'}</p>
  </section>;
  return <article className="py-6">
    <header className="border-b border-border pb-6">
      <h2 className="break-words font-display text-2xl font-semibold leading-tight sm:text-4xl">{report.title}</h2>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Author size={48} />
        <p className="text-xs text-muted-foreground">Aktualisiert: {reportTimeLong(report.published_at)}</p>
      </div>
    </header>

    <section aria-labelledby="report-situation" className="border-b border-border py-6">
      <h3 id="report-situation" className={heading}>Allgemeine Lage</h3>
      {report.situation && <div className="mt-3"><Prose text={report.situation} /></div>}
      <PressureMap />
    </section>

    <section aria-labelledby="report-forecast" className="py-6">
      <h3 id="report-forecast" className={heading}>{report.forecast_title || 'Prognose'}</h3>
      <div className="mt-3"><Prose text={report.forecast} /></div>
    </section>

    {report.days.length > 0 && <section aria-labelledby="report-outlook" className="border-t border-border py-6">
      <h3 id="report-outlook" className={heading}>{report.outlook_title || 'Aussichten'}</h3>
      <div className="mt-4 space-y-6">{report.days.map((day, i) => <div key={i}>
        <h4 className="text-base font-extrabold">{day.label}</h4>
        <div className="mt-2"><Prose text={day.text} /></div>
      </div>)}</div>
    </section>}

    {report.trend && <section aria-labelledby="report-trend" className="border-t border-border py-6">
      <h3 id="report-trend" className={heading}>Trend für die Folgetage</h3>
      <div className="mt-3"><Prose text={report.trend} /></div>
    </section>}
  </article>;
}
