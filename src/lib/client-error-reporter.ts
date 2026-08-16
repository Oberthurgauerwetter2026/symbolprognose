import { reportClientError } from "@/lib/client-errors.functions";

/** Höchstens so viele Meldungen pro Sitzung — verhindert Flut bei Fehlerschleifen. */
const MAX_PER_SESSION = 8;
let sent = 0;
const seen = new Set<string>();
let installed = false;

function usedMemoryMb(): number | null {
  const perf = (globalThis.performance ?? {}) as { memory?: { usedJSHeapSize?: number } };
  const bytes = perf.memory?.usedJSHeapSize;
  return typeof bytes === "number" ? bytes / (1024 * 1024) : null;
}

/** Sendet einen Fehler an den Server (best effort, wirft nie). */
export function reportError(
  kind: string,
  error: unknown,
  detail?: string,
): void {
  if (typeof window === "undefined") return;
  if (sent >= MAX_PER_SESSION) return;
  const err = error as { message?: string; stack?: string } | string | null | undefined;
  const message =
    typeof err === "string" ? err : (err?.message ?? String(error ?? "(unbekannter Fehler)"));
  const stack = typeof err === "object" && err ? (err.stack ?? null) : null;
  const key = `${kind}|${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;
  void reportClientError({
    data: {
      kind,
      message,
      stack,
      route: `${window.location.pathname}${window.location.search}`,
      detail: detail ?? null,
      memoryMb: usedMemoryMb(),
    },
  }).catch(() => {});
}

/**
 * Globale Erfassung: unbehandelte Fehler und abgebrochene Hintergrundabfragen.
 * Muss aus einem `useEffect` aufgerufen werden (Browser-Globals).
 */
export function installClientErrorReporter(): () => void {
  if (typeof window === "undefined" || installed) return () => {};
  installed = true;

  const onError = (e: ErrorEvent) => {
    reportError("window.error", e.error ?? e.message, `${e.filename}:${e.lineno}:${e.colno}`);
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    reportError("unhandledrejection", e.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    installed = false;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
