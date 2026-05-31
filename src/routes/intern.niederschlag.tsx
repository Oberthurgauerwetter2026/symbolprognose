import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { getRadarFrames } from "@/lib/radar.functions";
import { PrecipAccumMap } from "@/components/maps/precip-accum-map";

const ADMIN_PASSWORD = "wetter2026";
const STORAGE_KEY = "wx_admin_unlocked";

export const Route = createFileRoute("/intern/niederschlag")({
  ssr: false,
  component: InternPrecipPage,
  head: () => ({
    meta: [
      { title: "Intern · Niederschlagssummen" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function InternPrecipPage() {
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

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50">
        <form
          onSubmit={submit}
          className="w-full max-w-sm bg-white border border-zinc-200 rounded-md p-6 space-y-4 shadow-sm"
        >
          <h1 className="text-lg font-semibold uppercase tracking-tight">
            Intern · Niederschlagssummen
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

  return <PrecipDashboard />;
}

function PrecipDashboard() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["radar-frames-accum"],
    queryFn: () => getRadarFrames(),
    staleTime: 30 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const updatedAgo = dataUpdatedAt
    ? Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 60000))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/60 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Intern · Live
            {updatedAgo !== null && (
              <span className="text-zinc-400 normal-case tracking-normal">
                · aktualisiert vor {updatedAgo} min
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Niederschlagssummen
          </h1>
          <p className="text-sm text-zinc-600 max-w-2xl">
            Akkumulierte Vorhersage für die nächsten 12, 24 und 48 Stunden auf Basis von
            ICON-CH1 (bis +33 h, 1 km) und ICON-CH2 (bis +120 h, 2 km) via Open-Meteo.
            Auto-Refresh stündlich.
          </p>
        </header>

        {isLoading && (
          <div className="text-sm text-zinc-500">Lade Prognosedaten …</div>
        )}
        {error && (
          <div className="text-sm text-red-600">
            Fehler beim Laden: {(error as Error).message}
          </div>
        )}

        {data && data.frames.length > 0 && (
          <div className="space-y-6">
            {[12, 24, 48].map((h) => (
              <PrecipAccumMap
                key={h}
                hours={h as 12 | 24 | 48}
                frames={data.frames}
                gridLat={data.gridLat}
                gridLon={data.gridLon}
              />
            ))}
          </div>
        )}

        {data && (
          <p className="text-xs text-zinc-400">
            Modell-Run generiert: {new Date(data.generatedAt).toLocaleString("de-CH")} ·
            {" "}{data.frames.length} Frames im Cache
          </p>
        )}
      </div>
    </div>
  );
}

