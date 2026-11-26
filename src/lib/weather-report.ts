import { z } from 'zod';

export const REPORT_SYMBOLS = [
  { code: 1, label: 'Sonnig' }, { code: 2, label: 'Wolkig' },
  { code: 5, label: 'Bedeckt' }, { code: 7, label: 'Regen' },
  { code: 15, label: 'Schnee' }, { code: 17, label: 'Schneeregen' },
  { code: 12, label: 'Gewitter' }, { code: 30, label: 'Nebel' },
] as const;

export const reportSchema = z.object({
  title: z.string().trim().min(1, 'Bitte einen Titel eingeben.').max(160),
  symbol: z.number().int().refine(v => REPORT_SYMBOLS.some(s => s.code === v), 'Ungültiges Wettersymbol.'),
  summary: z.string().trim().min(1, 'Bitte eine Kurzfassung eingeben.').max(600),
  body: z.string().trim().min(1, 'Bitte den Wetterbericht eingeben.').max(20000),
});
export type ReportInput = z.infer<typeof reportSchema>;
export type WeatherReport = ReportInput & { published_at: string };

export function reportTime(iso: string) {
  return new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}