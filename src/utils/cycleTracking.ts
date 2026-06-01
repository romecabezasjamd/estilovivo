export interface CyclePeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

const storageKey = (userId: string) => `ev_cycle_period_${userId}`;

export const CYCLE_MOTIVATIONAL_MESSAGES = [
  'Hoy brillas más que nunca',
  'Tu energía está contigo',
  'Cuida de ti, tu estilo también descansa',
  'Eres fuerte, viste con calma',
  'Tu bienestar es tu mejor accesorio',
  'Respira, brilla a tu ritmo',
];

export function getCyclePeriod(userId?: string): CyclePeriod | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CyclePeriod;
    if (parsed?.startDate && parsed?.endDate) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveCyclePeriod(userId: string, period: CyclePeriod | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!period) {
    localStorage.removeItem(storageKey(userId));
    return;
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(period));
}

export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateInCycle(dateStr: string, period: CyclePeriod): boolean {
  const d = parseDateOnly(dateStr).getTime();
  const start = parseDateOnly(period.startDate).getTime();
  const end = parseDateOnly(period.endDate).getTime();
  return d >= start && d <= end;
}

export function isTodayInCycle(userId?: string, period?: CyclePeriod | null): boolean {
  const p = period ?? getCyclePeriod(userId);
  if (!p) return false;
  const today = new Date().toISOString().split('T')[0];
  return isDateInCycle(today, p);
}

export function getMotivationalMessageForDate(dateStr: string, userId?: string): string | null {
  const period = getCyclePeriod(userId);
  if (!period || !isDateInCycle(dateStr, period)) return null;
  const dayIndex = Math.floor(
    (parseDateOnly(dateStr).getTime() - parseDateOnly(period.startDate).getTime()) / 86400000
  );
  return CYCLE_MOTIVATIONAL_MESSAGES[Math.max(0, dayIndex) % CYCLE_MOTIVATIONAL_MESSAGES.length];
}

export function getMotivationalMessageForToday(userId?: string): string | null {
  const today = new Date().toISOString().split('T')[0];
  return getMotivationalMessageForDate(today, userId);
}
