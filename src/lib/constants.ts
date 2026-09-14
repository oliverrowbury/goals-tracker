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

// Fixed times of day a reminder can fire at — see the ReminderSlot comment
// in schema.prisma for why these are fixed slots rather than an arbitrary
// "HH:mm", and vercel.json for the cron entry backing each one.
export const REMINDER_SLOTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;
export type ReminderSlot = (typeof REMINDER_SLOTS)[number];
export const REMINDER_SLOT_LABELS: Record<ReminderSlot, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  NIGHT: "Night",
};

export const WORKOUT_TYPES = ["STRENGTH", "CARDIO"] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const WORKOUT_METRICS = ["SESSIONS", "MINUTES"] as const;
export type WorkoutMetric = (typeof WORKOUT_METRICS)[number];

export const DISTANCE_UNITS = ["KM", "MI"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const CARDIO_ACTIVITIES = ["Run", "Bike", "Swim", "Walk", "Row", "Other"] as const;

// Curated accent-color presets — see the AccentTheme comment in
// schema.prisma for why these are fixed rather than a free-form picker.
// Label/swatch pairs live in AccentThemeForm.tsx, next to the CSS overrides
// they correspond to in globals.css.
export const ACCENT_THEMES = ["TERRACOTTA", "OCEAN", "FOREST", "BERRY", "SLATE"] as const;
export type AccentTheme = (typeof ACCENT_THEMES)[number];
