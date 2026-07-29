import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import {
  HAZARDS,
  LEVELS,
  REGIONS,
  REGION_GROUPS,
  TEMPLATES,
  templateImpact,
  fillTemplate,

  getHazard,
  regionName,
  warningTitle,
  formatRange,
  type HazardId,
  type WarnLevel,
} from "@/lib/warnings-config";
import {
  adminListWarnings,
  checkAdminLogin,
  saveWarning,
  setWarningActive,
  deleteWarning,
  type WarningDTO,
} from "@/lib/warnings.functions";

const STORAGE_KEY = "wx_warn_admin_pw";

export const Route = createFileRoute("/admin-warnungen")({
  ssr: false,
  component: WarnAdminPage,
  head: () => ({
    meta: [
      { title: "Warnungen verwalten · Oberthurgauer Wetter" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function WarnAdminPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setPassword(stored);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { ok } = await checkAdminLogin({ data: { password: pw } });
      if (!ok) throw new Error("Falsches Passwort.");
      sessionStorage.setItem(STORAGE_KEY, pw);
      setPassword(pw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  if (!password) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">Warnungen · Admin</h1>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Passwort"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-foreground py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            {busy ? "Prüfe…" : "Entsperren"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <WarnAdminDashboard
      password={password}
      onLogout={() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setPassword(null);
        setPw("");
      }}
    />
  );
}

function nowLocal(offsetHours = 0): string {
  const d = new Date(Date.now() + offsetHours * 3600_000);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** „20“ + „40“ → „20 bis 40“; nur ein Wert → dieser Wert. */
function combineValue(from: string, to: string): string {
  const a = from.trim();
  const b = to.trim();
  if (a && b) return a === b ? a : `${a} bis ${b}`;
  return a || b;
}

function splitValue(v: string | null | undefined): { from: string; to: string } {
  const s = (v ?? "").trim();
  const m = s.match(/^(.+?)\s*(?:bis|–|-|\.\.\.)\s*(.+)$/);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
  return { from: s, to: "" };
}

interface FormState {
  id: string | null;
  hazard: HazardId;
  level: WarnLevel;
  validFrom: string;
  validTo: string;
  valueFrom: string;
  valueTo: string;
  title: string;
  description: string;
  impact: string;
  regionIds: string[];
  active: boolean;
}

/** Vorlagentexte für eine Kombination aus Gefahr, Stufe und Messwert. */
function genTexts(hazard: HazardId, level: WarnLevel, value: string) {
  const tpl = TEMPLATES[hazard][level];
  return {
    title: warningTitle(hazard, level),
    description: fillTemplate(tpl.description, value),
    impact: templateImpact(tpl),
  };
}

function emptyForm(): FormState {
  const t = genTexts("gewitter", 1, "");
  return {
    id: null,
    hazard: "gewitter",
    level: 1,
    validFrom: nowLocal(),
    validTo: nowLocal(6),
    valueFrom: "",
    valueTo: "",
    title: t.title,
    description: t.description,
    impact: t.impact,

    regionIds: [],
    active: true,
  };
}


function WarnAdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const [items, setItems] = useState<WarningDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** Zuletzt automatisch erzeugte Texte – zum Erkennen manueller Änderungen. */
  const [lastTpl, setLastTpl] = useState(() => genTexts("gewitter", 1, ""));

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListWarnings({ data: { password } });
      setItems(res.warnings);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  /** Vorlage anwenden, solange die Texte nicht manuell verändert wurden. */
  /** True, sobald die Texte von der zuletzt erzeugten Vorlage abweichen. */
  const textIsManual =
    form.title !== lastTpl.title ||
    form.description !== lastTpl.description ||
    form.impact !== lastTpl.impact;

  /** Vorlage anwenden, solange die Texte nicht manuell verändert wurden. */
  const applyTemplate = (
    hazard: HazardId,
    level: WarnLevel,
    valueFrom: string,
    valueTo: string,
    force = false,
  ) => {
    const t = genTexts(hazard, level, combineValue(valueFrom, valueTo));
    const useTpl = force || !textIsManual;
    setLastTpl(t);
    setForm((f) => ({
      ...f,
      hazard,
      level,
      valueFrom,
      valueTo,
      title: useTpl ? t.title : f.title,
      description: useTpl ? t.description : f.description,
      impact: useTpl ? t.impact : f.impact,
    }));
  };


  /** Beginn setzen und Ende relativ dazu halten. */
  const setStart = (d: Date) => {
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
    setForm((f) => {
      const prevFrom = new Date(f.validFrom).getTime();
      const prevTo = new Date(f.validTo).getTime();
      const span = Number.isFinite(prevFrom) && Number.isFinite(prevTo) && prevTo > prevFrom
        ? prevTo - prevFrom
        : 6 * 3600_000;
      return {
        ...f,
        validFrom: toLocalInput(d),
        validTo: toLocalInput(new Date(d.getTime() + span)),
      };
    });
  };

  const setDuration = (hours: number) => {
    setForm((f) => {
      const from = new Date(f.validFrom);
      if (Number.isNaN(from.getTime())) return f;
      return { ...f, validTo: toLocalInput(new Date(from.getTime() + hours * 3600_000)) };
    });
  };


  const preview = useMemo(() => LEVELS[form.level], [form.level]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.regionIds.length) {
      setMsg("Bitte mindestens eine Gemeinde auswählen.");
      return;
    }
    if (![1, 2, 3].includes(form.level)) {
      setMsg("Bitte eine gültige Warnstufe wählen.");
      return;
    }
    setSaving(true);
    try {
      await saveWarning({
        data: {
          password,
          id: form.id,
          hazard: form.hazard,
          level: form.level,
          validFrom: new Date(form.validFrom).toISOString(),
          validTo: new Date(form.validTo).toISOString(),
          title: form.title,
          description: form.description,
          impact: form.impact,
          value: combineValue(form.valueFrom, form.valueTo) || null,
          regionIds: form.regionIds,
          active: form.active,
        },
      });
      setForm(emptyForm());
      setLastTpl(genTexts("gewitter", 1, ""));
      setMsg("Gespeichert.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const edit = (w: WarningDTO) => {
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    setLastTpl(
      genTexts(
        w.hazard as HazardId,
        w.level as WarnLevel,
        combineValue(splitValue(w.value).from, splitValue(w.value).to),
      ),
    );
    setForm({
      id: w.id,
      hazard: w.hazard as HazardId,
      level: w.level as WarnLevel,
      validFrom: toLocal(w.validFrom),
      validTo: toLocal(w.validTo),
      valueFrom: splitValue(w.value).from,
      valueTo: splitValue(w.value).to,
      title: w.title,
      description: w.description,
      impact: w.impact,
      regionIds: w.regionIds,
      active: w.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-muted px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wetterwarnungen</h1>
            <p className="text-sm text-muted-foreground">Warnungen für die Gemeinden im Oberthurgau erfassen.</p>
          </div>
          <button type="button" onClick={onLogout} className="text-xs text-muted-foreground underline">
            Abmelden
          </button>
        </header>

        <IngestSection password={password} />



        {/* Formular */}
        <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Plus className="h-4 w-4" /> {form.id ? "Warnung bearbeiten" : "Neue Warnung"}
          </h2>

          <div>
            <p className="mb-1.5 text-xs font-medium">Gefahrenart</p>
            <div className="flex flex-wrap gap-1.5">
              {HAZARDS.map((h) => {
                const Icon = h.icon;
                const on = form.hazard === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => applyTemplate(h.id, form.level, form.valueFrom, form.valueTo)}
                    className={
                      "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs " +
                      (on ? "border-foreground bg-foreground text-background" : "border-border")
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium">Warnstufe</p>
            <div className="flex flex-wrap gap-1.5">
              {([1, 2, 3] as WarnLevel[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => applyTemplate(form.hazard, l, form.valueFrom, form.valueTo)}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  style={
                    form.level === l
                      ? { background: LEVELS[l].color, color: LEVELS[l].textOnColor, borderColor: LEVELS[l].color }
                      : { borderColor: LEVELS[l].color, color: LEVELS[l].color }
                  }
                >
                  {LEVELS[l].label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium">Gültigkeit</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <span className="self-center text-[11px] text-muted-foreground">Beginn:</span>
              {[
                { label: "Jetzt", h: 0 },
                { label: "in 1 Std.", h: 1 },
                { label: "in 3 Std.", h: 3 },
                { label: "Morgen 06:00", h: -1 },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    if (c.h >= 0) setStart(new Date(Date.now() + c.h * 3600_000));
                    else {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(6, 0, 0, 0);
                      setStart(d);
                    }
                  }}
                  className="rounded-md border border-border px-2 py-1 text-[11px]"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <span className="self-center text-[11px] text-muted-foreground">Dauer:</span>
              {[3, 6, 12, 24, 48].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDuration(h)}
                  className="rounded-md border border-border px-2 py-1 text-[11px]"
                >
                  {h} Std.
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">
                Gültig von
                <input
                  type="datetime-local"
                  required
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-medium">
                Gültig bis
                <input
                  type="datetime-local"
                  required
                  value={form.validTo}
                  onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium">
              {getHazard(form.hazard).paramLabel} ({getHazard(form.hazard).paramUnit}) – optional
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">
                von
                <input
                  inputMode="decimal"
                  value={form.valueFrom}
                  placeholder={getHazard(form.hazard).paramPlaceholder}
                  onChange={(e) =>
                    applyTemplate(form.hazard, form.level, e.target.value, form.valueTo)
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-medium">
                bis
                <input
                  inputMode="decimal"
                  value={form.valueTo}
                  placeholder="optional"
                  onChange={(e) =>
                    applyTemplate(form.hazard, form.level, form.valueFrom, e.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          </div>


          <div>
            <p className="mb-1.5 text-xs font-medium">Betroffene Gemeinden</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REGION_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, regionIds: g.regionIds }))}
                  className="rounded-md border border-border px-2 py-1 text-[11px]"
                >
                  {g.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, regionIds: [] }))}
                className="rounded-md border border-border px-2 py-1 text-[11px]"
              >
                Keine
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {REGIONS.map((r) => {
                const on = form.regionIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        regionIds: on ? f.regionIds.filter((x) => x !== r.id) : [...f.regionIds, r.id],
                      }))
                    }
                    className={
                      "rounded px-2 py-1 text-[11px] " +
                      (on ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
                    }
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {textIsManual && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs sm:col-span-2">
                <span className="text-muted-foreground">
                  Texte wurden manuell angepasst – sie folgen den Mengenangaben nicht mehr
                  automatisch.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(form.hazard, form.level, form.valueFrom, form.valueTo, true)
                  }
                  className="rounded-md border border-input bg-background px-2 py-1 font-medium"
                >
                  Text aus Vorlage neu erzeugen
                </button>
              </div>
            )}
            <label className="text-xs font-medium sm:col-span-2">
              Titel
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium">
              Beschreibung
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium">
              Mögliche Auswirkungen
              <textarea
                rows={4}
                value={form.impact}
                onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>


          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Sofort aktiv (löst Push-Benachrichtigung aus)
            </label>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: preview.color, color: preview.textOnColor }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? "Änderungen speichern" : "Warnung veröffentlichen"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm());
                  setLastTpl(genTexts("gewitter", 1, ""));
                }}
                className="text-xs underline"
              >
                Abbrechen
              </button>
            )}
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </form>

        {/* Liste */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Erfasste Warnungen
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Warnungen erfasst.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((w) => {
                const h = getHazard(w.hazard as HazardId);
                const Icon = h.icon;
                const def = LEVELS[w.level as WarnLevel];
                const expired = new Date(w.validTo).getTime() < Date.now();
                return (
                  <li key={w.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold"
                        style={{ background: def.color, color: def.textOnColor }}
                      >
                        <Icon className="h-3.5 w-3.5" /> {w.title || warningTitle(w.hazard as HazardId, w.level as WarnLevel)}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatRange(w.validFrom, w.validTo)}</span>
                      {!w.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">inaktiv</span>}
                      {expired && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">abgelaufen</span>}
                      {w.source === "auto" && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">automatisch</span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => edit(w)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await setWarningActive({ data: { password, id: w.id, active: !w.active } });
                            await load();
                          }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {w.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {w.active ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Warnung löschen?")) return;
                            await deleteWarning({ data: { password, id: w.id } });
                            await load();
                          }}
                          className="flex items-center gap-1 text-xs text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Löschen
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-foreground">{w.description}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {w.regionIds.map((r) => regionName(r)).join(", ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
