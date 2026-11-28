import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Send, Check, Copy, Eye, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WeatherReportArticle } from '@/components/weather-report-view';
import { discardWeatherReportDraft, getWeatherReport, getWeatherReportDraft, publishWeatherReport, saveWeatherReportDraft } from '@/lib/weather-report.functions';
import { WEEKDAYS, copyFirstDayToForecast, copyFollowingDayText, nextWeekday, reportDraftSchema, reportSchema, reportTime, type ReportDay, type ReportInput } from '@/lib/weather-report';

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
  const readDraft = useServerFn(getWeatherReportDraft);
  const saveDraft = useServerFn(saveWeatherReportDraft);
  const discardDraft = useServerFn(discardWeatherReportDraft);
  const [draftAt, setDraftAt] = useState('');
  const qc = useQueryClient();

  // An unsaved text draft is not a credential; keep it on this device only.
  // Reihenfolge: veröffentlichter Stand, darüber der gespeicherte Entwurf, darüber nur neuere, noch ungesicherte Eingaben dieses Geräts.
  async function load() {
    const [result, stored] = await Promise.all([read(), readDraft({ data: { password } }).catch(() => ({ draft: null, saved_at: null }))]);
    let next = EMPTY; let published = '';
    if (result.report) { const { published_at, ...fields } = result.report; next = fields; published = published_at; }
    if (stored.draft) next = stored.draft;
    try {
      const localAt = localStorage.getItem('owt-report-draft-at');
      const newest = [published, stored.saved_at ?? ''].sort().at(-1) ?? '';
      const saved = reportDraftSchema.safeParse(JSON.parse(localStorage.getItem('owt-report-draft') ?? 'null'));
      if (saved.success && (!localAt || localAt > newest)) next = { ...next, ...Object.fromEntries(Object.entries(saved.data).filter(([, value]) => value !== undefined)) };
    } catch { /* no local draft */ }
    setForm(next); setPublishedAt(published); setDraftAt(stored.saved_at ?? '');
  }
  useEffect(() => { void load(); }, [password]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearLocal() {
    try { localStorage.removeItem('owt-report-draft'); localStorage.removeItem('owt-report-draft-at'); } catch { /* storage unavailable */ }
  }

  async function storeDraft() {
    setBusy(true); setError(''); setSuccess('');
    try {
      const { saved_at } = await saveDraft({ data: { ...form, password } });
      setDraftAt(saved_at); clearLocal();
      setSuccess('Entwurf gespeichert. Er ist noch nicht veröffentlicht.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Der Entwurf konnte nicht gespeichert werden. Dein Text bleibt erhalten.'); }
    finally { setBusy(false); }
  }

  async function dropDraft() {
    if (!window.confirm('Entwurf verwerfen und zum veröffentlichten Stand zurückkehren?')) return;
    setBusy(true); setError(''); setSuccess('');
    try { await discardDraft({ data: { password } }); clearLocal(); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Der Entwurf konnte nicht verworfen werden.'); }
    finally { setBusy(false); }
  }

  function update(patch: Partial<ReportInput>) {
    setSuccess('');
    setForm(previous => {
      const next = { ...previous, ...patch };
      try { localStorage.setItem('owt-report-draft', JSON.stringify(next)); localStorage.setItem('owt-report-draft-at', new Date().toISOString()); } catch { /* storage full */ }
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
      clearLocal(); setDraftAt('');
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
    <div className="mb-5 space-y-1 text-xs text-muted-foreground">
      {publishedAt && <p>Zuletzt veröffentlicht: {reportTime(publishedAt)}</p>}
      {draftAt && <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-semibold text-foreground">Entwurf gespeichert: {reportTime(draftAt)} – noch nicht veröffentlicht</span><button type="button" disabled={busy} onClick={dropDraft} className="underline underline-offset-2">Entwurf verwerfen</button></p>}
    </div>
    {preview ? <WeatherReportArticle report={{ ...form, published_at: publishedAt || new Date().toISOString() }} unavailable={false} /> : <form id="report-form" onSubmit={submit} className="space-y-8">
      <div><label htmlFor="report-title" className={label}>Titel</label><Input id="report-title" value={form.title} maxLength={160} required onChange={e => update({ title: e.target.value })} className="h-12 text-base" /><p className={hint}>Erscheint gross auf der Startseite, mit deinem Foto und Namen.</p></div>

      <div><label htmlFor="report-situation" className={label}>Allgemeine Lage</label><Textarea id="report-situation" rows={5} value={form.situation} maxLength={6000} onChange={e => update({ situation: e.target.value })} className="text-base leading-6" /><p className={hint}>Die Druckkarte von Europa erscheint automatisch unter diesem Text.</p></div>

      <fieldset className="space-y-3"><legend className="text-base font-semibold">Prognose</legend>
        <div><label htmlFor="report-forecast-title" className={label}>Überschrift</label><Input id="report-forecast-title" value={form.forecast_title} maxLength={120} placeholder="Prognose bis Samstagabend" onChange={e => update({ forecast_title: e.target.value })} className="h-11 text-base" /></div>
        <div>
          <label htmlFor="report-forecast" className={label}>Text</label>
          <Textarea id="report-forecast" rows={7} value={form.forecast} required maxLength={8000} onChange={e => update({ forecast: e.target.value })} className="text-base leading-6" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            disabled={!form.days[0]}
            aria-label="Heute: Folgetag übernehmen"
            title={form.days[0] ? 'Text des ersten Aussichtstags als heutige Prognose übernehmen.' : 'Zuerst einen Aussichtstag hinzufügen.'}
            onClick={() => update({ forecast: copyFirstDayToForecast(form.days, form.forecast) })}
          ><Copy />Folgetag übernehmen</Button>
          <p className={hint}>Leerzeile = neuer Absatz. **Samstag** erscheint fett.</p>
        </div>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            disabled={!form.days[i + 1]}
            aria-label={`Tag ${i + 1}: Folgetag übernehmen`}
            title={form.days[i + 1] ? 'Text des Folgetags übernehmen; der Wochentag bleibt erhalten.' : 'Beim letzten Tag gibt es keinen Folgetag.'}
            onClick={() => update({ days: copyFollowingDayText(form.days, i) })}
          ><Copy />Folgetag übernehmen</Button>
        </div>)}
        {form.days.length < 10 && <Button type="button" variant="outline" onClick={() => update({ days: [...form.days, { label: nextWeekday(form.days, new Date()), text: '' }] })}><Plus />Tag hinzufügen</Button>}
      </fieldset>

      <div><label htmlFor="report-trend" className={label}>Trend für die Folgetage</label><Textarea id="report-trend" rows={3} value={form.trend} maxLength={4000} onChange={e => update({ trend: e.target.value })} className="text-base leading-6" /></div>
    </form>}
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    {success && <div role="status" className="mt-5 flex items-start gap-2 text-sm text-accent"><Check className="size-5 shrink-0" /><div>{success}{success.startsWith('Veröffentlicht') && <Button asChild variant="link" className="mt-2 block px-0"><Link to="/wetterbericht">Wetterbericht ansehen</Link></Button>}</div></div>}
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
        <Button type="button" variant="outline" disabled={busy} onClick={storeDraft} className="h-12 w-full"><Save />Entwurf speichern</Button>
        <Button form="report-form" type="submit" disabled={busy || preview} className="h-12 w-full bg-accent text-accent-foreground"><Send />Veröffentlichen</Button>
      </div>
    </footer>
  </div>;
}