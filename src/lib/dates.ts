// Dates are stored as midnight UTC for a given calendar day, and every
// "date" we deal with in the UI is a plain YYYY-MM-DD string — no timezone
// arithmetic to get wrong.

// Weekday/month names are built by hand rather than via
// `toLocaleDateString` wherever `weekday` is involved — Node's ICU data
// (server-rendered HTML) and the browser's (hydration) have disagreed on
// whether a comma follows a short/long weekday name (e.g. "Sun 13 Sept" vs
// "Sun, 13 Sept"), which trips a hydration mismatch on every page that
// renders one. Fixed lookups can't drift between server and client.
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO date strings compare lexicographically the same as chronologically,
// so this is a plain string comparison — no Date parsing needed.
export function isFutureISO(dateISO: string): boolean {
  return dateISO > todayISO();
}

export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function dateToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Whole days from `fromISO` to `toISO` — negative when `toISO` is earlier.
// Both are midnight-UTC dates already, so a plain ms-diff is exact with no
// DST/timezone edge cases to account for.
export function daysBetween(fromISO: string, toISO: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((isoToDate(toISO).getTime() - isoToDate(fromISO).getTime()) / msPerDay);
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

// "12–19 Dec" (same month) or "29 Dec – 4 Jan" (spans a month/year boundary).
export function formatWeekRange(startISO: string, endISO: string): string {
  const start = isoToDate(startISO);
  const end = isoToDate(endISO);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const dayMonth = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" });

  if (sameMonth) {
    return `${start.getUTCDate()}–${dayMonth(end, true)}`;
  }
  return `${dayMonth(start, false)} – ${dayMonth(end, true)}`;
}

// "September 2026" — for "Joined September 2026" on a profile card.
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Whole years old as of today — used to enforce the minimum age at
// onboarding/profile-edit, not just displayed.
export function ageInYears(birthday: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - birthday.getUTCFullYear();
  const hadBirthdayThisYear =
    now.getUTCMonth() > birthday.getUTCMonth() ||
    (now.getUTCMonth() === birthday.getUTCMonth() && now.getUTCDate() >= birthday.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

export function formatLong(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAY_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "Sun 13 Sept" — the short weekday+day+month label used for recent-history
// rows (workout log, study sessions) once something's more than a day old.
export function weekdayShortDayMonth(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

// "Sun 13" — same as above but without the month, for rows that are
// already grouped/scoped to a single month.
export function weekdayShortDay(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`;
}

// Just "Sun" — chart axis labels, where the day number would be redundant
// (an adjacent tooltip/label already gives the exact date).
export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[isoToDate(iso).getUTCDay()];
}
