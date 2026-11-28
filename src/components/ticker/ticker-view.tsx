import { useEffect, useState } from "react";
import { ChevronDown, ArrowUpRight, Info, Camera, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productById, productIds, productPreview, productUrl, widgetSplit, WIDGET_VISIBLE, type TickerProduct } from "@/lib/ticker";
import type { TickerPost } from "@/lib/ticker.functions";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
/** «gerade eben», «vor 12 Min.», «vor 3 Std.» – sonst Uhrzeit. */
function ago(iso: string, now: number) {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  if (m < 6 * 60) return `vor ${Math.floor(m / 60)} Std.`;
  return null;
}
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Zurich" });

/** Live-Bild der Karte direkt in der Meldung – kein Klick nötig. */
export function ProductPreview({ product, className = "" }: { product: TickerProduct; className?: string }) {
  const v = productPreview(product);
  const [loaded, setLoaded] = useState(false);
  if (!v) return null;
  return (
    <a href={productUrl(product)} target="_blank" rel="noopener" aria-label={`${product.label} öffnen`}
      className={`group relative mt-3 block overflow-hidden rounded-2xl bg-ticker-foreground/10 shadow-ticker-preview ring-1 ring-ticker-foreground/20 ${className}`}>
      {!loaded && <span aria-hidden className="ticker-shimmer absolute inset-0 z-10" />}
      {v.kind === "image" ? (
        <img src={v.src} alt={product.label} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} className={`block h-auto w-full transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`} />
      ) : (
        <div className="relative aspect-[4/3] w-full">
          <iframe src={v.src} title={product.label} tabIndex={-1} loading="lazy" onLoad={() => setLoaded(true)}
            className={`pointer-events-none absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`} />
        </div>
      )}
      <span className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1 rounded-full bg-ticker-foreground/90 px-2.5 py-1 text-[11px] font-semibold text-ticker-strong shadow-sm backdrop-blur transition-transform group-hover:scale-105">
        Gross öffnen <ArrowUpRight className="h-3 w-3" />
      </span>
    </a>
  );
}

function ProductChip({ post }: { post: TickerPost }) {
  return <>{productIds(post.product).map((id) => <OneProduct key={id} id={id} post={post} />)}</>;
}

function OneProduct({ id, post }: { id: string; post: TickerPost }) {
  const p = productById(id);
  if (!p) return null;
  return (
    <div className="mt-2">
    <ProductPreview product={p} />
    <a href={productUrl(p)} target="_blank" rel="noopener"
      className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-ticker-foreground/10 px-3 py-2 text-sm transition-colors hover:bg-ticker-foreground/15">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-ticker-foreground/60">{p.label}</span>
        {post.product_value && <span className="block truncate font-semibold text-ticker-foreground">{post.product_value}</span>}
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ticker-foreground/80" />
    </a>
    </div>
  );
}

function Thumb({ post }: { post: TickerPost }) {
  const p = productById(productIds(post.product)[0]);
  const v = p ? productPreview(p) : null;
  if (post.image && post.video) return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ticker-foreground/15 text-ticker-foreground/80" aria-label="Video"><Play className="h-4 w-4 fill-current" /></span>;
  const src = post.image ?? (v?.kind === "image" ? v.src : null);
  if (src) return <img src={src} alt="" decoding="async" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-ticker-foreground/25" />;
  if (p) return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ticker-foreground/15 text-[9px] font-semibold uppercase leading-tight text-ticker-foreground/80 text-center">Karte</span>;
  return null;
}

/** Titel = erste Zeile (sonst erster Satz); der Rest erscheint erst nach dem Antippen. */
export function splitPost(body: string): { title: string; rest: string } {
  const t = body.trim();
  const nl = t.indexOf("\n");
  if (nl > 0) return { title: t.slice(0, nl).trim(), rest: t.slice(nl + 1).trim() };
  const m = t.match(/^(.+?[.!?])\s+(.+)$/s);
  return m ? { title: m[1], rest: m[2].trim() } : { title: t, rest: "" };
}

