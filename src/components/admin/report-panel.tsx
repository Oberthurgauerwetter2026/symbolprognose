import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Send, Check, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WeatherReportArticle } from '@/components/weather-report-view';
import { getWeatherReport, publishWeatherReport } from '@/lib/weather-report.functions';
import { WEEKDAYS, nextWeekday, reportDraftSchema, reportSchema, reportTime, type ReportDay, type ReportInput } from '@/lib/weather-report';

const EMPTY: ReportInput = { title: '', situation: '', forecast_title: '', forecast: '', outlook_title: '', days: [], trend: '' };
const label = 'mb-2 block text-sm font-semibold';
const hint = 'mt-1 text-xs text-muted-foreground';
export default function ReportPanel({ password }: { password: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<ReportInput>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [publishedAt, setPublishedAt] = useState('');
  const read = useServerFn(getWeatherReport);
  const publish = useServerFn(publishWeatherReport);
  const qc = useQueryClient();

  // An unsaved text draft is not a credential; keep it on this device only.
  useEffect(() => {
    read().then(result => {
      if (result.report) { const { published_at, ...fields } = result.report; setForm(fields); setPublishedAt(published_at); }
      try {
        const saved = reportDraftSchema.safeParse(JSON.parse(localStorage.getItem('owt-report-draft') ?? 'null'));
        if (saved.success) setForm(previous => ({ ...previous, ...Object.fromEntries(Object.entries(saved.data).filter(([, value]) => value !== undefined)) }));
      } catch { /* no local draft */ }
    });
  }, [read]);

  function update(patch: Partial<ReportInput>) {
    setSuccess('');
    setForm(previous => {
      const next = { ...previous, ...patch };
      try { localStorage.setItem('owt-report-draft', JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
  }

  function updateDay(index: number, patch: Partial<ReportDay>) {
    update({ days: form.days.map((day, i) => i === index ? { ...day, ...patch } : day) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const parsed = reportSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Bitte alle Felder ausfüllen.'); setBusy(false); return; }
    try {
      const saved = await publish({ data: { ...parsed.data, password } });
      const { published_at, ...fields } = saved;
      setForm(fields); setPublishedAt(published_at);
      localStorage.removeItem('owt-report-draft');
      await qc.invalidateQueries({ queryKey: ['weather-report'] });
      setSuccess('Veröffentlicht. Der Wetterbericht ist jetzt auf der Startseite sichtbar.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Veröffentlichung fehlgeschlagen. Dein Text bleibt erhalten.'); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 sm:px-8">
    <nav className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">Wetterbericht</h2>
      <Button variant="outline" onClick={() => setPreview(v => !v)}>{preview ? <Pencil /> : <Eye />}{preview ? 'Bearbeiten' : 'Vorschau'}</Button>
    </nav>
    {publishedAt && <p className="mb-5 text-xs text-muted-foreground">Zuletzt veröffentlicht: {reportTime(publishedAt)}</p>}
    {preview ? <WeatherReportArticle report={{ ...form, published_at: publishedAt || new Date().toISOString() }} unavailable={false} /> : <form id="report-form" onSubmit={submit} className="space-y-8">
      <div><label htmlFor="report-title" className={label}>Titel</label><Input id="report-title" value={form.title} maxLength={160} required onChange={e => update({ title: e.target.value })} className="h-12 text-base" /><p className={hint}>Erscheint gross auf der Startseite, mit deinem Foto und Namen.</p></div>

      <div><label htmlFor="report-situation" className={label}>Allgemeine Lage</label><Textarea id="report-situation" rows={5} value={form.situation} maxLength={6000} onChange={e => update({ situation: e.target.value })} className="text-base leading-6" /><p className={hint}>Die Druckkarte von Europa erscheint automatisch unter diesem Text.</p></div>

      <fieldset className="space-y-3"><legend className="text-base font-semibold">Prognose</legend>
        <div><label htmlFor="report-forecast-title" className={label}>Überschrift</label><Input id="report-forecast-title" value={form.forecast_title} maxLength={120} placeholder="Prognose bis Samstagabend" onChange={e => update({ forecast_title: e.target.value })} className="h-11 text-base" /></div>
        <div><label htmlFor="report-forecast" className={label}>Text</label><Textarea id="report-forecast" rows={7} value={form.forecast} required maxLength={8000} onChange={e => update({ forecast: e.target.value })} className="text-base leading-6" /><p className={hint}>Leerzeile = neuer Absatz. **Samstag** erscheint fett.</p></div>
      </fieldset>

      <fieldset className="space-y-3"><legend className="text-base font-semibold">Aussichten</legend>
        <div><label htmlFor="report-outlook-title" className={label}>Überschrift</label><Input id="report-outlook-title" value={form.outlook_title} maxLength={120} placeholder="Aussichten bis Mittwoch" onChange={e => update({ outlook_title: e.target.value })} className="h-11 text-base" /></div>
        <datalist id="report-weekdays">{WEEKDAYS.map(day => <option key={day} value={day} />)}</datalist>
        {form.days.map((day, i) => <div key={i} className="rounded-lg border border-border p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <div><label htmlFor={`report-day-${i}`} className={label}>Tag {i + 1}</label><Input id={`report-day-${i}`} list="report-weekdays" value={day.label} maxLength={60} placeholder="Wochentag wählen oder selber schreiben" onChange={e => updateDay(i, { label: e.target.value })} className="h-11 text-base" /></div>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label={`Tag ${i + 1} entfernen`} title="Tag entfernen" onClick={() => update({ days: form.days.filter((_, j) => j !== i) })}><Trash2 /></Button>
          </div>
          <label htmlFor={`report-day-text-${i}`} className="sr-only">Text für Tag {i + 1}</label>
          <Textarea id={`report-day-text-${i}`} rows={5} value={day.text} maxLength={4000} placeholder="Wetter, Tiefst- und Höchstwerte, Wind" onChange={e => updateDay(i, { text: e.target.value })} className="mt-2 text-base leading-6" />
        </div>)}
        {form.days.length < 10 && <Button type="button" variant="outline" onClick={() => update({ days: [...form.days, { label: nextWeekday(form.days, new Date()), text: '' }] })}><Plus />Tag hinzufügen</Button>}
      </fieldset>

      <div><label htmlFor="report-trend" className={label}>Trend für die Folgetage</label><Textarea id="report-trend" rows={3} value={form.trend} maxLength={4000} onChange={e => update({ trend: e.target.value })} className="text-base leading-6" /></div>
    </form>}
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    {success && <div role="status" className="mt-5 flex items-start gap-2 text-sm text-accent"><Check className="size-5 shrink-0" /><div>{success}<Button asChild variant="link" className="mt-2 block px-0"><Link to="/wetterbericht">Wetterbericht ansehen</Link></Button></div></div>}
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
      <div className="mx-auto max-w-3xl"><Button form="report-form" type="submit" disabled={busy || preview} className="h-12 w-full bg-accent text-accent-foreground"><Send />{busy ? 'Veröffentlichen …' : publishedAt ? 'Aktualisieren und veröffentlichen' : 'Jetzt veröffentlichen'}</Button></div>
    </footer>
  </div>;
}