import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { submitPhoto } from "@/lib/photos.functions";
import { shrinkImage } from "@/lib/image-shrink";

const T = "Wetterfoto einsenden · Oberthurgauer Wetter";
const D = "Senden Sie Ihr Wetterfoto aus dem Oberthurgau – ausgewählte Bilder erscheinen im Wetter-Ticker.";
export const Route = createFileRoute("/foto-einsenden")({
  component: FotoEinsenden,
  head: () => ({ meta: [
    { title: T }, { name: "description", content: D },
    { property: "og:title", content: T }, { property: "og:description", content: D },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
});

function FotoEinsenden() {
  const [img, setImg] = useState<{ b64: string; url: string } | null>(null);
  const [author, setAuthor] = useState(""); const [place, setPlace] = useState(""); const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!img) return; setBusy(true); setErr("");
    try { await submitPhoto({ data: { imageBase64: img.b64, author, place, note, consent } }); setDone(true); }
    catch (x) { setErr(x instanceof Error ? x.message : "Fehler"); } finally { setBusy(false); }
  };
  const field = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[16px]";

  if (done) return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
      <h1 className="mt-4 font-display text-2xl font-semibold">Herzlichen Dank!</h1>
      <p className="mt-2 text-muted-foreground">Ihr Foto ist angekommen. Ausgewählte Bilder erscheinen mit Ihrem Namen im Wetter-Ticker.</p>
      <button onClick={() => { setDone(false); setImg(null); setNote(""); }} className="mt-6 text-accent">Weiteres Foto senden</button>
    </main>
  );
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="font-display text-2xl font-semibold">Wetterfoto einsenden</h1>
      <p className="mt-1 text-muted-foreground">Gewitterwolken, Schnee, Regenbogen? Ausgewählte Bilder zeigen wir im Wetter-Ticker.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-border bg-card">
          {img ? <img src={img.url} alt="Ihr Foto" className="max-h-80 w-full object-cover" /> : (
            <span className="flex flex-col items-center gap-2 py-10 text-muted-foreground"><Camera className="h-8 w-8" />Foto wählen oder aufnehmen</span>)}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg({ b64: await shrinkImage(f, 1600, 0.8), url: URL.createObjectURL(f) }); }} />
        </label>
        <input required value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={60} placeholder="Ihr Name (für den Bildnachweis)" className={field} />
        <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={60} placeholder="Aufnahmeort, z. B. Amriswil" className={field} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} placeholder="Bemerkung (optional), z. B. «Graupelschauer um 14:15»" className={`${field} resize-none`} />
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          Ich habe das Foto selbst aufgenommen und erlaube Oberthurgauer Wetter die honorarfreie Veröffentlichung mit Namensnennung.
        </label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy || !img || !consent || !author.trim()} className="w-full rounded-xl bg-accent py-3 font-medium text-accent-foreground disabled:opacity-50">{busy ? "Wird gesendet …" : "Foto senden"}</button>
      </form>
    </main>
  );
}
