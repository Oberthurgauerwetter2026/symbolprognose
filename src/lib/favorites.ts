/**
 * Orts-Favoriten für die Lokalprognose (und Regionskarte).
 *
 * Speicherwege (in dieser Reihenfolge):
 *  1. eigener `localStorage` – normale Website.
 *  2. Host-Bridge per `postMessage` – eingebettetes Fenster (iframe), dessen
 *     eigener Speicher von Safari/iOS blockiert oder beim Neuladen geleert wird.
 *     Die einbettende Seite (WordPress-Snippet) speichert dann für uns.
 *  3. nur Arbeitsspeicher – gilt für die laufende Sitzung.
 */

import { useCallback, useEffect, useState } from "react";

export interface FavoritePlace {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
}

const FAVORITES_KEY = "otw:lokal-favorites";
const CHANGED_EVENT = "otw:favorites-changed";
/** Maximal 12 Favoriten; der älteste Eintrag wird bei Überschreitung entfernt. */
const MAX_FAVORITES = 12;

/** Bridge-Protokoll zum einbettenden Host (WordPress-Snippet). */
const MSG_GET = "otw:fav:get";
const MSG_SET = "otw:fav:set";
const MSG_VALUE = "otw:fav:value";
const BRIDGE_TIMEOUT_MS = 1_500;

export type FavoritesStorageMode = "local" | "bridge" | "memory";

let mode: FavoritesStorageMode | null = null;
let memory: FavoritePlace[] = [];
let initPromise: Promise<FavoritesStorageMode> | null = null;

function isValid(p: unknown): p is FavoritePlace {
  if (!p || typeof p !== "object") return false;
  const f = p as FavoritePlace;
  return (
    typeof f.name === "string" &&
    f.name.length > 0 &&
    typeof f.latitude === "number" &&
    typeof f.longitude === "number" &&
    Number.isFinite(f.latitude) &&
    Number.isFinite(f.longitude)
  );
}

