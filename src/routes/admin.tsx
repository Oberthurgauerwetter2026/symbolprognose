import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SPOTS } from "@/data/spots";
import { nearestMosmixStation } from "@/data/mosmix-stations";


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
        <MosmixStationsSection />
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
    name: "MeteoSchweiz local_forecast (OGD)",
    provider: "MeteoSchweiz STAC ch.meteoschweiz.ogd-local-forecasting",
    resolution: "Punktprognose pro PLZ (INCA + ICON-CH1/CH2 + ECMWF)",
    members: "— (deterministischer Mix)",
    range: "bis +192 h, stündlich",
    usage: "Tag 1–7 Primärquelle (Symbol- & Lokalprognose)",
    endpoint:
      "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting",
  },
  {
    name: "ICON-CH1 (minutely_15)",
    provider: "MeteoSchweiz via Open-Meteo Forecast-API",
    resolution: "1 km",
    members: "—",
    range: "−12 h … +33 h, 15-min",
    usage: "Radar-Nowcast & Niederschlagskarten",
    endpoint:
      "https://api.open-meteo.com/v1/forecast?models=meteoswiss_icon_ch1&minutely_15=...",
  },
  {
    name: "DWD-MOSMIX-L",
    provider: "Deutscher Wetterdienst (opendata.dwd.de) via Server Function",
    resolution: "stationsbasiert (Punktprognose, MOS auf ICON-Basis)",
    members: "— (deterministisch, statistisch nachkalibriert)",
    range: "~10 Tage, stündlich",
    usage: "ab Tag 6 alleinige Quelle (überschreibt local_forecast)",
    endpoint:
      "https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/{ID}/kml/MOSMIX_L_LATEST_{ID}.kmz",
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
          <code className="font-mono">icon_seamless → MOSMIX (ab Tag 6) → best_match</code>.
          Beide Hauptquellen sind deterministisch und stammen aus derselben
          Modellfamilie (ICON bzw. MOS auf ICON-Basis) — keine Naht zwischen
          Ensemble-Mittel und Punktprognose. Daily-Aggregate (Max/Min-Temp,
          Niederschlagssumme, Wind, Sonne, Schnee) werden aus den gemergten
          stündlichen Arrays berechnet. Sonnenauf-/-untergang und maximale
          Niederschlagswahrscheinlichkeit kommen aus <code className="font-mono">best_match</code>.
        </p>


      </div>
    </section>
  );
}

function MosmixStationsSection() {
  const rows = SPOTS.map((s) => {
    const { station, distanceKm } = nearestMosmixStation(s.lat, s.lon);
    return { spot: s, station, distanceKm };
  });

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
        MOSMIX-Stationszuordnung (Kartenpunkte)
      </h2>

      <div className="bg-white border border-zinc-200 rounded-md p-5 space-y-4">
        <p className="text-sm text-zinc-700 leading-relaxed">
          Ab Tag 6 wird pro Ort die geografisch nächste DWD-MOSMIX-L-Station
          verwendet. Die Auswahl basiert auf Luftlinien-Distanz (Haversine).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                <th className="py-2 pr-4">Ort</th>
                <th className="py-2 pr-4">MOSMIX-Station</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4 text-right">Distanz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ spot, station, distanceKm }) => (
                <tr key={spot.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 font-medium text-zinc-900">{spot.name}</td>
                  <td className="py-2 pr-4 text-zinc-700">{station.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">{station.id}</td>
                  <td className="py-2 pr-4 text-right text-zinc-700">
                    {distanceKm.toFixed(1)} km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Stationskatalog: 25 CH-Stationen + 5 grenznahe Nachbarstationen
          (Friedrichshafen, Konstanz, Innsbruck, Milano-Malpensa, Lyon-Bron).
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
