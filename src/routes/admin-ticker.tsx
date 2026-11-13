import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { checkAdminLogin } from "@/lib/warnings.functions";
import { createTickerPost, deleteTickerPost } from "@/lib/ticker.functions";
import { MAX_BODY, TICKER_PRODUCTS, productById, productGroups, productUrl, visiblePosts } from "@/lib/ticker";
import { ProductPreview, TickerWidget } from "@/components/ticker/ticker-view";
import { tickerQuery } from "./embed.ticker";

const KEY = "wx_warn_admin_pw";

export const Route = createFileRoute("/admin-ticker")({
  component: AdminTicker,
  head: () => ({
    meta: [
      { title: "Ticker erfassen · Oberthurgauer Wetter" },
      { name: "description", content: "Kurzmeldungen für den Wetter-Ticker erfassen." },
      { property: "og:title", content: "Ticker erfassen · Oberthurgauer Wetter" },
      { property: "og:description", content: "Kurzmeldungen für den Wetter-Ticker erfassen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function AdminTicker() {
  const [pw, setPw] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { const s = localStorage.getItem(KEY); if (s) setPw(s); }, []);

  if (!pw) {
    return (
      <form className="mx-auto mt-24 max-w-sm space-y-3 rounded-2xl border border-border bg-card p-6"
        onSubmit={async (e) => { e.preventDefault(); const { ok } = await checkAdminLogin({ data: { password: input } }); if (ok) { localStorage.setItem(KEY, input); setPw(input); } else setErr("Falsches Passwort."); }}>
        <h1 className="font-display text-lg font-semibold">Ticker · Anmeldung</h1>
        <input type="password" autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Passwort" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="w-full rounded-lg bg-accent py-2 font-medium text-accent-foreground">Anmelden</button>
      </form>
    );
  }
  return <Composer password={pw} onLogout={() => { localStorage.removeItem(KEY); setPw(null); }} />;
}

function Composer({ password, onLogout }: { password: string; onLogout: () => void }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery(tickerQuery());
  const [body, setBody] = useState("");
  const [product, setProduct] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ b64: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      await createTickerPost({ data: { password, body, product, productValue: value, imageBase64: image?.b64 ?? null } });
      setBody(""); setProduct(null); setValue(""); setImage(null); setMsg("Veröffentlicht.");
      await qc.invalidateQueries({ queryKey: ["ticker"] });
    } catch (x) { setMsg(x instanceof Error ? x.message : "Fehler"); } finally { setBusy(false); }
  };
  const p = productById(product);
  const live = visiblePosts(data, Date.now());

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Wetter-Ticker</h1>
        <button onClick={onLogout} className="text-sm text-muted-foreground">Abmelden</button>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} rows={3} placeholder="Kurz und aktuell, z. B. «Schneefall setzt ein, Schneefallgrenze sinkt auf 500 m.»"
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[15px]" />
          <div className="text-right text-xs text-muted-foreground">{body.length}/{MAX_BODY}</div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Produkt anhängen</div>
          <div className="space-y-3">
            {productGroups().map((g) => (
              <div key={g}>
                <div className="mb-1 text-[12px] text-muted-foreground">{g}</div>
                <div className="flex flex-wrap gap-1.5">
                  {TICKER_PRODUCTS.filter((x) => x.group === g).map((x) => (
                    <button type="button" key={x.id} onClick={() => setProduct(product === x.id ? null : x.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${product === x.id ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background"}`}>{x.label.startsWith(g) ? x.label.slice(g.length).trim() : x.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {p && <ProductPreview product={p} />}
          {p && <a href={productUrl(p)} target="_blank" rel="noopener" className="mt-2 inline-block text-sm text-accent">Karte «{p.label}» gross öffnen ↗</a>}
          {p && <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={p.hint} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />}
        </div>
        <div className="flex items-center gap-3">
          {image ? (
            <div className="relative"><img src={image.url} alt="" className="h-20 rounded-lg object-cover" />
              <button type="button" onClick={() => setImage(null)} className="absolute -right-2 -top-2 rounded-full bg-card p-1 shadow"><X className="h-3 w-3" /></button></div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4" /> Eigenes Bild
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage({ b64: await shrink(f), url: URL.createObjectURL(f) }); }} />
            </label>
          )}
          <button disabled={busy || !body.trim()} className="ml-auto rounded-lg bg-accent px-5 py-2 font-medium text-accent-foreground disabled:opacity-50">{busy ? "…" : "Veröffentlichen"}</button>
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vorschau {live.length ? "" : "(Ticker aktuell ausgeblendet – keine Meldung der letzten 24 h)"}</div>
        {live.length > 0 && <TickerWidget posts={live} />}
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {data.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="tabular-nums text-muted-foreground">{new Date(x.created_at).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="flex-1 truncate">{x.body}</span>
            <button onClick={async () => { if (confirm("Meldung löschen?")) { await deleteTickerPost({ data: { password, id: x.id } }); qc.invalidateQueries({ queryKey: ["ticker"] }); } }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
