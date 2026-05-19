import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

const ADMIN_PASSWORD = "wetter2026";
const STORAGE_KEY = "wx_admin_unlocked";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin · Wetter-Widget" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError("");
    } else {
      setError("Falsches Passwort.");
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUnlocked(false);
    setPw("");
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50">
        <form
          onSubmit={submit}
          className="w-full max-w-sm bg-white border border-zinc-200 rounded-md p-6 space-y-4 shadow-sm"
        >
          <h1 className="text-lg font-semibold uppercase tracking-tight">
            Admin-Zugang
          </h1>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Passwort"
            className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full bg-zinc-900 text-white text-sm font-medium py-2 rounded-sm hover:bg-zinc-800"
          >
            Entsperren
          </button>
        </form>
      </div>
    );
  }

  return <AdminDashboard onLogout={logout} />;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold uppercase tracking-tight">
            Admin
          </h1>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-zinc-600 hover:text-zinc-900 underline"
          >
            Abmelden
          </button>
        </header>

        <ModelsSection />
        <EmbedSection />
      </div>
    </div>
  );
}

interface ModelInfo {
  name: string;
  provider: string;
  resolution: string;
  members: string;
  range: string;
  usage: string;
  endpoint: string;
}

const MODELS: ModelInfo[] = [
  {
    name: "ICON-CH1-EPS",
    provider: "MeteoSchweiz via Open-Meteo Ensemble-API",
    resolution: "1 km",
    members: "11",
    range: "~33 h",
    usage: "Tag 1–2 (Primärquelle), Ensemble-Mittel",
    endpoint:
      "https://ensemble-api.open-meteo.com/v1/ensemble?models=icon_ch1_eps",
  },
  {
    name: "ICON-CH2-EPS",
    provider: "MeteoSchweiz via Open-Meteo Ensemble-API",
    resolution: "2 km",
    members: "21",
    range: "~120 h",
    usage: "Tag 1–5, Ensemble-Mittel",
    endpoint:
      "https://ensemble-api.open-meteo.com/v1/ensemble?models=icon_ch2_eps",
  },
  {
    name: "ECMWF IFS Ensemble",
    provider: "ECMWF via Open-Meteo Ensemble-API",
    resolution: "0.25°",
    members: "51",
    range: "bis 15 Tage",
    usage: "Tag 6–7, Ensemble-Mittel",
    endpoint:
      "https://ensemble-api.open-meteo.com/v1/ensemble?models=ecmwf_ifs025",
  },
  {
    name: "Open-Meteo best_match",
    provider: "Open-Meteo Forecast-API (Modell-Mix)",
    resolution: "variabel",
    members: "—",
    range: "bis 7 Tage",
    usage: "Restfelder: Niederschlagswahrscheinlichkeit, Sonnenauf-/-untergang",
    endpoint: "https://api.open-meteo.com/v1/forecast?models=best_match",
  },
];

function ModelsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Datenquellen / Modelle
      </h2>

      <div className="grid gap-4">
        {MODELS.map((m) => (
          <article
            key={m.name}
            className="bg-white border border-zinc-200 rounded-md p-5"
          >
            <h3 className="text-base font-semibold text-zinc-900">{m.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{m.provider}</p>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="Auflösung" value={m.resolution} />
              <Row label="Members" value={m.members} />
              <Row label="Reichweite" value={m.range} />
              <Row label="Verwendung" value={m.usage} />
            </dl>
            <div className="mt-3 text-xs">
              <span className="text-zinc-500">Endpoint: </span>
              <code className="font-mono break-all text-zinc-700">
                {m.endpoint}
              </code>
            </div>
          </article>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 rounded-md p-5 text-sm text-zinc-700 leading-relaxed">
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">
          Merge-Reihenfolge
        </h3>
        <p>
          <code className="font-mono">CH1 → CH2 → IFS → best_match</code>.
          Fehlt in der höher priorisierten Quelle ein Wert, übernimmt die
          nächste den Platz. Daily-Aggregate (Max/Min-Temp, Niederschlagssumme,
          Wind, Sonne, Schnee) werden clientseitig aus den gemergten stündlichen
          Arrays berechnet, da die Ensemble-API keine fertigen Tageswerte
          liefert. Sonnenauf-/-untergang und maximale Niederschlagswahrscheinlichkeit
          kommen aus <code className="font-mono">best_match</code>.
        </p>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-1">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 text-right">{value}</dd>
    </div>
  );
}

function EmbedSection() {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://…";

  const snippet = `<iframe
  src="${origin}/"
  style="width:100%;min-height:680px;border:0;display:block"
  loading="lazy"
  title="5-Tage Wetterprognose"
></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Einbinden auf externer Webseite
      </h2>

      <div className="bg-white border border-zinc-200 rounded-md p-5 space-y-4">
        <p className="text-sm text-zinc-700 leading-relaxed">
          Das Widget kann per <strong>iframe</strong> auf jeder Webseite
          eingebunden werden – WordPress (Custom-HTML-Block), Wix, Squarespace
          oder eine statische HTML-Seite. Das Snippet ist responsiv und passt
          sich der Container-Breite an.
        </p>

        <div className="relative">
          <pre className="bg-zinc-900 text-zinc-100 text-xs p-4 rounded-sm overflow-x-auto font-mono leading-relaxed">
            {snippet}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-sm"
          >
            {copied ? "Kopiert ✓" : "Kopieren"}
          </button>
        </div>

        <ol className="text-sm text-zinc-700 list-decimal list-inside space-y-1">
          <li>Code mit Button oben kopieren.</li>
          <li>
            Auf der Zielseite einen <strong>HTML-/Custom-HTML-Block</strong>{" "}
            einfügen und Code einsetzen.
          </li>
          <li>Speichern bzw. veröffentlichen.</li>
        </ol>

        <p className="text-xs text-zinc-500">
          Hinweis: Der Standort wird im Widget selbst gesetzt (Suche oder
          Ortung). Die Einbettung lädt jeweils die aktuell unter{" "}
          <code className="font-mono">{origin}/</code> verfügbare Version.
        </p>
      </div>
    </section>
  );
}
