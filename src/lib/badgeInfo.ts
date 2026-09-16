import type { Badge } from "@/generated/prisma/enums";

// Split out from lib/badges.ts so client components (e.g. AchievementWatcher) can
// import just the display data without pulling in that file's `prisma`
// import — a server-only dependency that breaks the client bundle.

// A fixed, curated set of milestones — same reasoning as the old
// accent-theme presets used to have: each one means something specific
// rather than being derived from a formula that could quietly change.
export const BADGE_INFO: Record<Badge, { emoji: string; label: string; description: string }> = {
  FIRST_JOURNAL_ENTRY: { emoji: "📝", label: "First entry", description: "Wrote your first journal entry" },
  FIRST_STUDY_SESSION: { emoji: "⏱️", label: "First session", description: "Logged your first study session" },
  FIRST_WORKOUT: { emoji: "💪", label: "First workout", description: "Finished your first workout" },
  FIRST_GOAL_COMPLETE: { emoji: "🎯", label: "First goal", description: "Completed a goal for the first time" },
  FIRST_DEADLINE_COMPLETE: { emoji: "⏰", label: "Beat a deadline", description: "Finished something before it was due" },
  JOURNAL_STREAK_7: { emoji: "🔥", label: "Week of writing", description: "7-day journal streak" },
  JOURNAL_STREAK_30: { emoji: "🏆", label: "Month of writing", description: "30-day journal streak" },
  JOURNAL_STREAK_100: { emoji: "💎", label: "100 days of writing", description: "100-day journal streak" },
  STUDY_STREAK_7: { emoji: "📚", label: "Week of study", description: "7-day study streak" },
  STUDY_STREAK_30: { emoji: "🎓", label: "Month of study", description: "30-day study streak" },
  WORKOUT_STREAK_7: { emoji: "🏋️", label: "Week of training", description: "7-day workout streak" },
  WORKOUT_STREAK_30: { emoji: "🦾", label: "Month of training", description: "30-day workout streak" },
  LEVEL_5: { emoji: "⭐", label: "Level 5", description: "Reached level 5" },
  LEVEL_10: { emoji: "🌟", label: "Level 10", description: "Reached level 10" },
  LEVEL_20: { emoji: "✨", label: "Level 20", description: "Reached level 20" },
  LEVEL_50: { emoji: "👑", label: "Level 50", description: "Reached level 50" },
  TOTAL_WORKOUTS_10: { emoji: "🥉", label: "10 workouts", description: "Finished 10 workouts total" },
  TOTAL_WORKOUTS_50: { emoji: "🥈", label: "50 workouts", description: "Finished 50 workouts total" },
  TOTAL_WORKOUTS_100: { emoji: "🥇", label: "100 workouts", description: "Finished 100 workouts total" },
  TOTAL_STUDY_HOURS_10: { emoji: "🕙", label: "10 hours studied", description: "Racked up 10 hours of study time total" },
  TOTAL_STUDY_HOURS_50: { emoji: "🕰️", label: "50 hours studied", description: "Racked up 50 hours of study time total" },
  FIRST_FRIEND: { emoji: "🤝", label: "First follow", description: "Followed your first person on Proudly" },
  EARLY_BIRD: { emoji: "🌅", label: "Early bird", description: "Finished a workout or study session before 7am" },
  NIGHT_OWL: { emoji: "🦉", label: "Night owl", description: "Finished a workout or study session after 10pm" },
};
