/**
 * Kompaktes Transportformat für die Summenkarte: lange Zahlenreihen werden als
 * Base64-Int16 in 0.1-Einheiten übertragen statt als hunderttausende
 * Einzelobjekte. -1 (fehlend) bleibt -1.
 */
export type Packed = { __p: string };
const MIN_LEN = 16;

function isNumArr(v: unknown): v is number[] {
  return Array.isArray(v) && v.length >= MIN_LEN && v.every((x) => typeof x === "number");
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function packArr(a: number[]): Packed {
  const q = new Int16Array(a.length);
  for (let i = 0; i < a.length; i++) q[i] = Math.max(-32768, Math.min(32767, Math.round(a[i] * 10)));
  return { __p: toB64(new Uint8Array(q.buffer)) };
}

export function unpackArr(p: Packed): number[] {
  const bin = atob(p.__p);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const q = new Int16Array(bytes.buffer);
  const out = new Array<number>(q.length);
  for (let i = 0; i < q.length; i++) out[i] = q[i] / 10;
  return out;
}

/** Ersetzt rekursiv lange Zahlenreihen durch gepackte Strings. */
export function packDeep(v: unknown): unknown {
  if (isNumArr(v)) return packArr(v);
  if (Array.isArray(v)) return v.map(packDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, packDeep(x)]));
  return v;
}

export function unpackDeep<T>(v: unknown): T {
  if (v && typeof v === "object" && !Array.isArray(v) && typeof (v as Packed).__p === "string") return unpackArr(v as Packed) as T;
  if (Array.isArray(v)) return v.map((x) => unpackDeep(x)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unpackDeep(x)])) as T;
  return v as T;
}
