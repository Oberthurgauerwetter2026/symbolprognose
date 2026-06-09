# Lese-Endpoint im Weather-Hub-Projekt anlegen

Im **anderen** Projekt (`live-wetterkarte` / Weather Hub) muss eine neue Datei angelegt werden. Hier ist der komplette Code zum Kopieren — in diesem Projekt selbst sind keine Änderungen nötig (die Integration `src/lib/weather-hub.server.ts` ist bereits vorbereitet).

## Schritt-für-Schritt im Weather-Hub-Projekt

1. Im Lovable-Editor des Weather-Hub-Projekts in den Chat schreiben:
   > «Lege bitte die Datei `src/routes/api/public/stations.ts` mit folgendem Inhalt an:»
2. Dann den unten stehenden Code mitschicken.
3. Nach dem Deploy sollte `https://live-wetterkarte.lovable.app/api/public/stations?name=Oberthurgau` ein JSON-Array zurückgeben.

## Datei: `src/routes/api/public/stations.ts`

```ts
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name");

        let query = supabaseAdmin
          .from("public_stations") // ggf. "stations" falls keine View existiert
          .select("id, name, temperature, rain_rate, measured_at");

        if (name) query = query.eq("name", name);

        const { data, error } = await query;

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify(data ?? []), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control":
              "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
```

## Hinweise

- **Tabelle vs. View**: Falls im Weather-Hub keine View `public_stations` existiert, einfach `stations` verwenden — `supabaseAdmin` (Service-Role) umgeht RLS.
- **Sicherheit**: Endpoint gibt nur Mess-/Stammdaten zurück, keine PII. Schreiben ist nicht möglich (nur `GET`).
- **CORS**: `Access-Control-Allow-Origin: *` ist gesetzt, falls Browser-Clients direkt zugreifen sollen. Für reinen Server-zu-Server-Abruf (wie hier) optional.
- **Test**: Nach dem Deploy in einem neuen Tab `https://live-wetterkarte.lovable.app/api/public/stations?name=Oberthurgau` öffnen — sollte JSON mit `temperature`, `rain_rate`, `measured_at` liefern.

## In diesem Projekt

Keine Änderungen nötig. Sobald der Endpoint antwortet, zieht die statische Lokalprognose Amriswil automatisch Temperatur und Regenrate aus der Station.
