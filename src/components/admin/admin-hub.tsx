import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, LogOut, Newspaper, Radio, TriangleAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_TABS, type AdminTab } from "@/lib/admin-tabs";
import { useAdminSession } from "./use-admin-session";

const TickerPanel = lazy(() => import("./ticker-panel").then((m) => ({ default: m.TickerPanel })));
const ReportPanel = lazy(() => import("./report-panel"));
const WarnAdminPanel = lazy(() => import("./warnings-panel").then((m) => ({ default: m.WarnAdminPanel })));
const ToolsPanel = lazy(() => import("./tools-panel"));

const TAB_INFO: Record<AdminTab, { label: string; icon: typeof Radio }> = {
  ticker: { label: "Ticker", icon: Radio },
  bericht: { label: "Bericht", icon: Newspaper },
  warnungen: { label: "Warnungen", icon: TriangleAlert },
  werkzeuge: { label: "Werkzeuge", icon: Wrench },
};

/** Ein Redaktions-Tool für alle Inhalte: eine Anmeldung, vier Bereiche. */
export function AdminHub({ tab, onTab }: { tab: AdminTab; onTab: (tab: AdminTab) => void }) {
  const { password, checking, login, logout } = useAdminSession();
  // Einmal geöffnete Bereiche bleiben geladen, damit angefangene Texte beim Wechseln nicht verloren gehen.
  const [opened, setOpened] = useState<AdminTab[]>([tab]);
  useEffect(() => {
    setOpened((list) => (list.includes(tab) ? list : [...list, tab]));
  }, [tab]);

  if (checking) {
    return <div className="grid min-h-svh place-items-center bg-muted px-4"><p className="text-sm text-muted-foreground">Anmeldung wird geprüft …</p></div>;
  }
  if (!password) return <LoginForm login={login} />;

  return (
    <div className="min-h-svh bg-muted">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-accent">Oberthurgauer Wetter</p>
            <h1 className="truncate text-lg font-semibold">Redaktion</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="ghost" size="icon" title="Wetterseite ansehen" aria-label="Wetterseite ansehen"><Link to="/"><ExternalLink /></Link></Button>
            <Button variant="ghost" size="icon" title="Abmelden" aria-label="Abmelden" onClick={logout}><LogOut /></Button>
          </div>
        </div>
        <nav aria-label="Redaktionsbereiche" className="mx-auto grid max-w-7xl grid-cols-4 px-2">
          {ADMIN_TABS.map((id) => {
            const { label, icon: Icon } = TAB_INFO[id];
            const active = id === tab;
            return (
              <button key={id} type="button" aria-current={active ? "page" : undefined} onClick={() => onTab(id)}
                className={`flex min-w-0 flex-col items-center gap-0.5 border-b-2 px-1 py-2 text-xs font-medium sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${active ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="size-5 shrink-0 sm:size-4" /><span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </header>
        {opened.includes("ticker") && <Pane active={tab === "ticker"}><TickerPanel password={password} /></Pane>}
        {opened.includes("bericht") && <Pane active={tab === "bericht"}><ReportPanel password={password} /></Pane>}
        {opened.includes("warnungen") && <Pane active={tab === "warnungen"}><WarnAdminPanel password={password} /></Pane>}
        {opened.includes("werkzeuge") && <Pane active={tab === "werkzeuge"}><ToolsPanel password={password} /></Pane>}
    </div>
  );
}

/**
 * Inaktive Bereiche bleiben mit voller Breite im Layout (nur unsichtbar und ohne Höhe),
 * weil Leaflet-Karten in einem `display: none`-Container falsch gezeichnet werden.
 * Jeder Bereich hat seine eigene Ladegrenze, damit das Nachladen eines Bereichs die Karten der anderen nicht neu aufbaut.
 */
function Pane({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div inert={!active} aria-hidden={!active} className={active ? undefined : "invisible h-0 overflow-hidden"}>
      <Suspense fallback={<p className="px-4 py-10 text-center text-sm text-muted-foreground">Bereich wird geladen …</p>}>{children}</Suspense>
    </div>
  );
}

function LoginForm({ login }: { login: (password: string) => Promise<string | null> }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError((await login(input)) ?? "");
    setBusy(false);
  };
  return (
    <main className="grid min-h-svh place-items-center bg-muted px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div><p className="text-xs font-semibold text-accent">Oberthurgauer Wetter</p><h1 className="mt-1 text-2xl font-semibold">Redaktion</h1></div>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="admin-password">Admin-Passwort</label>
          <Input id="admin-password" type="password" autoComplete="current-password" autoFocus required value={input} onChange={(e) => setInput(e.target.value)} className="h-12 text-base" />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full bg-accent text-accent-foreground">{busy ? "Anmelden …" : "Anmelden"}</Button>
      </form>
    </main>
  );
}
