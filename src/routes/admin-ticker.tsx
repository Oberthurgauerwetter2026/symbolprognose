import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Film, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { uploadVideo } from "@/lib/video-upload";
import { checkVideo } from "@/lib/ticker-media";
import { deletePhotoSubmission, listPhotoSubmissions } from "@/lib/photos.functions";
import { creditLine } from "@/lib/photo-submit";
import { shrinkImage } from "@/lib/image-shrink";
import { checkAdminLogin } from "@/lib/warnings.functions";
import { createTickerPost, deleteTickerPost, updateTickerPost } from "@/lib/ticker.functions";
import { MAX_BODY, TICKER_PRODUCTS, productById, productGroups, productUrl, visiblePosts } from "@/lib/ticker";
import { ProductPreview, TickerWidget } from "@/components/ticker/ticker-view";
import { tickerQuery } from "./embed.ticker";
import { PhotoPushOptIn } from "@/components/ticker/photo-push-opt-in";
import { Button } from "@/components/ui/button";
import { WP_TICKER_SNIPPETS } from "@/lib/ticker-wp";

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
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Ticker Admin" },
      { name: "application-name", content: "Ticker Admin" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "theme-color", content: "#2561a1" },
    ],
    links: [
      { rel: "manifest", href: "/api/public/admin-ticker-manifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
});

