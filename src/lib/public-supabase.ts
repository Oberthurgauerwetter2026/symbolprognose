import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let client: SupabaseClient<Database> | undefined;

/**
 * Browser-Zugriff ohne Benutzersitzung (Live-Aktualisierung, Upload mit signierter Adresse).
 * Die App kennt keine Benutzerkonten; ohne gespeicherte Sitzung wartet kein Aufruf auf die
 * tabübergreifende Sitzungssperre, die ein eingefrorener Tab unbegrenzt halten kann.
 */
export function publicSupabase(): SupabaseClient<Database> {
  client ??= createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  return client;
}
