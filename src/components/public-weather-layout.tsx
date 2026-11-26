import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CloudSun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicWeatherLayout({ title, home = false, children }: { title?: string; home?: boolean; children: ReactNode }) {
  return <div className="min-h-svh bg-background">
    <header className="morph-header sticky top-0 z-[600] border-b border-accent/20 bg-card/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2 sm:px-8">
        {home ? <><CloudSun className="size-8 shrink-0 text-accent" /><div className="min-w-0"><p className="font-display text-lg font-semibold text-accent">Oberthurgauer Wetter</p><p className="text-xs text-muted-foreground">Oberthurgau · Bodensee · Alpstein</p></div></> : <>
          <Button asChild variant="outline" className="h-11 shrink-0 gap-1.5 border-accent/25 text-accent hover:bg-accent/10 hover:text-accent"><Link to="/" viewTransition aria-label="Zurück zur Wetterübersicht"><ArrowLeft className="size-4" />Übersicht</Link></Button>
          <div className="min-w-0"><p className="text-[11px] font-medium text-accent">Oberthurgauer Wetter</p><h1 className="break-words font-display text-base font-semibold leading-tight sm:text-lg">{title}</h1></div>
        </>}
      </div>
    </header>
    <main className={`min-w-0 overflow-x-clip bg-background${home ? '' : ' morph-card min-h-[calc(100svh-4rem)]'}`}>{children}</main>
  </div>;
}