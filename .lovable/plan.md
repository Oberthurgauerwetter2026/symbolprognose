## 1. Lovable-Badge unten rechts

Das Badge wird bei veröffentlichten Deployments automatisch eingeblendet und ist keine Code-Datei im Projekt. Es lässt sich über die Publish-Einstellungen ausblenden (erfordert Pro-Plan oder höher). Beim Umsetzen rufe ich `set_badge_visibility` mit `hide_badge: true` auf; falls der Plan das nicht erlaubt, melde ich das zurück.

## 2. Push-Titel

`src/lib/push.server.ts`: Titel wird auf das Format
`Gewitterwarnung (Stufe 1) · Oberthurgauer Wetter` gesetzt — also bestehender Warntitel plus Marke als Suffix. Der Body bleibt unverändert (Beschreibung, betroffene Gemeinden, Gültigkeit).

## 3. Banner mit Symbolen kleiner

`src/components/maps/warn-map.tsx`, Gefahren-Banner:
- Container-Padding von `p-2.5` auf `p-1.5`, Abstand `gap-2` → `gap-1.5`.
- „Alle"-Button: `px-3.5 py-2.5 text-sm` → `px-3 py-1.5 text-[13px]`.
- Gefahren-Buttons: `px-3 py-2.5 text-sm` → `px-2.5 py-1.5 text-[13px]`.
- Icons: `h-6 w-6 @sm:h-7 @sm:w-7` → `h-5 w-5 @sm:h-6 @sm:w-6`.
- Status rechts: Text auf `text-[13px]`.
