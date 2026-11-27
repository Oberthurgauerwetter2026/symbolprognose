import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Download, Eye, EyeOff, GripVertical, LayoutGrid, Monitor, RotateCcw, Save, Smartphone, Upload, X, Thermometer, Wind, ShieldCheck, Radio, Newspaper, Satellite, Snowflake, MapPin, CloudRain, Play, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { defaultLayout, layoutSchema, LAYOUT_STORAGE, moveTile, TILE_NAMES, type LayoutMode, type Tile, type TileId, type TileLayout } from '@/lib/tile-layout';
import radarAsset from '@/assets/overview-radar.asset.json';
import windAsset from '@/assets/overview-wind.asset.json';

export const Route = createFileRoute('/admin_/anordnung')({
  head: () => ({ meta: [
    { title: 'Kacheln anordnen · Oberthurgauer Wetter' },
    { name: 'description', content: 'Persönlicher Gestaltungsentwurf für die Handy- und Desktop-Wetterübersicht.' },
    { property: 'og:title', content: 'Kacheln anordnen · Oberthurgauer Wetter' },
    { property: 'og:description', content: 'Anordnung der Wetterkacheln als separaten Entwurf planen.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: Arrangement,
});

const ICONS = { standort: MapPin, radar: CloudRain, wind: Wind, warnungen: ShieldCheck, messwerte: Thermometer, ticker: Radio, bericht: Pencil, news: Newspaper, satellit: Satellite, summen: Snowflake, region: MapPin, snowcast: Snowflake };

function TileContent({ id }: { id: TileId }) {
  const Icon = ICONS[id];
  if (id === 'radar' || id === 'wind') return <><div className="relative h-28 overflow-hidden"><img className="h-full w-full object-cover" src={id === 'radar' ? radarAsset.url : windAsset.url} alt={id === 'radar' ? 'Radarvorschau' : 'Windkartenvorschau'} /><span className="absolute inset-0 grid place-items-center"><Play className="size-8 rounded-full bg-accent p-2 text-accent-foreground" /></span></div><h3 className="break-words p-3 text-sm font-semibold">{TILE_NAMES[id]}</h3></>;
  return <div className="min-h-36 p-4">
    <Icon className="mb-3 size-6 text-accent" /><h3 className="break-words text-sm font-semibold">{TILE_NAMES[id]}</h3>
    {id === 'standort' && <div className="mt-3 flex flex-wrap items-baseline gap-3"><strong className="text-4xl font-semibold">6.8°</strong><span className="text-xs text-muted-foreground">Amriswil · Beispielmessung</span></div>}
    {id === 'messwerte' && <p className="mt-3 text-xs leading-5 text-muted-foreground">Temperatur · Wind · Regen</p>}
    {id === 'warnungen' && <p className="mt-3 text-xs text-muted-foreground">Keine aktiven Warnungen</p>}
    {id === 'ticker' && <p className="mt-3 text-sm leading-5">Aktuelle Meldungen aus der Region</p>}
    {id === 'bericht' && <p className="mt-3 text-sm leading-5">Wolken und Aufhellungen am Bodensee. In den Bergen fällt zeitweise Schnee.</p>}
    {id === 'news' && <p className="mt-3 text-sm leading-5">Neuigkeiten aus der Wetterregion</p>}
  </div>;
}

function Arrangement() {
  const [layout, setLayout] = useState<TileLayout>(defaultLayout);
  const [mode, setMode] = useState<LayoutMode>('mobile');
  const [view, setView] = useState<'both' | LayoutMode>('both');
  const [selected, setSelected] = useState<TileId>('radar');
  const [dragged, setDragged] = useState<TileId | null>(null);
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const value = localStorage.getItem(LAYOUT_STORAGE);
      if (!value) return;
      const result = layoutSchema.safeParse(JSON.parse(value));
      if (result.success) { setLayout(result.data); setStatus('Gespeicherter Entwurf geladen.'); }
    } catch { setStatus('Gespeicherter Entwurf konnte nicht geladen werden.'); }
  }, []);
  const tiles = layout[mode];
  const current = tiles.find(t => t.id === selected);
  const position = tiles.findIndex(t => t.id === selected);
  function update(next: Tile[]) { setLayout(old => ({ ...old, [mode]: next })); setDirty(true); setStatus(''); }
  function patch(p: Partial<Pick<Tile, 'width' | 'visible'>>) { update(tiles.map(t => t.id === selected ? { ...t, ...p } : t)); }
  function move(delta: number) { const target = tiles[position + delta]; if (target) update(moveTile(tiles, selected, target.id)); }
  function save() {
    try { localStorage.setItem(LAYOUT_STORAGE, JSON.stringify(layoutSchema.parse(layout))); setDirty(false); setStatus('Entwurf auf diesem Gerät gespeichert.'); }
    catch { setStatus('Speichern nicht möglich. Bitte den Entwurf herunterladen.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'oberthurgauer-wetter-kacheln.json'; a.click(); URL.revokeObjectURL(url);
    setStatus('Entwurf heruntergeladen.');
  }
  async function load(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 50000) throw new Error('Die Datei ist zu gross.');
      const result = layoutSchema.safeParse(JSON.parse(await file.text()));
      if (!result.success) throw new Error('Diese Datei ist kein gültiger Kachelentwurf.');
      setLayout(result.data); setDirty(true); setStatus('Entwurf geöffnet.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Datei konnte nicht geöffnet werden.'); }
    e.target.value = '';
  }

  function preview(which: LayoutMode) {
    return <section aria-label={`${which === 'mobile' ? 'Handy' : 'Desktop'}-Vorschau`} className="min-w-0">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">{which === 'mobile' ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}{which === 'mobile' ? 'Handy' : 'Desktop'}<span className="ml-auto text-xs text-muted-foreground">Beispielinhalte</span></div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <div className={`weather-blue bg-background p-4 ${which === 'mobile' ? 'mx-auto w-full max-w-[390px]' : 'min-w-[680px]'}`}>
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3"><div><p className="text-xs">Oberthurgau · Bodensee · Alpstein</p><h2 className="mt-1 text-xl font-semibold">Oberthurgauer Wetter</h2></div></div>
          <div className={`grid gap-3 ${which === 'mobile' ? 'grid-cols-2' : 'grid-cols-4'}`}>
            {layout[which].filter(t => t.visible).map(t => <Button asChild key={t.id} variant="ghost" className={`weather-surface relative block h-auto min-w-0 overflow-hidden whitespace-normal rounded-lg border bg-card p-0 text-left hover:bg-card hover:text-foreground ${t.width === 'full' ? 'col-span-full' : t.width === 'half' && which === 'desktop' ? 'col-span-2' : 'col-span-1'} ${selected === t.id && mode === which ? 'border-accent ring-2 ring-accent' : 'border-border'}`}>
              <button type="button" aria-label={`${TILE_NAMES[t.id]} auswählen (${which === 'mobile' ? 'Handy' : 'Desktop'})`} aria-pressed={selected === t.id && mode === which} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); setDragged(t.id); setMode(which); }} onDragEnd={() => setDragged(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged) { setLayout(old => ({ ...old, [which]: moveTile(old[which], dragged, t.id) })); setDirty(true); setStatus(''); } setDragged(null); }} onClick={() => { setSelected(t.id); setMode(which); }}><TileContent id={t.id} /></button>
            </Button>)}
          </div>
          {!layout[which].some(t => t.visible) && <p className="py-12 text-center text-sm">Keine Kacheln ausgewählt.</p>}
          <p className="mt-5 text-xs text-muted-foreground">Oberthurgauer Wetter</p>
        </div>
      </div>
    </section>;
  }

  return <main className="min-h-svh bg-background text-foreground">
    <header className="border-b border-border bg-card px-4 py-4 sm:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold text-accent">Oberthurgauer Wetter · Gestaltung</p><h1 className="mt-1 text-2xl font-semibold">Kacheln anordnen</h1></div><div className="flex items-center gap-2"><Button onClick={save} className="bg-accent text-accent-foreground"><Save />Entwurf speichern</Button><Button asChild variant="ghost" size="icon" title="Schliessen" aria-label="Schliessen"><Link to="/"><X /></Link></Button></div></div>
    </header>
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Privater Gestaltungsentwurf · Startseite und bisherige Iframes bleiben unverändert.</p><span className="text-xs font-medium text-accent">{dirty ? 'Ungespeicherte Änderungen' : 'Entwurf'}</span></div>
      <div className="grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Anordnung bearbeiten" className="min-w-0 space-y-6 lg:sticky lg:top-5">
          <div className="flex gap-1 rounded-md bg-muted p-1" role="group" aria-label="Anordnung für Gerät">{(['mobile', 'desktop'] as const).map(m => <Button key={m} variant={mode === m ? 'outline' : 'ghost'} className="flex-1" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'mobile' ? <Smartphone /> : <Monitor />}{m === 'mobile' ? 'Handy' : 'Desktop'}</Button>)}</div>
          <div><h2 className="mb-3 text-sm font-semibold">Kacheln</h2><div className="divide-y divide-border border-y border-border">{tiles.map((t, index) => <div key={t.id} className="flex items-center gap-1 py-1"><Button variant="ghost" className={`min-w-0 flex-1 justify-start px-2 ${selected === t.id ? 'bg-accent/10 text-accent' : ''}`} onClick={() => setSelected(t.id)} aria-pressed={selected === t.id}><span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span><span className="truncate">{TILE_NAMES[t.id]}</span></Button><Button size="icon" variant="ghost" aria-label={`${TILE_NAMES[t.id]} ${t.visible ? 'ausblenden' : 'einblenden'}`} title={t.visible ? 'Ausblenden' : 'Einblenden'} onClick={() => update(tiles.map(item => item.id === t.id ? { ...item, visible: !item.visible } : item))}>{t.visible ? <Eye /> : <EyeOff />}</Button></div>)}</div></div>
          {current && <section aria-label="Ausgewählte Kachel" className="space-y-4"><h2 className="flex items-center gap-2 font-semibold"><GripVertical className="size-4 text-muted-foreground" />{TILE_NAMES[selected]}</h2><div className="flex gap-2"><Button variant="outline" className="flex-1" disabled={position === 0} onClick={() => move(-1)} aria-label="Kachel nach vorne verschieben"><ArrowUp />Nach vorne</Button><Button variant="outline" className="flex-1" disabled={position === tiles.length - 1} onClick={() => move(1)} aria-label="Kachel nach hinten verschieben"><ArrowDown />Nach hinten</Button></div><label className="block text-sm font-medium" htmlFor="tile-width">Breite</label><select id="tile-width" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={current.width} onChange={e => { const width = e.target.value; if (width === 'small' || width === 'half' || width === 'full') patch({ width }); }}><option value="small">{mode === 'mobile' ? 'Halbe Breite' : 'Viertelbreite'}</option>{mode === 'desktop' && <option value="half">Halbe Breite</option>}{mode === 'mobile' && current.width === 'half' && <option value="half">Halbe Breite</option>}<option value="full">Ganze Breite</option></select></section>}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4"><Button size="icon" variant="outline" onClick={download} title="Entwurf herunterladen" aria-label="Entwurf herunterladen"><Download /></Button><Button size="icon" variant="outline" onClick={() => fileInput.current?.click()} title="Entwurf öffnen" aria-label="Entwurf öffnen"><Upload /></Button><Button size="icon" variant="outline" title="Anordnung zurücksetzen" aria-label="Anordnung zurücksetzen" onClick={() => { if (window.confirm('Beide Anordnungen zurücksetzen?')) { setLayout(defaultLayout()); setDirty(true); setStatus(''); } }}><RotateCcw /></Button><input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={load} /><Button asChild variant="link" className="px-1"><Link to="/admin/bericht">Wetterredaktion</Link></Button></div>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-accent">{status && <><Check className="mr-1 inline size-4" />{status}</>}</p>
        </aside>
        <div className="min-w-0"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Vorschau</h2><div className="flex gap-1" role="group" aria-label="Vorschau wählen">{(['both', 'mobile', 'desktop'] as const).map(v => <Button size="sm" variant={view === v ? 'outline' : 'ghost'} key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'both' ? <LayoutGrid /> : v === 'mobile' ? <Smartphone /> : <Monitor />}{v === 'both' ? 'Beide' : v === 'mobile' ? 'Handy' : 'Desktop'}</Button>)}</div></div><div className={view === 'both' ? 'grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]' : 'min-w-0'}>{view !== 'mobile' && preview('desktop')}{view !== 'desktop' && preview('mobile')}</div></div>
      </div>
    </div>
  </main>;
}