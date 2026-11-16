import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLink, productById, productIds, productUrl } from "./ticker";

function destination(id: string): string {
  const product = productById(id);
  assert.ok(product, `Produkt ${id} muss existieren`);
  return productUrl(product);
}

test("Radar öffnet die WordPress-Seite mit dem aktuellen Radar", () => {
  assert.equal(destination("radar"), "https://www.oberthurgauerwetter.ch/niederschlagsradar-3/");
});
test("Satellit öffnet die WordPress-Seite Schweiz/Europa", () => {
  assert.equal(destination("satellit"), "https://www.oberthurgauerwetter.ch/satellitenbild-schweiz/");
});
test("Wetterbericht bleibt auf der passenden WordPress-Seite", () => {
  assert.equal(destination("wetterbericht"), "https://www.oberthurgauerwetter.ch/wetterbericht/");
});
test("Warnungen bleiben auf der WordPress-Warnkarte", () => {
  assert.equal(destination("warnungen"), "https://www.oberthurgauerwetter.ch/warnkarte/");
});
test("alle Stationskarten führen zur WordPress-Live-Wetterkarte", () => {
  for (const id of ["temp-current", "rain-today", "temp-min", "temp-max", "hub-karte"]) {
    assert.equal(destination(id), "https://www.oberthurgauerwetter.ch/live-wetterkarte/");
  }
});
test("Stärkste Windböen heute öffnen die Summenkarte Wind von heute", () => {
  assert.equal(destination("gust-today"), "https://live-wetterkarte.lovable.app/summenkarte?period=today&metric=wind");
});
test("alle 16 Summenkarten behalten Niederschlagsart, Zeitraum und Stunden in der Grossansicht", () => {
  for (const phase of ["rain", "snow"]) for (const period of ["past", "future"]) for (const hours of [12, 24, 48, 72]) {
    assert.equal(destination(`${phase}-${period}-${hours}`), `https://oberthurgauer-wetter.lovable.app/karten/niederschlag?p=${period}&m=${phase}&h=${hours}`);
  }
});
test("Wind öffnet die interaktive Windkarte statt eines alten WordPress-Artikels", () => {
  assert.equal(destination("wind"), "https://oberthurgauer-wetter.lovable.app/karten/wind");
});
test("Maximalböen behalten die 24-h-Ansicht", () => {
  assert.equal(destination("wind-max"), "https://oberthurgauer-wetter.lovable.app/karten/wind?max=1");
});
test("Bodendruck öffnet dieselbe Karte wie die Vorschau statt einer anderen Frontenanalyse", () => {
  assert.equal(destination("bodendruck"), "https://oberthurgauer-wetter.lovable.app/karten/bodendruck");
});
test("Regionskarte öffnet die Temperaturkarte statt des Modell-Erklärartikels", () => {
  assert.equal(destination("temperatur"), "https://oberthurgauer-wetter.lovable.app/karten/region");
});
test("Lokalprognose öffnet die bestehende interaktive Grossansicht", () => {
  assert.equal(destination("lokal"), "https://oberthurgauer-wetter.lovable.app/karten/lokal");
});
test("externe Produkte ohne passende WordPress-Seite behalten ihre Grossansicht", () => {
  assert.equal(destination("hub-dashboard"), "https://live-wetterkarte.lovable.app/dashboard");
  assert.equal(destination("amr-prognose"), "https://oberthurgauerwetter2026.lovable.app/");
});
test("bereits veröffentlichte Meldungen mit alten Summen-IDs öffnen die korrekte Grossansicht", () => {
  assert.equal(destination("regensumme"), "https://oberthurgauer-wetter.lovable.app/karten/niederschlag?p=past&m=rain&h=24");
  assert.equal(destination("neuschnee"), "https://oberthurgauer-wetter.lovable.app/karten/niederschlag?p=past&m=snow&h=24");
  assert.equal(destination("regen-prognose"), "https://oberthurgauer-wetter.lovable.app/karten/niederschlag?p=future&m=rain&h=24");
  assert.equal(destination("schnee-prognose"), "https://oberthurgauer-wetter.lovable.app/karten/niederschlag?p=future&m=snow&h=24");
});
test("Link-Feld nimmt nur Web-Adressen", () => {
  assert.equal(cleanLink("foto.ch/x"), "https://foto.ch/x");
  assert.equal(cleanLink("javascript:alert(1)"), null);
  assert.equal(cleanLink(""), null);
});

test("mehrere Karten: unbekannte und doppelte IDs fallen weg", () => {
  assert.deepEqual(productIds("radar,radar,xyz,wind"), ["radar", "wind"]);
  assert.deepEqual(productIds(null), []);
});
