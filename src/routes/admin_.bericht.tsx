import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Send, LogOut, Check, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WeatherReportView } from '@/components/weather-report-view';
import { MchPictogram } from '@/components/weather-icons/mch-pictogram';
import { checkAdminLogin } from '@/lib/warnings.functions';
import { getWeatherReport, publishWeatherReport } from '@/lib/weather-report.functions';
import { REPORT_SYMBOLS, reportSchema, reportTime, type ReportInput } from '@/lib/weather-report';

export const Route = createFileRoute('/admin_/bericht')({
  head: () => ({ meta: [
    { title: 'Wetterbericht verfassen · Oberthurgauer Wetter' },
    { name: 'description', content: 'Wetterbericht für Oberthurgauer Wetter unterwegs verfassen und veröffentlichen.' },
    { property: 'og:title', content: 'Wetterbericht verfassen · Oberthurgauer Wetter' },
    { property: 'og:description', content: 'Geschützte Wetterredaktion von Oberthurgauer Wetter.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
  ] }),
  component: ReportAdmin,
});

const EMPTY: ReportInput = { title: '', symbol: 2, summary: '', body: '' };
function ReportAdmin() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<ReportInput>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [publishedAt, setPublishedAt] = useState('');
  const login = useServerFn(checkAdminLogin);
  const read = useServerFn(getWeatherReport);
  const publish = useServerFn(publishWeatherReport);
  const qc = useQueryClient();

  // An unsaved text draft is not a credential; keep it on this device only.
  useEffect(() => {
    read().then(result => {
      if (result.report) { setForm(result.report); setPublishedAt(result.report.published_at); }
      try {
        const saved = reportSchema.partial().safeParse(JSON.parse(localStorage.getItem('owt-report-draft') ?? 'null'));
        if (saved.success && saved.data) setForm(previous => ({ ...previous, ...saved.data }));
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

  async function unlock(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if ((await login({ data: { password } })).ok) setUnlocked(true);
      else setError('Falsches Passwort.');
    } catch { setError('Anmeldung momentan nicht möglich. Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const parsed = reportSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Bitte alle Felder ausfüllen.'); setBusy(false); return; }
    try {
      const saved = await publish({ data: { ...parsed.data, password } });
      setForm(saved); setPublishedAt(saved.published_at);
      localStorage.removeItem('owt-report-draft');
      await qc.invalidateQueries({ queryKey: ['weather-report'] });
      setSuccess('Veröffentlicht. Der Wetterbericht ist jetzt auf der Startseite sichtbar.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Veröffentlichung fehlgeschlagen. Dein Text bleibt erhalten.'); }
    finally { setBusy(false); }
  }

  if (!unlocked) return <main className="grid min-h-svh place-items-center px-5 py-10">
    <form onSubmit={unlock} className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6">
      <Pencil className="size-8 text-accent" /><h1 className="text-2xl font-semibold">Wetterredaktion</h1>
      <label className="block text-sm font-medium" htmlFor="admin-password">Admin-Passwort</label>
      <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 text-base" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="h-12 w-full bg-accent text-accent-foreground">{busy ? 'Anmelden …' : 'Anmelden'}</Button>
      <div className="flex flex-wrap gap-3"><Button variant="link" asChild className="px-0"><Link to="/"><ArrowLeft />Zur Wetterübersicht</Link></Button><Button variant="link" asChild className="px-0"><Link to="/admin/anordnung">Kacheln anordnen</Link></Button></div>
    </form>
  </main>;

  return <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 sm:px-8">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-5">
      <div className="min-w-0"><p className="text-xs font-semibold text-accent">Oberthurgauer Wetter</p><h1 className="mt-1 text-2xl font-semibold">Wetterbericht</h1></div>
      <Button variant="ghost" size="icon" title="Abmelden" aria-label="Abmelden" onClick={() => { setUnlocked(false); setPassword(''); }}><LogOut /></Button>
    </header>
    <nav className="my-4 flex flex-wrap items-center justify-between gap-2">
      <Button asChild variant="link" className="px-0"><Link to="/admin-ticker"><ArrowLeft />Ticker-Admin</Link></Button>
      <Button asChild variant="link" className="px-0"><Link to="/admin/anordnung">Kacheln anordnen</Link></Button>
      <Button variant="outline" onClick={() => setPreview(v => !v)}>{preview ? <Pencil /> : <Eye />}{preview ? 'Bearbeiten' : 'Vorschau'}</Button>
    </nav>
    {publishedAt && <p className="mb-5 text-xs text-muted-foreground">Zuletzt veröffentlicht: {reportTime(publishedAt)}</p>}
    {preview ? <WeatherReportView report={{ ...form, published_at: publishedAt || new Date().toISOString() }} unavailable={false} detail /> : <form id="report-form" onSubmit={submit} className="space-y-6">
      <div><label htmlFor="report-title" className="mb-2 block text-sm font-semibold">Titel</label><Input id="report-title" value={form.title} maxLength={160} required onChange={e => update({ title: e.target.value })} className="h-12 text-base" /></div>
      <fieldset><legend className="mb-3 text-sm font-semibold">Wettersymbol</legend><div className="grid grid-cols-4 gap-2">{REPORT_SYMBOLS.map(s => <Button key={s.code} type="button" variant="outline" aria-label={s.label} aria-pressed={form.symbol === s.code} title={s.label} onClick={() => update({ symbol: s.code })} className={`h-16 p-1 ${form.symbol === s.code ? 'border-accent bg-accent/10 ring-1 ring-accent' : ''}`}><MchPictogram code={s.code} size={42} /></Button>)}</div></fieldset>
      <div><label htmlFor="report-summary" className="mb-2 block text-sm font-semibold">Kurzfassung für die Startseite</label><Textarea id="report-summary" rows={4} value={form.summary} required maxLength={600} onChange={e => update({ summary: e.target.value })} className="text-base leading-6" /><p className="mt-1 text-right text-xs text-muted-foreground">{form.summary.length}/600</p></div>
      <div><label htmlFor="report-body" className="mb-2 block text-sm font-semibold">Ausführlicher Wetterbericht</label><Textarea id="report-body" rows={12} value={form.body} required maxLength={20000} onChange={e => update({ body: e.target.value })} className="text-base leading-6" /></div>
    </form>}
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    {success && <div role="status" className="mt-5 flex items-start gap-2 text-sm text-accent"><Check className="size-5 shrink-0" /><div>{success}<Button asChild variant="link" className="mt-2 block px-0"><Link to="/wetterbericht">Wetterbericht ansehen</Link></Button></div></div>}
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
      <div className="mx-auto max-w-3xl"><Button form="report-form" type="submit" disabled={busy || preview} className="h-12 w-full bg-accent text-accent-foreground"><Send />{busy ? 'Veröffentlichen …' : publishedAt ? 'Aktualisieren und veröffentlichen' : 'Jetzt veröffentlichen'}</Button></div>
    </footer>
  </main>;
}