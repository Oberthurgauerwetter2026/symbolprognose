import { useEffect, type ReactNode } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { shouldResumeOnHome } from '@/lib/app-home';
import { hasHomeAnchor, markHomeReturn, startDesktopHomeReturn } from '@/lib/home-return';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoAsset from '@/assets/wetter-logo-symbol.png.asset.json';

export function PublicWeatherLayout({ title, home = false, headerAction, children }: { title?: string; home?: boolean; headerAction?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    let hidden = document.visibilityState === 'hidden';
    const resume = () => {
      if (document.visibilityState === 'hidden') { hidden = true; return; }
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (hidden && shouldResumeOnHome(standalone, router.state.location.pathname)) {
        void router.navigate({ to: '/', replace: true });
      }
      hidden = false;
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, [router]);
  return <div className="weather-blue weather-page min-h-svh bg-background">
    {home && <PullToRefresh onRefresh={() => Promise.all([router.invalidate(), queryClient.invalidateQueries()])} />}
    <header className="morph-header weather-header sticky top-0 z-[600]">
      <div className={`mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2 sm:px-8${home ? ' lg:max-w-7xl' : ''}`}>
        {home ? <><img src={logoAsset.url} alt="Oberthurgauer Wetter Logo" width={122} height={105} className="h-auto w-12 shrink-0 sm:w-16" /><div className="min-w-0"><p className="break-words font-display text-base font-semibold leading-tight sm:text-xl">Oberthurgauer Wetter</p><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Wetter für deine Region</p></div></> : <>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-muted-foreground">Oberthurgauer Wetter</p><h1 className="break-words font-display text-base font-semibold leading-tight sm:text-lg">{title}</h1></div>
          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0 rounded-full border border-border text-foreground hover:bg-foreground/15 hover:text-foreground"><Link to="/" viewTransition resetScroll={!hasHomeAnchor()} onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (window.matchMedia('(min-width: 1024px)').matches) {
              event.preventDefault();
              const resetScroll = !hasHomeAnchor();
              startDesktopHomeReturn(() => router.navigate({ to: '/', viewTransition: false, resetScroll }));
            } else markHomeReturn();
          }} aria-label="Schliessen und zur Wetterübersicht" title="Schliessen"><X className="size-6" /></Link></Button>
        </>}
        {home && headerAction && <div className="ml-auto shrink-0">{headerAction}</div>}
      </div>
    </header>
    <main className={`weather-main min-w-0 overflow-x-clip${home ? '' : ' weather-detail morph-card min-h-[calc(100svh-4rem)]'}`}>{children}</main>
  </div>;
}
