import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoAsset from '@/assets/oberthurgauer-wetter-logo.png.asset.json';

export function PublicWeatherLayout({ title, home = false, headerAction, children }: { title?: string; home?: boolean; headerAction?: ReactNode; children: ReactNode }) {
  return <div className="weather-blue min-h-svh bg-background">
    <header className="morph-header sticky top-0 z-[600] border-b border-border bg-background">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2 sm:px-8">
        {home ? <><img src={logoAsset.url} alt="Oberthurgauer Wetter Logo" width={300} height={180} className="h-auto w-32 shrink-0 sm:w-40" /><p className="min-w-0 text-sm text-muted-foreground">Wetter für deine Region</p></> : <>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-muted-foreground">Oberthurgauer Wetter</p><h1 className="break-words font-display text-base font-semibold leading-tight sm:text-lg">{title}</h1></div>
          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0 rounded-full border border-border text-foreground hover:bg-foreground/15 hover:text-foreground"><Link to="/" viewTransition aria-label="Schliessen und zur Wetterübersicht" title="Schliessen"><X className="size-6" /></Link></Button>
        </>}
        {home && headerAction && <div className="ml-auto shrink-0">{headerAction}</div>}
      </div>
    </header>
    <main className={`min-w-0 overflow-x-clip bg-background${home ? '' : ' weather-surface morph-card min-h-[calc(100svh-4rem)]'}`}>{children}</main>
  </div>;
}
