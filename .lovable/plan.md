## Befund

Live-Manifest `https://pub-2273…r2.dev/radar/frames.json`:
- `frames: 288` ✓ (Ingest läuft)
- `motion: {}` ✗ (leer — weder globaler Vektor noch `field`)
- kein `version`-Feld

Das Label **"Radar-Feld · N Kacheln"** in `src/components/maps/radar-map.tsx:1084` erscheint also nie, weil `currentFrame.motionSource` nicht `"radar-field"` wird. Der Frontend-Pfad in `src/lib/radar.functions.ts:480` setzt diese Quelle nur, wenn `manifest.motion.field` mit ≥4 validen Kacheln vorhanden ist — und das Feld ist `null`.

Da `motion` komplett leer ist (nicht nur `field`), ist die Wurzel auf der **Python-Ingest-Seite**: `compute_motion()` / `compute_motion_field()` in `scripts/ingest_radar.py` schreibt aktuell nichts ins Manifest. Mögliche Ursachen:

1. Workflow läuft seit v9-Bump noch nicht (manueller Trigger fehlt nach Publish).
2. `compute_motion_field()` wirft eine Exception, die abgefangen wird und nur ein leeres Dict zurückgibt.
3. Frame-Auswahl liefert <2 brauchbare Paare → Funktion gibt früh `{}` zurück.
4. Wind-Prior-Fetch schlägt fehl und der Code bricht ab statt zu degradieren.

## Plan

### Schritt 1 — Workflow-Logs prüfen (Read-only, keine Codeänderung)

Den letzten erfolgreichen GitHub-Actions-Run von `radar-ingest.yml` ansehen und nach Zeilen `RADAR INGEST START version=…`, `compute_motion`, `motion field`, `tile` greifen. Damit ist sofort klar, ob v9 überhaupt gelaufen ist und was `compute_motion_field()` gemeldet hat.

→ Erwartete Ausgabe vom Nutzer: Link/Auszug des letzten Runs, oder Bestätigung "noch nicht getriggert".

### Schritt 2 — Diagnose-Endpoint erweitern

`src/routes/api/public/debug/r2-cache.ts` zusätzlich das Radar-Manifest spiegeln:

```ts
const radarRes = await fetch(`${base}/radar/frames.json`);
const radar = await radarRes.json();
return Response.json({
  ...,
  radar: {
    generatedAt: radar.generatedAt,
    version: radar.version ?? null,
    frameCount: radar.frames?.length ?? 0,
    motionKeys: Object.keys(radar.motion ?? {}),
    fieldSize: radar.motion?.field
      ? { rows: radar.motion.field.rows, cols: radar.motion.field.cols,
          validTiles: radar.motion.field.conf?.filter(c => c > 0.15).length }
      : null,
  },
});
```

Damit lässt sich nach jedem Cron-Run in einer Sekunde sehen, ob `field` geschrieben wurde.

### Schritt 3 — Ingest-Logging härten

In `scripts/ingest_radar.py` rund um `compute_motion()` / `compute_motion_field()`:

- `try/except` Block: bei Fehler `print("[motion] ERROR …", traceback)` statt stilles `return {}`.
- Vor dem `return` der `motion`-Dict: einen `print(f"[motion] result keys={list(motion)} field_tiles={…}")` ausgeben.
- Wenn weniger als 2 Frame-Paare verfügbar: explizit loggen, warum.
- `RADAR_INGEST_VERSION` zusätzlich ins Manifest schreiben (`manifest["version"] = RADAR_INGEST_VERSION`), damit die Diagnose aus Schritt 2 sieht, welcher Code lief.

### Schritt 4 — Frontend-Label-Fallback

In `src/components/maps/radar-map.tsx:1079-1090` das Label so erweitern, dass **immer** sichtbar ist, welche Quelle aktiv ist — auch wenn kein Feld vorliegt:

```text
Zugbahn 135° SE · Wind-Fallback (kein Radar-Feld verfügbar)
Zugbahn 135° SE · Radar global (Feld leer)
Zugbahn 135° SE · Radar-Feld · 7 Kacheln
```

Damit ist beim nächsten Wahrnehmungs-vs-Code-Konflikt sofort im UI klar, welcher Pfad läuft — ohne in die Console schauen zu müssen.

### Schritt 5 — Verifikation

1. Nach Schritt 2+3+4 publishen.
2. Workflow "Radar Ingest" manuell triggern.
3. `/api/public/debug/r2-cache` öffnen → `radar.fieldSize` prüfen.
4. `/karten/radar` öffnen → Label sollte `Radar-Feld · N Kacheln` zeigen.
5. Wenn nicht: Action-Log liefert dank Schritt 3 die genaue Abbruchursache.

## Was nicht angefasst wird

- `compute_motion_field()`-Algorithmus selbst (erst nach Diagnose).
- Bbox, Frame-Auflösung, R2-Upload-Pfade.
- Wind-Fallback-Trigonometrie.

## Nächster Schritt nach Approval

Schritt 2+3+4 sind kleine, sichere Edits — diese kann ich in einem Build-Durchgang umsetzen. Schritt 1 (Workflow-Logs) brauchst du nicht zwingend zuerst zu liefern; die neuen Logs aus Schritt 3 ersetzen das beim nächsten Run.
