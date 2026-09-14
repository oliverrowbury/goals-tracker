-- Replace the single blanket shareActivity toggle with three per-category
-- toggles, so a user can show (say) their workout streak to friends
-- without also showing their journal streak.
ALTER TABLE "User" ADD COLUMN     "shareJournalStreak" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shareStudyStreak" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shareWorkoutStreak" BOOLEAN NOT NULL DEFAULT true;

-- Preserve whatever each user had already chosen: if they'd turned sharing
-- off entirely, keep all three off rather than defaulting them back on.
UPDATE "User" SET
  "shareJournalStreak" = "shareActivity",
  "shareStudyStreak" = "shareActivity",
  "shareWorkoutStreak" = "shareActivity";

ALTER TABLE "User" DROP COLUMN "shareActivity";
