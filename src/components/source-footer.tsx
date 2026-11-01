import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SourceFooter({ updated, data, map, children, className }: {
  updated?: string;
  data?: string;
  map?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-2.5 text-left text-[10px] leading-relaxed text-muted-foreground", className)}>
      {updated ? <>Aktualisiert {updated} · </> : null}
      Oberthurgauer Wetter
      {data ? <> · Daten: {data}</> : null}
      {map ? <> · Karte: © <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">swisstopo</a>, © <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Esri</a></> : null}
      {children}
    </p>
  );
}