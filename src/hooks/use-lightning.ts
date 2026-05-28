import { useEffect, useRef, useState } from "react";

/**
 * Echtzeit-Blitzdaten vom Blitzortung.org-Community-Netz.
 *
 * Blitzortung stellt seine Live-Daten über einen WebSocket bereit, der
 * LZW-komprimierte JSON-Nachrichten sendet. Die Nutzung ist laut deren Lizenz
 * für **private / nicht-kommerzielle** Zwecke mit Quellenangabe erlaubt.
 * Jeder Treffer wird hier auf die übergebene Bounding-Box und auf ein
 * Zeitfenster (Default 60 min) gefiltert.
 *
 * Der Hook verbindet sich nur, wenn `enabled === true`, und trennt die
 * Verbindung sauber, sobald der Layer aus ist oder die Komponente unmountet.
 */

export interface LightningStrike {
  /** Eindeutige ID (Zeit in ns + Position). */
  id: string;
  lat: number;
  lon: number;
  /** Zeitpunkt in ms (Unix). */
  time: number;
}

interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// Blitzortung WebSocket-Endpunkte (Round-Robin ws1…ws8).
const WS_HOSTS = [
  "wss://ws1.blitzortung.org/",
  "wss://ws3.blitzortung.org/",
  "wss://ws7.blitzortung.org/",
  "wss://ws8.blitzortung.org/",
];

/**
 * Dekodiert die von Blitzortung gesendeten LZW-komprimierten Strings.
 * (Standard-LZW-Variante, wie sie der Live-Feed verwendet.)
 */
function lzwDecode(input: string): string {
  const dict: Record<number, string> = {};
  const data = input.split("");
  let currChar = data[0];
  let oldPhrase = currChar;
  const out: string[] = [currChar];
  let code = 256;
  let phrase: string;
  for (let i = 1; i < data.length; i++) {
    const currCode = data[i].charCodeAt(0);
    if (currCode < 256) {
      phrase = data[i];
    } else {
      phrase = dict[currCode] ? dict[currCode] : oldPhrase + currChar;
    }
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict[code] = oldPhrase + currChar;
    code++;
    oldPhrase = phrase;
  }
  return out.join("");
}

export function useLightning(
  enabled: boolean,
  bbox: Bbox,
  windowMin = 60,
): LightningStrike[] {
  const [strikes, setStrikes] = useState<LightningStrike[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostIdxRef = useRef(0);
  const bboxRef = useRef(bbox);
  bboxRef.current = bbox;

  useEffect(() => {
    if (!enabled) {
      setStrikes([]);
      return;
    }
    let closed = false;

    const connect = () => {
      if (closed) return;
      const host = WS_HOSTS[hostIdxRef.current % WS_HOSTS.length];
      hostIdxRef.current += 1;
      let ws: WebSocket;
      try {
        ws = new WebSocket(host);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        // Subscribe-Befehl des Blitzortung-Live-Feeds.
        try {
          ws.send(JSON.stringify({ a: 111 }));
        } catch {
          /* ignore */
        }
      };

      ws.onmessage = (ev) => {
        let text: string;
        try {
          text = lzwDecode(ev.data as string);
        } catch {
          return;
        }
        let msg: { time?: number; lat?: number; lon?: number };
        try {
          msg = JSON.parse(text);
        } catch {
          return;
        }
        if (
          typeof msg.lat !== "number" ||
          typeof msg.lon !== "number" ||
          typeof msg.time !== "number"
        ) {
          return;
        }
        const b = bboxRef.current;
        if (
          msg.lat < b.minLat ||
          msg.lat > b.maxLat ||
          msg.lon < b.minLon ||
          msg.lon > b.maxLon
        ) {
          return;
        }
        // Blitzortung `time` ist in Nanosekunden.
        const tMs = msg.time / 1e6;
        const strike: LightningStrike = {
          id: `${msg.time}-${msg.lat.toFixed(4)}-${msg.lon.toFixed(4)}`,
          lat: msg.lat,
          lon: msg.lon,
          time: tMs,
        };
        setStrikes((prev) => {
          if (prev.some((s) => s.id === strike.id)) return prev;
          const cutoff = Date.now() - windowMin * 60_000;
          const next = [...prev, strike].filter((s) => s.time >= cutoff);
          // Sicherheitslimit gegen Speicher-Wachstum bei Gewitter.
          return next.length > 2000 ? next.slice(next.length - 2000) : next;
        });
      };

      ws.onclose = () => {
        if (!closed) scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    const scheduleReconnect = () => {
      if (closed || reconnectRef.current) return;
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        connect();
      }, 3000);
    };

    connect();

    // Periodisches Aufräumen alter Treffer (auch ohne neue Nachrichten).
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - windowMin * 60_000;
      setStrikes((prev) => {
        const next = prev.filter((s) => s.time >= cutoff);
        return next.length === prev.length ? prev : next;
      });
    }, 30_000);

    return () => {
      closed = true;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      clearInterval(cleanup);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      setStrikes([]);
    };
  }, [enabled, windowMin]);

  return strikes;
}
