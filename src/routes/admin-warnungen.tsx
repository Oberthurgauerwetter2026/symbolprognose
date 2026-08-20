import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import {
  HAZARDS,
  LEVELS,
  REGIONS,
  REGION_GROUPS,
  TEMPLATES,
  ADVISORY_TEMPLATES,
  templateImpact,
  fillTemplate,

  getHazard,
  regionName,
  warningTitle,
  formatRange,
  THRESHOLDS,
  thresholdRowFor,
  suggestLevel,
  THUNDER_RAIN_MMH,
  type HazardId,
  type WarnLevel,
} from "@/lib/warnings-config";
import {
  adminListWarnings,
  checkAdminLogin,
  saveWarning,
  setWarningActive,
  setWarningAdvisory,
  deleteWarning,
  deleteArchivedWarnings,
  type WarningDTO,
} from "@/lib/warnings.functions";
import {
  adminListClientErrors,
  adminClearClientErrors,
} from "@/lib/client-errors.functions";
import {
  getAutoThunderStatus,
  runAutoThunderNow,
  getPipelineHealth,
  getCronWorkerStatus,
  type AutoThunderStatus,
  type PipelineHealth,
  type CronWorkerStatus,

} from "@/lib/ingest-admin.functions";
import { WarnMap } from "@/components/maps/warn-map";

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
  if (b) return `bis ${b}`;
  return a;
}

function splitValue(v: string | null | undefined): { from: string; to: string } {
  const s = (v ?? "").trim();
  const only = s.match(/^bis\s+(.+)$/i);
  if (only) return { from: "", to: only[1].trim() };
  const m = s.match(/^(.+?)\s*(?:bis|–|-|\.\.\.)\s*(.+)$/);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
  return { from: s, to: "" };
}

/** Dauer der Gültigkeit in Stunden (für den Zeitbaustein im Text). */
function hoursBetween(from: string, to: string): number | null {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return (b - a) / 3600_000;
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
  peakPhase: string;
  regionIds: string[];
  active: boolean;
  advisory: boolean;
}

/** Vorlagentexte für Gefahr, Stufe, Messwert und Gültigkeitsdauer. */
function genTexts(
  hazard: HazardId,
  level: WarnLevel,
  value: string,
  durationHours?: number | null,
  advisory = false,
) {
  const tpl = advisory ? ADVISORY_TEMPLATES[hazard][level] : TEMPLATES[hazard][level];
  const description = advisory
    ? tpl.description
    : fillTemplate(tpl.description, value, durationHours);
  return {
    title: warningTitle(hazard, level, advisory),
    description,
    impact: advisory ? "" : templateImpact(tpl),
  };

}

function emptyForm(): FormState {
  const t = genTexts("gewitter", 1, "", 6);

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
    peakPhase: "",
    regionIds: [],
    active: true,
    advisory: false,
  };
}


function WarnAdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const [items, setItems] = useState<WarningDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  /** Zuletzt automatisch erzeugte Texte – zum Erkennen manueller Änderungen. */
  const [lastTpl, setLastTpl] = useState(() => genTexts("gewitter", 1, "", 6));
  /** Erhöht sich nach jedem Laden — erzwingt eine frische Kartenvorschau. */
  const [previewKey, setPreviewKey] = useState(0);

  /** Laufende Warnungen (aktiv und noch gültig) vs. Archiv. */
  const current = useMemo(
    () => items.filter((w) => w.active && new Date(w.validTo).getTime() >= Date.now()),
    [items],
  );
  const archived = useMemo(
    () => items.filter((w) => !w.active || new Date(w.validTo).getTime() < Date.now()),
    [items],
  );


  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListWarnings({ data: { password } });
      setItems(res.warnings);
      setPreviewKey((k) => k + 1);
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
    advisory = form.advisory,
  ) => {
    const t = genTexts(
      hazard,
      level,
      combineValue(valueFrom, valueTo),
      hoursBetween(form.validFrom, form.validTo),
      advisory,
    );
    const useTpl = force || !textIsManual;
    setLastTpl(t);
    setForm((f) => ({
      ...f,
      hazard,
      level,
      valueFrom,
      valueTo,
      advisory,
      title: useTpl ? t.title : f.title,
      description: useTpl ? t.description : f.description,
      impact: useTpl ? t.impact : f.impact,
    }));
  };

  /** Zeitbaustein im Text nachführen, wenn sich die Gültigkeit ändert. */
  useEffect(() => {
    if (textIsManual) return;
    const t = genTexts(
      form.hazard,
      form.level,
      combineValue(form.valueFrom, form.valueTo),
      hoursBetween(form.validFrom, form.validTo),
      form.advisory,
    );
    if (t.description === form.description && t.title === form.title) return;
    setLastTpl(t);
    setForm((f) => ({ ...f, title: t.title, description: t.description, impact: t.impact }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.validFrom, form.validTo]);



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
          peakPhase: form.peakPhase || null,
          value: combineValue(form.valueFrom, form.valueTo) || null,
          regionIds: form.regionIds,
          active: form.active,
          advisory: form.advisory,
        },
      });
      setForm(emptyForm());
      setLastTpl(genTexts("gewitter", 1, "", 6));
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
        hoursBetween(toLocal(w.validFrom), toLocal(w.validTo)),
        w.advisory,
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
      peakPhase: w.peakPhase ?? "",
      regionIds: w.regionIds,
      active: w.active,
      advisory: w.advisory,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-muted px-4 py-8 text-base">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Wetterwarnungen</h1>
            <p className="text-base text-muted-foreground">Warnungen für die Gemeinden im Oberthurgau erfassen.</p>
          </div>
          <button type="button" onClick={onLogout} className="text-sm text-muted-foreground underline">
            Abmelden
          </button>
        </header>


        <MapPreviewSection refreshKey={previewKey} />

        <AutoThunderSection password={password} />
        <PipelineHealthSection password={password} />
        <ClientErrorsSection password={password} />



        {/* Formular */}
        <form onSubmit={submit} className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
            <Plus className="h-5 w-5" /> {form.id ? "Warnung bearbeiten" : "Neue Warnung"}
          </h2>

          <div>
            <p className="mb-2 text-sm font-semibold">Gefahrenart</p>
            <div className="flex flex-wrap gap-2">
              {HAZARDS.map((h) => {
                const Icon = h.icon;
                const on = form.hazard === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => applyTemplate(h.id, form.level, form.valueFrom, form.valueTo)}
                    className={
                      "flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-base " +
                      (on ? "border-foreground bg-foreground text-background" : "border-border")
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Warnstufe</p>
            <div className="flex flex-wrap gap-2">
              {([1, 2, 3] as WarnLevel[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => applyTemplate(form.hazard, l, form.valueFrom, form.valueTo)}
                  className="rounded-md border px-4 py-2.5 text-base font-medium"
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

          {(() => {
            const th = THRESHOLDS[form.hazard];
            const hrs = hoursBetween(form.validFrom, form.validTo);
            const row = thresholdRowFor(form.hazard, hrs);
            const sug = suggestLevel(form.hazard, form.valueTo || form.valueFrom, hrs);
            return (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="mb-2 font-semibold">Schwellen</p>
                {th.rows.length ? (
                  <div className="mb-2 space-y-1.5">
                    {th.rows.map((r) => {
                      const active = row === r;
                      return (
                        <div
                          key={`${r.hours ?? "fix"}-${r.unit ?? th.unit}`}
                          className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${
                            active ? "border-foreground/40 bg-background" : "border-transparent"
                          }`}
                        >
                          <span className="min-w-[9rem] text-xs font-semibold text-muted-foreground">
                            {r.periodLabel}
                            {r.own ? " (eigene Setzung)" : ""}
                          </span>
                          {([1, 2, 3] as WarnLevel[]).map((l) => (
                            <span
                              key={l}
                              className="rounded px-2 py-1 text-xs font-semibold"
                              style={{ background: LEVELS[l].color, color: LEVELS[l].textOnColor }}
                            >
                              Stufe {l}: ab {r.limits[l - 1]} {r.unit ?? th.unit}
                            </span>
                          ))}
                          {active ? (
                            <span className="text-xs text-muted-foreground">
                              passt zur Gültigkeit
                              {hrs ? ` (${Math.round(hrs)} Std.)` : ""}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {th.periodNote ? (
                  <p className="mb-2 text-xs text-muted-foreground">{th.periodNote}</p>
                ) : null}
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {th.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  {th.ownSetting ? <li className="italic">{th.ownSetting}</li> : null}
                </ul>
                {sug !== null ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">
                      {sug === 0
                        ? "Messwert unter Stufe 1 – keine Warnung nötig."
                        : `Empfehlung aus Messwert: Stufe ${sug}.`}
                      {row ? ` Bezug: ${row.periodLabel}.` : ""}
                    </span>
                    {sug !== 0 && sug !== form.level ? (
                      <button
                        type="button"
                        onClick={() =>
                          applyTemplate(form.hazard, sug as WarnLevel, form.valueFrom, form.valueTo)
                        }
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
                      >
                        Stufe {sug} übernehmen
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()}

          <div className="grid gap-4 sm:grid-cols-2">
            {textIsManual && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground">
                  Texte wurden manuell angepasst – sie folgen den Mengenangaben nicht mehr
                  automatisch.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(form.hazard, form.level, form.valueFrom, form.valueTo, true)
                  }
                  className="rounded-md border border-input bg-background px-3 py-1.5 font-medium"
                >
                  Text aus Vorlage neu erzeugen
                </button>
              </div>
            )}
            <label className="text-sm font-semibold sm:col-span-2">
              Titel
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
              />
            </label>
            <label className="text-sm font-semibold">
              Beschreibung
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
              />
            </label>
            <label className="text-sm font-semibold">
              Mögliche Auswirkungen
              <textarea
                rows={5}
                value={form.impact}
                onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Stärkste Phase (optional)
              <input
                value={form.peakPhase}
                onChange={(e) => setForm((f) => ({ ...f, peakPhase: e.target.value }))}
                placeholder="z. B. heute 14:00 – 17:00"
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
              />
            </label>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-sm font-semibold">
              {getHazard(form.hazard).paramLabel} ({getHazard(form.hazard).paramUnit}) – optional
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                von
                <input
                  inputMode="decimal"
                  value={form.valueFrom}
                  placeholder={getHazard(form.hazard).paramPlaceholder}
                  onChange={(e) =>
                    applyTemplate(form.hazard, form.level, e.target.value, form.valueTo)
                  }
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
                />
              </label>
              <label className="text-sm font-semibold">
                bis
                <input
                  inputMode="decimal"
                  value={form.valueTo}
                  placeholder="optional"
                  onChange={(e) =>
                    applyTemplate(form.hazard, form.level, form.valueFrom, e.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Betroffene Gemeinden</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {REGION_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, regionIds: g.regionIds }))}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  {g.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, regionIds: [] }))}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Keine
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
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
                      "rounded px-3 py-2 text-sm " +
                      (on ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
                    }
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-sm font-semibold">Gültigkeit</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="self-center text-sm text-muted-foreground">Beginn:</span>
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
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="self-center text-sm text-muted-foreground">Dauer:</span>
              {[3, 6, 12, 24, 48].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDuration(h)}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  {h} Std.
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Gültig von
                <input
                  type="datetime-local"
                  required
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
                />
              </label>
              <label className="text-sm font-semibold">
                Gültig bis
                <input
                  type="datetime-local"
                  required
                  value={form.validTo}
                  onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
                />
              </label>
            </div>
          </div>



          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2.5 text-base">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Sofort aktiv {form.advisory ? "(ohne Push)" : "(löst Push-Benachrichtigung aus)"}
            </label>
            <label className="flex items-center gap-2.5 text-base">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={form.advisory}
                onChange={(e) =>
                  applyTemplate(
                    form.hazard,
                    form.level,
                    form.valueFrom,
                    form.valueTo,
                    false,
                    e.target.checked,
                  )
                }
              />
              Vorinformation (schraffiert, ohne Push)
            </label>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold disabled:opacity-60"
              style={{ background: preview.color, color: preview.textOnColor }}
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {form.id
                ? "Änderungen speichern"
                : form.advisory
                  ? "Vorinformation veröffentlichen"
                  : "Warnung veröffentlichen"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm());
                  setLastTpl(genTexts("gewitter", 1, ""));
                }}
                className="text-sm underline"
              >
                Abbrechen
              </button>
            )}
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>
        </form>

        {/* Liste */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
            Erfasste Warnungen
          </h2>
          {rowErr && <p className="text-sm text-destructive">{rowErr}</p>}
          {loading ? (
            <p className="text-base text-muted-foreground">Lade…</p>
          ) : current.length === 0 ? (
            <p className="text-base text-muted-foreground">Aktuell keine laufenden Warnungen.</p>
          ) : (
            <ul className="space-y-3">
              {current.map((w) => {
                const h = getHazard(w.hazard as HazardId);
                const Icon = h.icon;
                const def = LEVELS[w.level as WarnLevel];
                const expired = new Date(w.validTo).getTime() < Date.now();
                const busyRow = rowBusy === w.id;
                const act = async (fn: () => Promise<unknown>) => {
                  setRowBusy(w.id);
                  setRowErr(null);
                  try {
                    await fn();
                    await load();
                  } catch (e) {
                    setRowErr(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
                  } finally {
                    setRowBusy(null);
                  }
                };
                return (
                  <li
                    key={w.id}
                    className={
                      "rounded-lg border border-border bg-card p-4 shadow-sm " +
                      (busyRow ? "opacity-60" : "")
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className="flex items-center gap-2 rounded px-2.5 py-1.5 text-sm font-semibold"
                        style={{ background: def.color, color: def.textOnColor }}
                      >
                        <Icon className="h-4 w-4" />{" "}
                        {w.title || warningTitle(w.hazard as HazardId, w.level as WarnLevel, w.advisory)}
                      </span>
                      <span className="text-sm text-muted-foreground">{formatRange(w.validFrom, w.validTo)}</span>
                      {!w.active && <span className="rounded bg-muted px-2 py-1 text-xs">inaktiv</span>}
                      {expired && <span className="rounded bg-muted px-2 py-1 text-xs">abgelaufen</span>}
                      {w.source === "auto" && (
                        <span className="rounded bg-muted px-2 py-1 text-xs">automatisch</span>
                      )}
                      {w.advisory && (
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">Vorinformation</span>
                      )}
                      <div className="ml-auto flex items-center gap-3">
                        {busyRow && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => edit(w)}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" /> Bearbeiten
                        </button>
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() =>
                            act(() =>
                              setWarningAdvisory({
                                data: { password, id: w.id, advisory: !w.advisory },
                              }),
                            )
                          }
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          {w.advisory ? "→ Warnung" : "→ Vorinformation"}
                        </button>
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() =>
                            act(() =>
                              setWarningActive({ data: { password, id: w.id, active: !w.active } }),
                            )
                          }
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          {w.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {w.active ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => {
                            if (!confirm("Warnung löschen?")) return;
                            void act(() => deleteWarning({ data: { password, id: w.id } }));
                          }}
                          className="flex items-center gap-1.5 text-sm text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" /> Löschen
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-base text-foreground">{w.description}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {w.regionIds.map((r) => regionName(r)).join(", ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {archived.length > 0 && (
            <details className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                Beendet / abgelaufen ({archived.length})
              </summary>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={rowBusy === "__all__"}
                  onClick={() => {
                    if (!confirm(`${archived.length} Einträge endgültig löschen?`)) return;
                    setRowBusy("__all__");
                    setRowErr(null);
                    void deleteArchivedWarnings({ data: { password } })
                      .then(() => load())
                      .catch((e: unknown) =>
                        setRowErr(e instanceof Error ? e.message : "Aktion fehlgeschlagen"),
                      )
                      .finally(() => setRowBusy(null));
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Alle löschen
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {archived.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {w.title || warningTitle(w.hazard as HazardId, w.level as WarnLevel, w.advisory)}
                    </span>
                    <span className="text-muted-foreground">{formatRange(w.validFrom, w.validTo)}</span>
                    <button
                      type="button"
                      disabled={rowBusy === w.id}
                      onClick={() => {
                        if (!confirm("Warnung löschen?")) return;
                        setRowBusy(w.id);
                        setRowErr(null);
                        void deleteWarning({ data: { password, id: w.id } })
                          .then(() => load())
                          .catch((e: unknown) =>
                            setRowErr(e instanceof Error ? e.message : "Aktion fehlgeschlagen"),
                          )
                          .finally(() => setRowBusy(null));
                      }}
                      className="ml-auto flex items-center gap-1.5 text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" /> Löschen
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

/** Vorschau der öffentlichen Warnkarte — zur Kontrolle neu erfasster Warnungen. */
function MapPreviewSection({ refreshKey }: { refreshKey: number }) {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    setUpdatedAt(
      new Date().toLocaleString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [refreshKey]);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Vorschau Warnkarte
      </h2>
      <WarnMap key={refreshKey} bare />
      <p className="text-xs text-muted-foreground">
        {updatedAt ? `Aktualisiert: ${updatedAt}` : "\u00a0"}
      </p>
    </section>
  );
}

/** Status und manueller Start der automatischen Gewitterwarnung. */
/** Zeigt die zuletzt im Browser aufgetretenen Fehler (Absturz-Diagnose). */
function ClientErrorsSection({ password }: { password: string }) {
  type Row = Awaited<ReturnType<typeof adminListClientErrors>>[number];
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setBusy(true);
    setMsg("");
    try {
      setRows(await adminListClientErrors({ data: { password } }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Browser-Fehler (Absturz-Diagnose)
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
          >
            {busy ? "Lade …" : "Aktualisieren"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await adminClearClientErrors({ data: { password } });
              void load();
            }}
            className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Alle löschen
          </button>
        </div>
      </div>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine Fehler protokolliert.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
          {rows.map((r) => (
            <li key={r.id} className="rounded-sm border border-border bg-background p-2">
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <span className="font-mono">{new Date(r.created_at).toLocaleString("de-CH")}</span>
                <span className="rounded-sm bg-muted px-1 py-0.5">{r.kind}</span>
                {r.route && <span className="truncate">{r.route}</span>}
                {r.memory_mb != null && <span>{Math.round(r.memory_mb)} MB</span>}
              </div>
              <p className="mt-1 font-medium text-foreground">{r.message}</p>
              {r.stack && (
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                  {r.stack}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AutoThunderSection({ password }: { password: string }) {
  const [status, setStatus] = useState<AutoThunderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setStatus(await getAutoThunderStatus());
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const check = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = (await runAutoThunderNow({ data: { password } })) as Record<string, unknown>;
      if (res.ok) {
        setMsg(
          `Prüfung erledigt — ${Number(res.detected ?? 0)} Gemeinde(n) mit Gewitterzellen, ` +
            `${Number(res.created ?? 0)} neu, ${Number(res.closed ?? 0)} beendet, ` +
            `${Number(res.notified ?? 0)} Push-Meldung(en) verschickt.` +
            (res.note ? ` Hinweis: ${String(res.note)}` : ""),
        );

      } else {
        setMsg(`Fehler — ${String(res.error ?? "unbekannt")}`);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      void load();
    }
  };

  const age = status?.ageMinutes ?? null;
  const dot = age == null ? "bg-red-500" : age <= 30 ? "bg-emerald-500" : age <= 120 ? "bg-amber-500" : "bg-red-500";

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Gewitter-Autowarnung
      </h2>
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <span className="text-muted-foreground">
          {status?.ranAt
            ? `letzter Lauf vor ${age} min (${new Date(status.ranAt).toLocaleString("de-CH")}) · ` +
              `${status.detected} erkannt · ${status.created} erstellt · ${status.closed} beendet · ` +
              `${status.notified} Push verschickt` +

              (status.note ? ` · ${status.note}` : "")
            : "noch kein Lauf protokolliert"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Automatik läuft alle 5 Minuten und warnt — wie MeteoSchweiz und SRF Meteo — erst ab Stufe 2:
        ab {THUNDER_RAIN_MMH[1]} mm/h (Stufe 2) bzw. ab {THUNDER_RAIN_MMH[2]} mm/h (Stufe 3),
        gemessen über mindestens 12 km² Fläche. Stufe 2 braucht zwei, Stufe 3 drei Radarläufe in
        Folge. Stufe 1 ({THUNDER_RAIN_MMH[0]} mm/h) bleibt manuellen Warnungen vorbehalten;
        Push-Wiederholungen frühestens nach 60 Minuten, ausser die Stufe steigt.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void check()}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        {busy ? "Prüft …" : "Jetzt prüfen"}
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}

/** Diagnose: Alter der Datenquellen + letzter GitHub-Run je Pipeline. */
function PipelineHealthSection({ password }: { password: string }) {
  const [rows, setRows] = useState<PipelineHealth[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setBusy(true);
    setMsg("");
    try {
      setRows(await getPipelineHealth({ data: { password } }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline-Diagnose
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {busy ? "Lädt …" : "Aktualisieren"}
        </button>
      </div>
      {msg && <p className="text-xs text-destructive">{msg}</p>}
      <div className="space-y-2">
        {(rows ?? []).map((r) => {
          const age = r.dataAgeMinutes;
          const limit = r.expectedEveryMin;
          const dot =
            age == null
              ? "bg-red-500"
              : age <= limit * 2
                ? "bg-emerald-500"
                : age <= limit * 6
                  ? "bg-amber-500"
                  : "bg-red-500";
          const runInfo = r.runCreatedAt
            ? `${r.runConclusion ?? r.runStatus ?? "?"} · ${new Date(r.runCreatedAt).toLocaleString("de-CH")}`
            : "kein Run gefunden";
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
              <span className="min-w-40 font-medium">{r.label}</span>
              <span className="text-muted-foreground">
                Daten {age == null ? (r.error ?? "unbekannt") : `${age} min alt`} (Soll ≤ {limit} min)
              </span>
              <span className="text-muted-foreground">· Run: {runInfo}</span>
              {r.runUrl && (
                <a
                  href={r.runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  öffnen
                </a>
              )}
              {r.runNote && (
                <span className="w-full text-amber-600 dark:text-amber-400">
                  ↳ {r.runNote}
                </span>
              )}
              {typeof r.runnerFailures === "number" && r.runnerFailures > 0 && (
                <span className="w-full text-muted-foreground">
                  ↳ {r.runnerFailures} von {r.runsChecked} Läufen ohne Runner (GitHub)
                </span>
              )}
              {r.stale && (
                <span className="w-full font-medium text-destructive">
                  ↳ Daten deutlich zu alt — Trigger prüfen (Cron-Worker-Deploy unten)
                </span>
              )}
            </div>

          );
        })}
        {rows && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">keine Daten</p>
        )}
        <CronWorkerStatusRow password={password} />
      </div>
    </section>
  );
}

/** Zeigt, ob der Cloudflare-Cron-Worker auf dem aktuellen Stand deployt ist. */
function CronWorkerStatusRow({ password }: { password: string }) {
  const [st, setSt] = useState<CronWorkerStatus | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSt(await getCronWorkerStatus({ data: { password } }));
      } catch {
        setSt(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!st) return null;
  const dot = st.error || st.deployOutdated || !st.lastDeployAt ? "bg-red-500" : "bg-emerald-500";
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-40 font-medium">Cron-Worker (Trigger-Quelle)</span>
      <span className="text-muted-foreground">
        Deploy{" "}
        {st.lastDeployAt
          ? new Date(st.lastDeployAt).toLocaleString("de-CH")
          : (st.error ?? "unbekannt")}
      </span>
      {st.lastChangeAt && (
        <span className="text-muted-foreground">
          · letzte Änderung {new Date(st.lastChangeAt).toLocaleString("de-CH")}
        </span>
      )}
      {st.lastDeployUrl && (
        <a
          href={st.lastDeployUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          öffnen
        </a>
      )}
      {st.deployOutdated && (
        <span className="w-full font-medium text-destructive">
          ↳ Worker-Änderungen sind noch nicht live — Deploy „Deploy cron-worker" starten
        </span>
      )}
    </div>
  );
}

