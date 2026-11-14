import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLink, productById, productUrl } from "./ticker";
test("Karten verlinken auf oberthurgauerwetter.ch", () => {
  assert.equal(productUrl(productById("radar")!), "https://www.oberthurgauerwetter.ch/radar/");
  assert.equal(productUrl(productById("wetterbericht")!), "https://www.oberthurgauerwetter.ch/wetterbericht/");
  assert.equal(productUrl(productById("rain-past-24")!), "https://www.oberthurgauerwetter.ch/niederschlag/");
});
test("Link-Feld nimmt nur Web-Adressen", () => {
  assert.equal(cleanLink("foto.ch/x"), "https://foto.ch/x");
  assert.equal(cleanLink("javascript:alert(1)"), null);
  assert.equal(cleanLink(""), null);
});
