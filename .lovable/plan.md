# Niederschlags-Prognose: Envelope deutlich aggressiver

Vorige Änderung war zu schwach — `envelope = max(0, env·1.9 − 0.18)` liefert (mit `env`-Median ≈ 0.5) Werte im Bereich ~0.2–1.3 und erreicht praktisch nie 0. Resultat: die rechteckige Datengrid-Bbox bleibt sichtbar.

Zudem ist die Frequenz `0.12 · rx` über den sichtbaren Ausschnitt zu niedrig → kaum Wellen am Rand.

## Änderung in `src/components/maps/radar-map.tsx`, Zeilen 522–525

```ts
// Mittel-/Grossräumiger Envelope-Noise — erzeugt echte Null-Inseln und
// reisst die Daten-Bbox in unregelmässige Zellen auf.
const env1 = fbm(rx * 0.28 - 5.7, ry * 0.28 + 11.2);   // grobe Zellstruktur
const env2 = fbm(rx * 0.9 + 31.1, ry * 0.9 - 7.4);     // feine Kantenfaserung
const envRaw = env1 * 0.75 + env2 * 0.25;              // 0..1, leicht zugunsten gross
// Threshold so wählen, dass ~30–40 % der Fläche auf Null fallen → wellige
// Aussenkontur + organische Innen-Lücken.
const envelope = Math.max(0, envRaw * 2.6 - 0.95);
v = v * mod * envelope;
```

Wirkung:
- `env1` (Freq 0.28) zerlegt die Bbox in mehrere wolkenartige Zellen.
- `env2` (Freq 0.9) faserig die Kanten der Zellen.
- Threshold `·2.6 − 0.95` → wirklich Null in ~⅓ der Fläche → keine geschlossene Rechteck-Hülle mehr.
- `colorFor` + `imageSmoothingEnabled = false` unverändert → harte Bänder, keine Weichzeichnung.

## Verifikation

`/karten/radar` Prognose-Frame: keine durchgehende rechteckige Aussenkontur mehr; statt einer geschlossenen Insel mehrere unregelmässige Zellen mit welligen Rändern; innere Iso-Bänder pixelig-hart wie bisher.
