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

export function formatLong(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
