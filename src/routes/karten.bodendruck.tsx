import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SourceFooter } from "@/components/source-footer";

const SRC = "https://oberthurgauerwetter2026.lovable.app/api/public/maps/europe-pressure-latest.svg";
const DESC = "Aktuelle Bodendruckverteilung über Europa mit Isobaren, Hoch- und Tiefdruckgebieten.";

export const Route = createFileRoute("/karten/bodendruck")({
  component: BodendruckPage,
  head: () => ({
    meta: [
      { title: "Bodendruckkarte Europa · Oberthurgauer Wetter" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Bodendruckkarte Europa" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BodendruckPage() {
  // Alle 5 Minuten neu laden, passend zum Cache der Quelle.
  const [v, setV] = useState(() => Math.floor(Date.now() / 300_000));
  useEffect(() => {
    const t = setInterval(() => setV(Math.floor(Date.now() / 300_000)), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <DashboardLayout title="Bodendruck" subtitle={DESC}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <a href={`${SRC}?v=${v}`} target="_blank" rel="noopener noreferrer" aria-label="Karte in voller Grösse öffnen">
            <img src={`${SRC}?v=${v}`} alt="Bodendruckkarte Europa mit Isobaren" className="block h-auto w-full" />
          </a>
        </div>
        <SourceFooter data="DWD ICON-EU" className="mt-3" />
      </div>
    </DashboardLayout>
  );
}
