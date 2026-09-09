// Dates are stored as midnight UTC for a given calendar day, and every
// "date" we deal with in the UI is a plain YYYY-MM-DD string — no timezone
// arithmetic to get wrong.

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function dateToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftISO(iso: string, days: number): string {
  const date = isoToDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToISO(date);
}

// "YYYY-MM" for the calendar month picker/nav.
export function monthISOOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function shiftMonth(monthISO: string, months: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Full 6-row Monday-start grid of ISO date strings covering the given
// month, including the leading/trailing days from adjacent months needed
// to fill whole weeks.
export function monthGridDays(monthISO: string): string[] {
  const [y, m] = monthISO.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    return dateToISO(d);
  });
}

export function monthRangeContaining(dateISO: string): { startISO: string; endISO: string } {
  const monthISO = monthISOOf(dateISO);
  const [y, m] = monthISO.split("-").map(Number);
  const start = dateToISO(new Date(Date.UTC(y, m - 1, 1)));
  const end = dateToISO(new Date(Date.UTC(y, m, 0)));
  return { startISO: start, endISO: end };
}

export function yearRangeContaining(dateISO: string): { startISO: string; endISO: string } {
  const y = Number(dateISO.slice(0, 4));
  return { startISO: `${y}-01-01`, endISO: `${y}-12-31` };
}

export function formatLong(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
