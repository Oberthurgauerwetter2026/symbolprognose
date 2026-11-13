import { useState } from "react";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { productById, SITE } from "@/lib/ticker";
import type { TickerPost } from "@/lib/ticker.functions";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Zurich" });

function ProductChip({ post }: { post: TickerPost }) {
  const p = productById(post.product);
  if (!p) return null;
  return (
    <a href={SITE + p.path} target="_blank" rel="noopener"
      className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm transition-colors hover:bg-muted">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</span>
        {post.product_value && <span className="block truncate font-semibold text-foreground">{post.product_value}</span>}
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-accent" />
    </a>
  );
}

function Entry({ post, latest, last }: { post: TickerPost; latest: boolean; last: boolean }) {
  return (
    <li className="relative pl-6">
      {!last && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />}
      <span className={`absolute left-0 top-[6px] h-[11px] w-[11px] rounded-full ${latest ? "bg-accent ring-4 ring-accent/20" : "bg-muted-foreground/40"}`} />
      <div className="pb-4">
        <div className="text-xs font-semibold tabular-nums text-muted-foreground">
          <span className={latest ? "text-accent" : ""}>{time(post.created_at)}</span> · {day(post.created_at)}
        </div>
        <p className="mt-0.5 text-[15px] leading-snug text-foreground">{post.body}</p>
        {post.image && <img src={post.image} alt="" loading="lazy" className="mt-2 max-h-64 w-full rounded-xl object-cover" />}
        <ProductChip post={post} />
      </div>
    </li>
  );
}

function Header() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative h-2 w-2 rounded-full bg-accent" /></span>
      <span className="font-display text-[13px] font-semibold uppercase tracking-wider text-foreground">Wetter-Ticker</span>
    </div>
  );
}

export function TickerWidget({ posts }: { posts: TickerPost[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <Header />
      <ol>{posts.map((p, i) => <Entry key={p.id} post={p} latest={i === 0} last={i === posts.length - 1} />)}</ol>
    </section>
  );
}

export function TickerBanner({ posts }: { posts: TickerPost[] }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = posts;
  return (
    <section className="rounded-2xl border border-border bg-card px-4 pt-3 shadow-sm">
      <Header />
      <ol><Entry post={first} latest last={!open || !rest.length} /></ol>
      {rest.length > 0 && (
        <>
          <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              <ol>{rest.map((p, i) => <Entry key={p.id} post={p} latest={false} last={i === rest.length - 1} />)}</ol>
            </div>
          </div>
          <button onClick={() => setOpen((o) => !o)}
            className="-mx-4 flex w-[calc(100%+2rem)] items-center justify-center gap-1 border-t border-border py-2 text-xs font-medium text-accent">
            {open ? "Schliessen" : `${rest.length} frühere Meldung${rest.length > 1 ? "en" : ""}`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        </>
      )}
      {!rest.length && <div className="pb-1" />}
    </section>
  );
}
