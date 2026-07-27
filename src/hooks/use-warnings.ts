/**
 * Aktive Warnungen für Client-Komponenten (Lokal- und Symbolprognose).
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWarnings, type WarningDTO } from "@/lib/warnings.functions";

export function useActiveWarnings(): WarningDTO[] {
  const fetchWarnings = useServerFn(listWarnings);
  const { data } = useQuery({
    queryKey: ["warnings", "active"],
    queryFn: () => fetchWarnings(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  return data?.warnings ?? [];
}
