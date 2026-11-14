import { useEffect, useState } from "react";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { productById, productPreview, productUrl, type TickerProduct } from "@/lib/ticker";
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
      className={`group relative mt-3 block overflow-hidden rounded-2xl bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.15),0_8px_24px_-12px_rgba(0,0,0,0.4)] ring-1 ring-white/20 ${className}`}>
      {!loaded && <span aria-hidden className="ticker-shimmer absolute inset-0 z-10" />}
      {v.kind === "image" ? (
        <img src={v.src} alt={product.label} decoding="async" onLoad={() => setLoaded(true)} className={`block h-auto w-full transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`} />
      ) : (
        <div className="relative aspect-[4/3] w-full">
          <iframe src={v.src} title={product.label} tabIndex={-1} onLoad={() => setLoaded(true)}
            className={`pointer-events-none absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`} />
        </div>
      )}
      <span className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#1c4d82] shadow-sm backdrop-blur transition-transform group-hover:scale-105">
        Gross öffnen <ArrowUpRight className="h-3 w-3" />
      </span>
    </a>
  );
}

function ProductChip({ post }: { post: TickerPost }) {
  const p = productById(post.product);
  if (!p) return null;
  return (
    <>
    <ProductPreview product={p} />
    <a href={productUrl(p)} target="_blank" rel="noopener"
      className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm transition-colors hover:bg-white/15">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-white/60">{p.label}</span>
        {post.product_value && <span className="block truncate font-semibold text-white">{post.product_value}</span>}
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-white/80" />
    </a>
    </>
  );
}

function Thumb({ post }: { post: TickerPost }) {
  const p = productById(post.product);
  const v = p ? productPreview(p) : null;
  const src = post.image ?? (v?.kind === "image" ? v.src : null);
  if (src) return <img src={src} alt="" decoding="async" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/25" />;
  if (p) return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-[9px] font-semibold uppercase leading-tight text-white/80 text-center">Karte</span>;
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
  // Neueste Meldung sofort, übrige beim ersten Berühren im Hintergrund vorladen.
  const [warm, setWarm] = useState(latest);
  const now = useNow();
  const rel = ago(post.created_at, now);
  return (
    <li className="relative pl-6">
      {!last && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-white/20" />}
      <span className={`absolute left-0 top-[6px] h-[11px] w-[11px] rounded-full ${latest ? "bg-white ring-4 ring-white/25" : "bg-white/40"}`} />
      <div className="pb-3">
        <button type="button" onPointerEnter={() => setWarm(true)} onPointerDown={() => setWarm(true)} onFocus={() => setWarm(true)} onClick={() => { setWarm(true); setOpen((o) => !o); }} aria-expanded={open}
          className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tabular-nums text-white/60">
              <span className={latest ? "text-white" : ""}>{rel ?? time(post.created_at)}</span>{" · "}{rel ? time(post.created_at) : day(post.created_at)}
            </span>
            <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-white">{splitPost(post.body).title}</span>
          </span>
          {!open && <Thumb post={post} />}
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-white/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        <div className="grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
          <div className="overflow-hidden" aria-hidden={!open}>
            {(open || warm) && (
              <>
                {splitPost(post.body).rest && <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-white/85">{splitPost(post.body).rest}</p>}
                {post.image && <img src={post.image} alt="" decoding="async" className="mt-2 max-h-72 w-full rounded-xl object-cover" />}
                <ProductChip post={post} />
                {post.link && <a href={post.link} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#1c4d82]">Link öffnen <ArrowUpRight className="h-3.5 w-3.5" /></a>}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
function Header() {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="font-display text-[15px] font-semibold tracking-tight text-white">Wetter-Ticker</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-400" /></span>
        Live
      </span>
    </div>
  );
}

const shell =
  "rounded-3xl bg-[#2561a1] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.12),0_12px_32px_-16px_rgba(10,40,80,0.55)] ring-1 ring-[#1c4d82]";

export function TickerWidget({ posts }: { posts: TickerPost[] }) {
  return (
    <section className={shell}>
      <Header />
      <ol>{posts.map((p, i) => <Entry key={p.id} post={p} latest={i === 0} last={i === posts.length - 1} />)}</ol>
    </section>
  );
}

export function TickerBanner({ posts }: { posts: TickerPost[] }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = posts;
  return (
    <section className={`${shell} px-4 pt-3`}>
      <Header />
      <ol><Entry post={first} latest last={!open || !rest.length} /></ol>
      {rest.length > 0 && (
        <>
          <div className="grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              <ol>{rest.map((p, i) => <Entry key={p.id} post={p} latest={false} last={i === rest.length - 1} />)}</ol>
            </div>
          </div>
          <button onClick={() => setOpen((o) => !o)}
            className="-mx-4 flex w-[calc(100%+2rem)] items-center justify-center gap-1 border-t border-white/20 py-2 text-xs font-medium text-white/80 transition-colors hover:text-white">
            {open ? "Schliessen" : `${rest.length} frühere Meldung${rest.length > 1 ? "en" : ""}`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        </>
      )}
      {!rest.length && <div className="pb-1" />}
    </section>
  );
}
