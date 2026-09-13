/**
 * Orts-Favoriten für die Lokalprognose (und Regionskarte).
 * Browserbasiert in localStorage – kein Konto nötig.
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

export function readFavoritePlaces(): FavoritePlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
    return Array.isArray(arr) ? arr.filter(isValid).slice(0, MAX_FAVORITES) : [];
  } catch {
    return [];
  }
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
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    /* Speicher nicht verfügbar – Favoriten sind optional */
  }
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

  useEffect(() => {
    setFavorites(readFavoritePlaces());
    const onChanged = () => setFavorites(readFavoritePlaces());
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onChanged);
    return () => {
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

  return { favorites, toggle, remove, isFavorite };
}