/** Ein Tipp öffnet die Meldung: voller Text, Bild und Karte. Geschlossen nur eine Zeile. */
function Entry({ post, latest, last }: { post: TickerPost; latest: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  const now = useNow();
  const rel = ago(post.created_at, now);
  return (
    <li className="relative pl-6">
      {!last && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-ticker-foreground/20" />}
      <span className={`absolute left-0 top-[6px] h-[11px] w-[11px] rounded-full ${latest ? "bg-ticker-foreground ring-4 ring-ticker-foreground/25" : "bg-ticker-foreground/40"}`} />
      <div className="pb-3">
        <Button type="button" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="-mx-2 flex h-auto w-[calc(100%+1rem)] items-start justify-start gap-3 whitespace-normal rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-ticker-foreground/10 hover:text-ticker-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticker-foreground/40">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tabular-nums text-ticker-foreground/60">
              <span className={latest ? "text-ticker-foreground" : ""}>{rel ?? time(post.created_at)}</span>{" · "}{rel ? time(post.created_at) : day(post.created_at)}
            </span>
            <span className="mt-0.5 block break-words text-[15px] font-semibold leading-snug text-ticker-foreground">{splitPost(post.body).title}</span>
          </span>
          {!open && <Thumb post={post} />}
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-ticker-foreground/60 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
        </Button>
        <div className={`grid ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden" aria-hidden={!open}>
            {open && (
              <>
                {splitPost(post.body).rest && <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-relaxed text-ticker-foreground/85">{splitPost(post.body).rest}</p>}
                {post.image && post.video && <video src={post.image} controls playsInline preload="metadata" className="mt-2 max-h-96 w-full rounded-xl bg-ticker-foreground/10" />}
                {post.image && !post.video && <img src={post.image} alt="" decoding="async" className="mx-auto mt-2 block max-h-[32rem] w-auto max-w-full rounded-xl" />}
                <ProductChip post={post} />
                {post.link && <a href={post.link} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 rounded-full bg-ticker-foreground px-3 py-1.5 text-sm font-medium text-ticker-strong">Link öffnen <ArrowUpRight className="h-3.5 w-3.5" /></a>}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
function Header({ live = true }: { live?: boolean }) {
  const [info, setInfo] = useState(false);
  return (
    <div className="mb-1">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
          <span className="whitespace-nowrap font-display text-[15px] font-semibold text-ticker-foreground">Wetter-Ticker</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => setInfo((o) => !o)} aria-expanded={info} aria-label="Was ist der Wetter-Ticker?" title="Was ist der Wetter-Ticker?" className="h-5 w-5 rounded-full p-0.5 text-ticker-foreground/70 hover:bg-ticker-foreground/10 hover:text-ticker-foreground">
            <Info className="h-4 w-4" />
          </Button>
          <a href="/foto-einsenden" target="_blank" rel="noopener" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1 py-0.5 text-[11px] font-medium text-ticker-foreground/70 transition-colors hover:text-ticker-foreground">
            <Camera className="h-3.5 w-3.5" /> Foto / Video einsenden
          </a>
        </span>
        {live ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ticker-foreground/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ticker-foreground">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ticker-live opacity-70 motion-reduce:animate-none" /><span className="relative h-1.5 w-1.5 rounded-full bg-ticker-live" /></span>
          Live
        </span>
        ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ticker-foreground/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ticker-foreground/70">
          <span className="h-1.5 w-1.5 rounded-full bg-ticker-foreground/50" />
          Standby
        </span>
        )}
      </div>
      {info && (
          <p className="mb-2 mt-2 rounded-lg bg-ticker-foreground/10 p-3 text-[13px] leading-relaxed text-ticker-foreground/90">
            Der Ticker meldet zeitnah und kompakt, was gerade los ist: mit Messwerten unserer Stationen, Radar- und Modellkarten und kurzen Einschätzungen – aus dem Oberthurgau für das Oberthurgau.{" "}
            <a href="/foto-einsenden" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-ticker-foreground underline underline-offset-2 decoration-ticker-foreground/40">
              <Camera className="h-3.5 w-3.5" /> Auch Ihr Foto oder Video vom Himmel überm Oberthurgau ist willkommen
            </a>
          </p>
      )}
    </div>
  );
}

const shell =
  "rounded-3xl bg-ticker p-4 text-ticker-foreground shadow-ticker ring-1 ring-ticker-strong";

function Standby() {
  return (
    <div>
      <p className="text-[15px] font-semibold leading-snug text-ticker-foreground">Aktuell keine neuen Meldungen.</p>
    </div>
  );
}

export function TickerStandby() {
  return (
    <section className={`${shell} px-3 py-2.5`}>
      <Header live={false} />
      <Standby />
    </section>
  );
}

export function TickerWidget({ posts }: { posts: TickerPost[] }) {
  const [open, setOpen] = useState(false);
  if (!posts.length) return <TickerStandby />;
  const { shown, rest } = widgetSplit(posts);
  const more = open && rest.length > 0;
  return (
    <section className={shell}>
      <Header />
      <ol>{shown.map((p, i) => <Entry key={p.id} post={p} latest={i === 0} last={i === shown.length - 1 && !more} />)}</ol>
      {rest.length > 0 && (
        <>
          <div className={`grid ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <ol>{rest.map((p, i) => <Entry key={p.id} post={p} latest={false} last={i === rest.length - 1} />)}</ol>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="-mx-4 -mb-4 flex h-auto w-[calc(100%+2rem)] items-center justify-center gap-1 rounded-b-3xl border-t border-ticker-foreground/20 py-2 text-xs font-medium text-ticker-foreground/80 transition-colors hover:bg-ticker-foreground/10 hover:text-ticker-foreground">
            {open ? "schliessen" : "weitere …"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </Button>
        </>
      )}
    </section>
  );
}

/** Alle sichtbaren Meldungen untereinander – für die eigene Ticker-Seite. */
export function TickerList({ posts }: { posts: TickerPost[] }) {
  if (!posts.length) return <TickerStandby />;
  return (
    <section className={shell}>
      <Header />
      <ol>{posts.map((p, i) => <Entry key={p.id} post={p} latest={i === 0} last={i === posts.length - 1} />)}</ol>
    </section>
  );
}

/** Gemeinsame Kachel-/Redaktionsvorschau: drei Schlagzeilen mit Uhrzeit und Bild, ohne Bedienelemente. */
export function TickerTilePreview({ posts }: { posts: TickerPost[] }) {
  const shown = posts.slice(0, WIDGET_VISIBLE);
  if (!shown.length) return <p className="text-sm text-ticker-foreground/70">Aktuell keine neuen Meldungen.</p>;
  return (
    <ol className="space-y-2.5">
      {shown.map((p) => (
        <li key={p.id} className="flex items-start gap-3 text-sm text-ticker-foreground">
          <span className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-ticker-foreground/70">{time(p.created_at)}</span>
          <span className="min-w-0 flex-1 line-clamp-2 break-words font-medium leading-snug">{splitPost(p.body).title}</span>
          <Thumb post={p} />
        </li>
      ))}
    </ol>
  );
}

export function TickerBanner({ posts }: { posts: TickerPost[] }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = posts;
  if (!first) return <TickerStandby />;
  return (
    <section className={`${shell} px-4 pt-3`}>
      <Header />
      <ol><Entry post={first} latest last={!open || !rest.length} /></ol>
      {rest.length > 0 && (
        <>
          <div className={`grid ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <ol>{rest.map((p, i) => <Entry key={p.id} post={p} latest={false} last={i === rest.length - 1} />)}</ol>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="-mx-4 flex h-auto w-[calc(100%+2rem)] items-center justify-center gap-1 border-t border-ticker-foreground/20 py-2 text-xs font-medium text-ticker-foreground/80 transition-colors hover:bg-ticker-foreground/10 hover:text-ticker-foreground">
            {open ? "Schliessen" : `${rest.length} frühere Meldung${rest.length > 1 ? "en" : ""}`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </Button>
        </>
      )}
      {!rest.length && <div className="pb-1" />}
    </section>
  );
}
