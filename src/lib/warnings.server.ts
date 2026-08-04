/**
 * Server-seitige Helfer für die Wetterwarnungen.
 * Nur in Server-Funktionen / Server-Routen importieren.
 */

import { createClient } from "@supabase/supabase-js";

export interface WarningRow {
  id: string;
  hazard: string;
  level: number;
  valid_from: string;
  valid_to: string;
  title: string | null;
  description: string;
  impact: string;
  peak_phase: string | null;
  params: Record<string, unknown>;
  active: boolean;
  source: string;
  advisory: boolean;
  auto_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarningWithRegions extends WarningRow {
  regionIds: string[];
}

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Die generierten Typen kennen die Warn-Tabellen (noch) nicht.
  return supabaseAdmin as unknown as ReturnType<typeof publicClient>;
}

function attachRegions(
  rows: WarningRow[],
  links: { warning_id: string; region_id: string }[],
): WarningWithRegions[] {
  const byId = new Map<string, string[]>();
  for (const l of links) {
    const arr = byId.get(l.warning_id) ?? [];
    arr.push(l.region_id);
    byId.set(l.warning_id, arr);
  }
  return rows.map((r) => ({ ...r, regionIds: byId.get(r.id) ?? [] }));
}

/** Öffentliche Sicht: nur aktive, noch gültige Warnungen. */
export async function readActiveWarnings(): Promise<WarningWithRegions[]> {
  const sb = publicClient();
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await sb
    .from("warnings")
    .select("*")
    .eq("active", true)
    .gt("valid_to", nowIso)
    .order("level", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => (r as WarningRow).id);
  if (ids.length === 0) return [];
  const { data: links, error: e2 } = await sb
    .from("warning_regions")
    .select("warning_id, region_id")
    .in("warning_id", ids);
  if (e2) throw new Error(e2.message);
  return attachRegions((rows ?? []) as WarningRow[], (links ?? []) as { warning_id: string; region_id: string }[]);
}

/**
 * Abgelaufene Warnungen automatisch beenden (unabhängig von der Quelle).
 * Gibt die Anzahl der deaktivierten Warnungen zurück.
 */
export async function deactivateExpired(): Promise<number> {
  const sb = await adminClient();
  const { data, error } = await sb
    .from("warnings")
    .update({ active: false })
    .eq("active", true)
    .lt("valid_to", new Date().toISOString())
    .select("id");
  if (error) return 0;
  return (data ?? []).length;
}

/** Admin-Sicht: alles, auch inaktive und abgelaufene Warnungen. */
export async function readAllWarnings(): Promise<WarningWithRegions[]> {
  const sb = await adminClient();
  const { data: rows, error } = await sb
    .from("warnings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => (r as WarningRow).id);
  if (ids.length === 0) return [];
  const { data: links } = await sb.from("warning_regions").select("warning_id, region_id").in("warning_id", ids);
  return attachRegions((rows ?? []) as WarningRow[], (links ?? []) as { warning_id: string; region_id: string }[]);
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.WARN_ADMIN_PASSWORD;
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function assertAdmin(password: string) {
  if (!checkAdminPassword(password)) throw new Error("Nicht autorisiert");
}

export async function setWarningRegions(warningId: string, regionIds: string[]) {
  const sb = await adminClient();
  await sb.from("warning_regions").delete().eq("warning_id", warningId);
  const unique = Array.from(new Set(regionIds)).filter(Boolean);
  if (unique.length) {
    const { error } = await sb
      .from("warning_regions")
      .insert(unique.map((region_id) => ({ warning_id: warningId, region_id })));
    if (error) throw new Error(error.message);
  }
}
