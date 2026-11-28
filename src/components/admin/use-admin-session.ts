import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkAdminLogin } from "@/lib/warnings.functions";

/** Ein Speicherort für alle Redaktionsbereiche: einmal anmelden genügt. */
const KEY = "wx_warn_admin_pw";

function readStored(): string | null {
  try {
    const legacy = sessionStorage.getItem(KEY);
    if (legacy) {
      localStorage.setItem(KEY, legacy);
      sessionStorage.removeItem(KEY);
    }
    return localStorage.getItem(KEY);
  } catch {
    return null; // Speicher gesperrt (z. B. eingebettete Vorschau): normale Anmeldung zeigen.
  }
}

function writeStored(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    /* Anmeldung gilt dann nur bis zum Schliessen der Seite. */
  }
}

export function useAdminSession() {
  const check = useServerFn(checkAdminLogin);
  const [password, setPassword] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const stored = readStored();
    if (!stored) {
      setChecking(false);
      return;
    }
    check({ data: { password: stored } })
      .then(({ ok }) => {
        if (cancelled) return;
        if (ok) setPassword(stored);
        else writeStored(null);
      })
      .catch(() => {
        /* Netzwerkfehler: gespeichertes Passwort behalten, Anmeldung zeigen. */
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [check]);

  /** Liefert eine Fehlermeldung oder null bei Erfolg. */
  const login = useCallback(
    async (input: string): Promise<string | null> => {
      try {
        const { ok } = await check({ data: { password: input } });
        if (!ok) return "Falsches Passwort.";
        writeStored(input);
        setPassword(input);
        return null;
      } catch {
        return "Anmeldung momentan nicht möglich. Bitte erneut versuchen.";
      }
    },
    [check],
  );

  const logout = useCallback(() => {
    writeStored(null);
    setPassword(null);
  }, []);

  return { password, checking, login, logout };
}
