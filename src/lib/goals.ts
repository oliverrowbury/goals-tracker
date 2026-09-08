import { WEEKDAYS, type Weekday } from "@/lib/constants";
import { dateToISO, shiftISO, isoToDate } from "@/lib/dates";

type GoalLike = {
  frequencyType: string;
  targetDays: string | null;
  startDate: Date;
  endDate: Date | null;
};

export function weekdayOf(dateISO: string): Weekday {
  const jsDay = isoToDate(dateISO).getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const mondayFirstIndex = jsDay === 0 ? 6 : jsDay - 1;
  return WEEKDAYS[mondayFirstIndex];
}

export function isGoalDueOn(goal: GoalLike, dateISO: string): boolean {
  const startISO = dateToISO(goal.startDate);
  if (dateISO < startISO) return false;
  if (goal.endDate && dateISO > dateToISO(goal.endDate)) return false;

  if (goal.frequencyType === "SPECIFIC_DAYS") {
    const days = (goal.targetDays ?? "").split(",").filter(Boolean);
    return days.includes(weekdayOf(dateISO));
  }

  // DAILY and WEEKLY_TARGET goals are relevant every day within their range.
  return true;
}

// Current streak of consecutive due-days completed, counting back from
// `fromISO`. A due-but-not-yet-completed day on `fromISO` itself doesn't
// break the streak (you haven't failed today until the day is over) — any
// earlier due-but-incomplete day does.
export function computeStreak(goal: GoalLike, completedDates: Set<string>, fromISO: string): number {
  const startISO = dateToISO(goal.startDate);
  let streak = 0;
  let cursor = fromISO;
  let isFirstDay = true;

  while (cursor >= startISO) {
    if (isGoalDueOn(goal, cursor)) {
      if (completedDates.has(cursor)) {
        streak++;
      } else if (!isFirstDay) {
        break;
      }
    }
    isFirstDay = false;
    cursor = shiftISO(cursor, -1);
  }

  return streak;
}

export function weekRangeContaining(dateISO: string): { startISO: string; endISO: string } {
  const index = WEEKDAYS.indexOf(weekdayOf(dateISO));
  const startISO = shiftISO(dateISO, -index);
  const endISO = shiftISO(startISO, 6);
  return { startISO, endISO };
}

export function describeFrequency(goal: { frequencyType: string; targetDays: string | null; targetValue: number | null; unit: string | null }): string {
  if (goal.frequencyType === "DAILY") return "Every day";
  if (goal.frequencyType === "SPECIFIC_DAYS") {
    const days = (goal.targetDays ?? "").split(",").filter(Boolean);
    return days.length ? days.join(", ") : "No days set";
  }
  if (goal.frequencyType === "WEEKLY_TARGET") {
    const target = goal.targetValue ?? 0;
    return `${target} ${goal.unit ?? ""} per week`.trim();
  }
  return goal.frequencyType;
}
