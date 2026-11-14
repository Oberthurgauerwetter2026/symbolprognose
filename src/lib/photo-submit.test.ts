import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSubmission, creditLine, isJpeg } from "./photo-submit";

test("Einsendung ohne Zustimmung wird abgelehnt", () => {
  assert.throws(() => cleanSubmission({ author: "Markus", consent: false }));
});
test("Einsendung ohne Namen wird abgelehnt", () => {
  assert.throws(() => cleanSubmission({ author: "  ", consent: true }));
});
test("Nur JPEG wird angenommen", () => {
  assert.equal(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
});
test("Bildnachweis mit Ort", () => {
  assert.equal(creditLine({ author: "Markus M.", place: "Amriswil" }), "Foto: Markus M., Amriswil");
});
