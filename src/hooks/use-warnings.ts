/**
 * Aktive Warnungen für Client-Komponenten (Lokal- und Symbolprognose).
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listWarnings, type WarningDTO } from "@/lib/warnings.functions";

/**
 * Live-Aktualisierung: Änderungen an Warnungen sofort in alle Karten übernehmen.
 * Invalidiert den Query-Key ["warnings"] (deckt auch ["warnings","active"] ab).
 */
export function useWarningsRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["warnings"] });
      }, 300);
    };

    const channel = supabase
      .channel(`warnings-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "warnings" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "warning_regions" }, bump)
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useActiveWarnings(): WarningDTO[] {
  const fetchWarnings = useServerFn(listWarnings);
  useWarningsRealtime();
  const { data } = useQuery({
    queryKey: ["warnings", "active"],
    queryFn: () => fetchWarnings(),
    staleTime: 0,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    gcTime: 30 * 60 * 1000,
  });
  return data?.warnings ?? [];
}
