## Windfarbskala feiner abstufen — an Beaufort orientiert

### Welche Normen gibt es?

Für Wind/Böen gibt es im Wesentlichen drei etablierte Skalen:

1. **Beaufort-Skala (WMO/MeteoSchweiz-Standard)** — 13 Stufen (Bft 0–12), basierend auf Windgeschwindigkeit in 10 m über Grund. Das ist die in der europäischen Meteorologie verbindliche Norm und auch die Basis der MeteoSchweiz-Warnstufen.
2. **MeteoSchweiz-Windwarnungen** — 4 Stufen (gelb ab ~60 km/h, orange ab ~90, rot ab ~110, violett ab ~140 km/h Böen im Flachland). Pragmatische Warnschwellen, aber gröber.
3. **DWD/ZAMG-Warnstufen** — sehr ähnlich zu MeteoSchweiz, ebenfalls 4–5 Warnstufen.

Für eine **Animation der Böen** ist die Beaufort-Skala der natürliche Bezug, weil sie über den ganzen Bereich abstuft (nicht nur ab Warnschwelle) und international anerkannt ist.

### Aktuell (7 Bänder, grob)

```text
0 · 20 · 40 · 60 · 80 · 100 · 130+ km/h
```

Die Sprünge sind 20 km/h breit — das überspringt mehrere Beaufort-Stufen pro Band und „flacht" schwache bis mittlere Winde optisch ein.

### Neu (12 Bänder, Beaufort-konform)

Direkt an den Bft-Schwellen ausgerichtet (Werte in km/h, jeweils Untergrenze der Stufe):

```text
Bft 0   <1     Windstille
Bft 1    1     leiser Zug
Bft 2    6     leichte Brise
Bft 3   12     schwache Brise
Bft 4   20     mäßige Brise
Bft 5   29     frische Brise
Bft 6   39     starker Wind
Bft 7   50     steifer Wind
Bft 8   62     stürmischer Wind
Bft 9   75     Sturm
Bft 10  89     schwerer Sturm
Bft 11 103     orkanartiger Sturm
Bft 12 118     Orkan
```

Farbverlauf bleibt im gleichen Charakter (blau → türkis → grün → gelb → orange → rot → violett), nur mit feineren Zwischentönen, damit jede Stufe optisch unterscheidbar ist.

### Auswirkungen auf die Karte

- Übergangsfunktion (`HALF = 3 km/h`) bleibt unverändert — bei kleineren Bändern (z. B. 6 km/h breit bei Bft 2) sorgt das automatisch für sanftere Verläufe, ohne Bänder zu „verschlucken".
- Legende unten zeigt entsprechend mehr Ticks. Beschriftung kompakt: nur jede zweite Zahl + Bft-Nummer als Sekundärlabel, sonst wird's eng.

### Offene Frage

Sollen wir
- **(A) volle 13-stufige Beaufort-Skala** wie oben (feinst, exakt nach Norm), oder
- **(B) reduzierte 9-stufige Variante** (0, 6, 20, 29, 39, 50, 62, 75, 89, 103+) — etwas gröber als A, aber immer noch klar feiner als heute und mit ruhigerer Legende,
- **(C) MeteoSchweiz-Warnschwellen** (0, 20, 40, 60, 90, 110, 140) — gröber, aber mit den offiziellen CH-Warnfarben?

Standard-Empfehlung wäre **(A)**, weil Böen-Animationen vom feinen Verlauf leben.

### Betroffene Datei

`src/components/maps/wind-map.tsx` — nur die Konstante `WIND_SCALE` (Zeilen 35–43) und die Legendenticks unten. Logik bleibt identisch.
