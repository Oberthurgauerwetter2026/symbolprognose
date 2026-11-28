import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** Beschriftung eines Ankers: ganzer Tag, Monat oder Jahr. */
export function anchorLabel(kind: 'day' | 'month' | 'year', anchor: string): string {
  const [y = 0, m = 1, d = 1] = anchor.split('-').map(Number);
  if (kind === 'year') return String(y);
  if (kind === 'month') return `${MONTHS[m - 1] ?? ''} ${y}`;
  return new Intl.DateTimeFormat('de-CH', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(Date.UTC(y, m - 1, d, 12));
}

/** Auswahlknopf im nachtblauen Bedienfeld; aktiv hellblau wie auf den anderen Detailseiten. */
export function Choice({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return <Button size="sm" variant="ghost" aria-pressed={active} {...(label ? { 'aria-label': label, title: label } : {})} onClick={onClick}
    className={`h-9 shrink-0 gap-1.5 px-2.5 ${active ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground' : 'text-muted-foreground hover:bg-accent/15 hover:text-foreground'}`}>{children}</Button>;
}

/** Blättern durch Tage, Monate oder Jahre; vorwärts nur bis heute. */
export function Stepper({ label, onPrev, onNext, canPrev, canNext }: { label: string; onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }) {
  return <div className="flex min-w-0 items-center gap-1">
    <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label="Zurück" disabled={!canPrev} onClick={onPrev}><ChevronLeft /></Button>
    <span className="min-w-0 truncate px-1 text-center text-sm font-semibold tabular-nums" data-testid="period-label">{label}</span>
    <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label="Weiter" disabled={!canNext} onClick={onNext}><ChevronRight /></Button>
  </div>;
}

export function DateRange({ from, to, max, onChange }: { from: string; to: string; max: string; onChange: (from: string, to: string) => void }) {
  const field = 'h-9 min-w-0 rounded-md border border-input bg-transparent px-2 text-sm text-foreground [color-scheme:dark]';
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  return <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
    <input type="date" aria-label="Von" className={field} value={from} max={max} onChange={e => { if (valid(e.target.value)) onChange(e.target.value, to); }} />
    <span className="text-muted-foreground">bis</span>
    <input type="date" aria-label="Bis" className={field} value={to} max={max} onChange={e => { if (valid(e.target.value)) onChange(from, e.target.value); }} />
  </div>;
}
