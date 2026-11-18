/** Regeln für Ticker-Videos (rein, getestet). */
export const VIDEO_MAX_BYTES = 50_000_000;
const TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

/** Dateiendung für einen erlaubten Video-Typ, sonst null. */
export function videoExt(mime: string): string | null {
  return TYPES[(mime || "").toLowerCase()] ?? null;
}
export function isVideoPath(path: string | null | undefined): boolean {
  return !!path && /\.(mp4|mov|webm)$/i.test(path);
}
/** Nur selbst vergebene Speicherpfade dürfen zurückkommen (kein fremder Pfad). */
export function validVideoPath(path: unknown, prefix: "videos" | "einsendungen"): path is string {
  return typeof path === "string" && new RegExp(`^${prefix}/\\d{4}-\\d{2}-\\d{2}/[0-9a-f-]{36}\\.(mp4|mov|webm)$`).test(path);
}
export function checkVideo(mime: string, size: number): string {
  const ext = videoExt(mime);
  if (!ext) throw new Error("Bitte ein MP4-, MOV- oder WebM-Video wählen.");
  if (!(size > 0) || size > VIDEO_MAX_BYTES) throw new Error("Video zu gross (max. 50 MB, etwa 1 Minute).");
  return ext;
}
