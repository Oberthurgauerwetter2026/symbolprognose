import { z } from 'zod';

export const REPORT_AUTHOR = 'Bruno Rutishauser';
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;

const daySchema = z.object({
  label: z.string().trim().min(1, 'Bitte bei jedem Tag der Aussichten einen Wochentag angeben.').max(60),
  text: z.string().trim().min(1, 'Bitte bei jedem Tag der Aussichten einen Text eingeben.').max(4000),
});

export const reportSchema = z.object({
  title: z.string().trim().min(1, 'Bitte einen Titel eingeben.').max(160),
  situation: z.string().trim().max(6000),
  forecast_title: z.string().trim().max(120),
  forecast: z.string().trim().min(1, 'Bitte die Prognose eingeben.').max(8000),
  outlook_title: z.string().trim().max(120),
  days: z.array(daySchema).max(10, 'Höchstens zehn Tage in den Aussichten.'),
  trend: z.string().trim().max(4000),
});
export type ReportInput = z.infer<typeof reportSchema>;
export type ReportDay = ReportInput['days'][number];
export type WeatherReport = ReportInput & { published_at: string };

/** Entwürfe dürfen unvollständig sein, aber nie länger als der Bericht; geprüft wird erst beim Veröffentlichen. */
export const reportDraftSaveSchema = z.object({
  title: z.string().max(160), situation: z.string().max(6000), forecast_title: z.string().max(120), forecast: z.string().max(8000),
  outlook_title: z.string().max(120), days: z.array(z.object({ label: z.string().max(60), text: z.string().max(4000) })).max(10), trend: z.string().max(4000),
});
export const reportDraftSchema = reportDraftSaveSchema.partial();

/** Gespeicherte Tage stammen aus einem JSON-Feld: nur vollständige Einträge übernehmen. */
export function reportDays(value: unknown): ReportDay[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(day => { const parsed = daySchema.safeParse(day); return parsed.success ? [parsed.data] : []; });
}

/** Vorschlag für den nächsten Tag der Aussichten: der Wochentag nach dem letzten Eintrag, sonst morgen. */
export function nextWeekday(days: readonly { label: string }[], today: Date): string {
  const last = days.at(-1)?.label.trim().toLowerCase();
  const lastIndex = WEEKDAYS.findIndex(day => day.toLowerCase() === last);
  if (lastIndex >= 0) return WEEKDAYS[(lastIndex + 1) % 7]!;
  if (days.length) return '';
  const name = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', weekday: 'long' }).format(today);
  const todayIndex = WEEKDAYS.findIndex(day => day === name);
  return todayIndex >= 0 ? WEEKDAYS[(todayIndex + 1) % 7]! : '';
}

export function reportTime(iso: string) {
  return new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
export function reportTimeLong(iso: string) {
  return `${new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))} Uhr`;
}
