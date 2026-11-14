/** Regeln für Leserfoto-Einsendungen (rein, getestet). */
export const PHOTO_MAX_BYTES = 3_000_000;
export const PHOTO_BURST = 20; // max. Einsendungen aller Besucher pro 10 Minuten

export function cleanSubmission(d: { place?: string; author?: string; note?: string; consent?: boolean }) {
  const t = (s: string | undefined, n: number) => (s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const place = t(d.place, 60), author = t(d.author, 60), note = t(d.note, 300);
  if (!d.consent) throw new Error("Bitte der Veröffentlichung zustimmen.");
  if (!author) throw new Error("Bitte Namen für den Bildnachweis angeben.");
  return { place, author, note };
}

export function isJpeg(bin: Uint8Array) {
  return bin.length > 3 && bin[0] === 0xff && bin[1] === 0xd8 && bin[2] === 0xff;
}

/** Textvorschlag für den Ticker aus einer Einsendung. */
export function creditLine(s: { author: string; place: string }) {
  return `Foto: ${s.author}${s.place ? `, ${s.place}` : ""}`;
}