function sanitize(raw: unknown): FavoritePlace[] {
  const arr = typeof raw === "string" ? safeParse(raw) : raw;
  return Array.isArray(arr)
    ? arr.filter(isValid).map((f) => ({
        name: f.name,
        latitude: f.latitude,
        longitude: f.longitude,
        ...(f.admin1 ? { admin1: f.admin1 } : {}),
      }))
        .slice(0, MAX_FAVORITES)
    : [];
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Schreibtest: in Safari-iframes schlägt localStorage fehl oder ist flüchtig. */
function localStorageWorks(): boolean {
  try {
    const probe = "otw:probe";
    window.localStorage.setItem(probe, "1");
    const ok = window.localStorage.getItem(probe) === "1";
    window.localStorage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

function inIframe(): boolean {
  try {
    return window.parent != null && window.parent !== window;
  } catch {
    return true;
  }
}

function notifyChanged() {
  try {
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Ermittelt einmalig den Speicherweg und lädt die vorhandenen Favoriten.
 * Ohne Aufruf gilt der Arbeitsspeicher-Modus.
 */
export function initFavoritesStorage(): Promise<FavoritesStorageMode> {
  if (typeof window === "undefined") return Promise.resolve("memory");
  if (initPromise) return initPromise;

  if (localStorageWorks()) {
    mode = "local";
    initPromise = Promise.resolve(mode);
    return initPromise;
  }

  memory = [];
  if (!inIframe()) {
    mode = "memory";
    initPromise = Promise.resolve(mode);
    return initPromise;
  }

  // Host nach den gespeicherten Favoriten fragen. Antwortet niemand, bleibt es
  // beim Arbeitsspeicher für die laufende Sitzung.
  initPromise = new Promise<FavoritesStorageMode>((resolve) => {
    let settled = false;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; value?: unknown } | null;
      if (!d || d.type !== MSG_VALUE) return;
      memory = sanitize(d.value);
      if (!settled) {
        settled = true;
        mode = "bridge";
        window.clearTimeout(timer);
        resolve(mode);
      }
      notifyChanged();
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      mode = "memory";
      resolve(mode);
    }, BRIDGE_TIMEOUT_MS);
    try {
      window.parent.postMessage({ type: MSG_GET, key: FAVORITES_KEY }, "*");
    } catch {
      /* Host nicht erreichbar – Timeout greift */
    }
  });
  return initPromise;
}

export function favoritesStorageMode(): FavoritesStorageMode {
  return mode ?? "memory";
}

export function readFavoritePlaces(): FavoritePlace[] {
  if (typeof window === "undefined") return [];
  if (mode === null) {
    // Erstzugriff vor der Initialisierung: optimistisch aus localStorage lesen.
    try {
      return sanitize(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    } catch {
      return memory;
    }
  }
  if (mode === "local") {
    try {
      return sanitize(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    } catch {
      return memory;
    }
  }
  return memory;
}

/** Duplikat-Erkennung über auf 3 Dezimalstellen gerundete Koordinaten (~100 m). */
export function isSamePlace(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return (
    Math.round(a.latitude * 1000) === Math.round(b.latitude * 1000) &&
    Math.round(a.longitude * 1000) === Math.round(b.longitude * 1000)
  );
}

function writeFavoritePlaces(next: FavoritePlace[]): FavoritePlace[] {
  memory = next;
  if (mode !== "bridge") {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* Speicher nicht verfügbar – Favoriten sind optional */
    }
  }
  if (mode === "bridge") {
    try {
      window.parent.postMessage(
        { type: MSG_SET, key: FAVORITES_KEY, value: next },
        "*",
      );
    } catch {
      /* Host nicht erreichbar */
    }
  }
  notifyChanged();
  return next;
}

export function isFavoritePlace(p: {
  latitude: number;
  longitude: number;
}): boolean {
  return readFavoritePlaces().some((f) => isSamePlace(f, p));
}

/** Fügt den Ort hinzu, wenn noch nicht vorhanden – entfernt ihn sonst. */
export function toggleFavoritePlace(p: FavoritePlace): FavoritePlace[] {
  const current = readFavoritePlaces();
  if (current.some((f) => isSamePlace(f, p))) {
    return writeFavoritePlaces(current.filter((f) => !isSamePlace(f, p)));
  }
  return writeFavoritePlaces([p, ...current].slice(0, MAX_FAVORITES));
}

export function removeFavoritePlace(p: {
  latitude: number;
  longitude: number;
}): FavoritePlace[] {
  return writeFavoritePlaces(
    readFavoritePlaces().filter((f) => !isSamePlace(f, p)),
  );
}

/**
 * Reaktiver Zugriff auf die Favoriten – synchronisiert über mehrere
 * Widgets/Karten auf derselben Seite und über Browser-Tabs hinweg.
 */
export function useFavoritePlaces() {
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  // null = noch nicht ermittelt; dann keinen Hinweis zeigen.
  const [storage, setStorage] = useState<FavoritesStorageMode | null>(() => mode);

  useEffect(() => {
    let alive = true;
    const onChanged = () => setFavorites(readFavoritePlaces());
    void initFavoritesStorage().then((m) => {
      if (!alive) return;
      setStorage(m);
      setFavorites(readFavoritePlaces());
    });
    setFavorites(readFavoritePlaces());
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onChanged);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, []);

  const toggle = useCallback((p: FavoritePlace) => {
    setFavorites(toggleFavoritePlace(p));
  }, []);
  const remove = useCallback((p: { latitude: number; longitude: number }) => {
    setFavorites(removeFavoritePlace(p));
  }, []);
  const isFavorite = useCallback(
    (p: { latitude: number; longitude: number }) =>
      favorites.some((f) => isSamePlace(f, p)),
    [favorites],
  );

  return {
    favorites,
    toggle,
    remove,
    isFavorite,
    /** true, wenn Favoriten das Neuladen überleben. */
    persistent: storage === null || storage !== "memory",
  };
}