const shrink = (f: File) => shrinkImage(f);

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
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const body = text.trim() ? `${title.trim()}\n${text.trim()}` : title.trim();
  const [picked, setPicked] = useState<string[]>([]);
  const product = picked.join(",") || null;
  const toggle = (id: string) => setPicked((l) => l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);
  const [value, setValue] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState<{ b64?: string; sub?: string; file?: File; video?: boolean; url: string } | null>(null);
  const subs = useQuery({ queryKey: ["photo-subs"], queryFn: () => listPhotoSubmissions({ data: { password } }), refetchInterval: 60_000 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [imgRemoved, setImgRemoved] = useState(false);
  const reset = () => { setTitle(""); setText(""); setPicked([]); setValue(""); setImage(null); setLink(""); setEditId(null); setImgRemoved(false); };
  const startEdit = (x: (typeof data)[number]) => {
    const [t, ...rest] = x.body.split("\n");
    setTitle(t); setText(rest.join("\n")); setPicked(x.product ? x.product.split(",").filter(Boolean) : []);
    setValue(x.product_value ?? ""); setLink(x.link ?? ""); setImage(x.image ? { url: x.image, video: !!x.video } : null);
    setEditId(x.id); setImgRemoved(false); setMsg(""); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const videoPath = image?.file ? (setMsg("Video wird hochgeladen …"), await uploadVideo(image.file, password)) : null;
      if (editId) await updateTickerPost({ data: { password, id: editId, body, product, productValue: value, link, imageBase64: image?.b64 ?? null, submissionId: image?.sub ?? null, removeImage: imgRemoved && !image, videoPath } });
      else await createTickerPost({ data: { password, body, product, productValue: value, imageBase64: image?.b64 ?? null, submissionId: image?.sub ?? null, link, videoPath } });
      reset(); setMsg(editId ? "Änderung gespeichert." : "Veröffentlicht.");
      await qc.invalidateQueries({ queryKey: ["ticker"] }); qc.invalidateQueries({ queryKey: ["photo-subs"] });
    } catch (x) { setMsg(x instanceof Error ? x.message : "Fehler"); } finally { setBusy(false); }
  };
  const live = visiblePosts(data, Date.now());

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Wetter-Ticker</h1>
        <button onClick={onLogout} className="text-sm text-muted-foreground">Abmelden</button>
      </div>
      <PhotoPushOptIn password={password} />
      {(subs.data?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Eingesandte Leserfotos & -videos ({subs.data?.length})</div>
          <ul className="space-y-3">
            {subs.data?.map((s) => (
              <li key={s.id} className="flex gap-3">
                {s.url && (s.video ? <video src={s.url} controls playsInline preload="metadata" className="h-20 w-28 shrink-0 rounded-lg bg-muted object-cover" /> : <img src={s.url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />)}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{creditLine(s)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}</div>
                  {s.note && <div className="mt-0.5 line-clamp-2 text-muted-foreground">{s.note}</div>}
                  <div className="mt-1 flex gap-3">
                    <button type="button" className="text-accent" onClick={() => { if (!s.url) return; setImage({ sub: s.id, url: s.url, video: s.video }); setText((t) => t || `${s.note ? s.note + "\n" : ""}${creditLine(s)}`); window.scrollTo({ top: 0, behavior: "smooth" }); }}>In Meldung übernehmen</button>
                    <button type="button" className="text-muted-foreground" onClick={async () => { if (confirm("Einsendung löschen?")) { await deletePhotoSubmission({ data: { password, id: s.id } }); subs.refetch(); } }}>Löschen</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={submit} className={`space-y-4 rounded-2xl border bg-card p-4 ${editId ? "border-accent" : "border-border"}`}>
        {editId && (
          <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2 text-sm">
            <span className="font-medium text-accent">Meldung bearbeiten</span>
            <button type="button" onClick={() => { reset(); setMsg(""); }} className="text-muted-foreground">Abbrechen</button>
          </div>
        )}
        <div>
          <input value={title} onChange={(e) => setTitle(e.target.value.replace(/\n/g, " ").slice(0, 120))} placeholder="Titel, z. B. «Schneefall setzt ein»"
            className="w-full rounded-xl border border-border bg-background p-3 text-[16px] font-semibold" />
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, Math.max(0, MAX_BODY - title.length - 1)))} rows={4} placeholder="Text (erscheint nach dem Antippen)"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-3 text-[15px]" />
          <div className="text-right text-xs text-muted-foreground">{body.length}/{MAX_BODY}</div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Karten anhängen (mehrere möglich)</div>
          <div className="space-y-3">
            {productGroups().map((g) => (
              <div key={g}>
                <div className="mb-1 text-[12px] text-muted-foreground">{g}</div>
                <div className="flex flex-wrap gap-1.5">
                  {TICKER_PRODUCTS.filter((x) => x.group === g).map((x) => (
                    <button type="button" key={x.id} onClick={() => toggle(x.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${picked.includes(x.id) ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background"}`}>{x.label.startsWith(g) ? x.label.slice(g.length).trim() : x.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {picked.map((id) => { const p = productById(id); return p && (
            <div key={id} className="mt-3">
              <ProductPreview product={p} />
              <a href={productUrl(p)} target="_blank" rel="noopener" className="mt-1 inline-block text-sm text-accent">Karte «{p.label}» gross öffnen ↗</a>
            </div>); })}
        </div>
        <input value={link} onChange={(e) => setLink(e.target.value)} type="url" inputMode="url" placeholder="Link (optional), z. B. zu einem Foto oder Bericht" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex items-center gap-3">
          {image ? (
            <div className="relative">{image.video ? <video src={image.url} muted playsInline preload="metadata" className="h-20 rounded-lg bg-muted" /> : <img src={image.url} alt="" className="h-20 rounded-lg object-cover" />}
              <button type="button" onClick={() => { setImage(null); setImgRemoved(true); }} className="absolute -right-2 -top-2 rounded-full bg-card p-1 shadow"><X className="h-3 w-3" /></button></div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4" /> Eigenes Bild
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage({ b64: await shrink(f), url: URL.createObjectURL(f) }); }} />
            </label>
          )}
          {!image && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              <Film className="h-4 w-4" /> Video
              <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; try { checkVideo(f.type, f.size); setImage({ file: f, video: true, url: URL.createObjectURL(f) }); setMsg(""); } catch (x) { setMsg(x instanceof Error ? x.message : "Fehler"); } }} />
            </label>
          )}
          <button disabled={busy || !title.trim()} className="ml-auto rounded-lg bg-accent px-5 py-2 font-medium text-accent-foreground disabled:opacity-50">{busy ? "…" : editId ? "Speichern" : "Veröffentlichen"}</button>
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>

      <WpSnippets />

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vorschau {live.length ? "" : "(Standby)"}</div>
        <TickerWidget posts={live} />
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {data.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="tabular-nums text-muted-foreground">{new Date(x.created_at).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="flex-1 truncate">{x.body}</span>
            <button onClick={() => startEdit(x)} aria-label="Bearbeiten"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
            <button aria-label="Löschen" onClick={async () => { if (confirm("Meldung löschen?")) { await deleteTickerPost({ data: { password, id: x.id } }); qc.invalidateQueries({ queryKey: ["ticker"] }); } }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WpSnippets() {
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">Einbettung WordPress (Handy oben, Desktop Seitenleiste)</summary>
      <div className="mt-3 space-y-4">
        {WP_TICKER_SNIPPETS.map((x, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <span className="flex-1">{x.label}</span>
              <Button type="button" variant="outline" size="sm" className="text-accent"
                onClick={async () => { await navigator.clipboard.writeText(x.code); setCopied(i); setTimeout(() => setCopied(null), 2000); }}>
                {copied === i ? "Kopiert ✓" : "Kopieren"}
              </Button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-[12px]">{x.code}</pre>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Beide Codes einfügen: Auf dem Handy erscheint nur der obere Banner, auf dem Computer nur das Seitenleisten-Widget.</p>
        <p className="text-xs text-muted-foreground">Vorhandene Ticker-Codes vollständig durch diese Codes ersetzen, auch das bisherige Höhenskript. Die Höhe passt sich beim Öffnen und Schliessen automatisch an.</p>
      </div>
    </details>
  );
}
