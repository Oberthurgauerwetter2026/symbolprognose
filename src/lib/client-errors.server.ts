import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ClientErrorInput {
  kind: string;
  message: string;
  stack?: string | null;
  route?: string | null;
  detail?: string | null;
  userAgent?: string | null;
  memoryMb?: number | null;
}

export interface ClientErrorRow {
  id: string;
  created_at: string;
  kind: string;
  message: string;
  stack: string | null;
  route: string | null;
  detail: string | null;
  user_agent: string | null;
  memory_mb: number | null;
}

const clip = (v: string | null | undefined, max: number) =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;

/** Schreibt eine Absturzmeldung mit dem Dienst-Schlüssel (Tabelle ist gesperrt). */
export async function insertClientError(input: ClientErrorInput): Promise<void> {
  const sb = supabaseAdmin as unknown as {
    from: (t: string) => { insert: (v: unknown) => Promise<{ error: { message: string } | null }> };
  };
  await sb.from("client_errors").insert({
    kind: clip(input.kind, 40) ?? "unknown",
    message: clip(input.message, 500) ?? "(ohne Meldung)",
    stack: clip(input.stack, 4000),
    route: clip(input.route, 300),
    detail: clip(input.detail, 1000),
    user_agent: clip(input.userAgent, 400),
    memory_mb:
      typeof input.memoryMb === "number" && Number.isFinite(input.memoryMb)
        ? Math.round(input.memoryMb)
        : null,
  });
}

/** Letzte Absturzmeldungen für den Adminbereich. */
export async function readClientErrors(limit = 50): Promise<ClientErrorRow[]> {
  const sb = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (
          c: string,
          o: { ascending: boolean },
        ) => { limit: (n: number) => Promise<{ data: ClientErrorRow[] | null; error: unknown }> };
      };
    };
  };
  const { data } = await sb
    .from("client_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  return data ?? [];
}

/** Alle Meldungen löschen (Adminbereich). */
export async function clearClientErrors(): Promise<void> {
  const sb = supabaseAdmin as unknown as {
    from: (t: string) => {
      delete: () => { neq: (c: string, v: string) => Promise<{ error: unknown }> };
    };
  };
  await sb.from("client_errors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
