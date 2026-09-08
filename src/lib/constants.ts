// SQLite can't enforce enums at the database level, so the allowed values
// for the "enum-like" string fields in prisma/schema.prisma live here and
// get checked in application code instead.

export const GOAL_FREQUENCY_TYPES = ["DAILY", "SPECIFIC_DAYS", "WEEKLY_TARGET"] as const;
export type GoalFrequencyType = (typeof GOAL_FREQUENCY_TYPES)[number];

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEIGHT_UNITS = ["KG", "LB"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const REMINDER_CHANNELS = ["PUSH", "EMAIL"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];
