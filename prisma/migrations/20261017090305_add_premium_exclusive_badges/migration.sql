-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Badge" ADD VALUE 'JOURNAL_STREAK_365';
ALTER TYPE "Badge" ADD VALUE 'STUDY_STREAK_100';
ALTER TYPE "Badge" ADD VALUE 'WORKOUT_STREAK_100';
ALTER TYPE "Badge" ADD VALUE 'LEVEL_100';
ALTER TYPE "Badge" ADD VALUE 'TOTAL_WORKOUTS_250';
ALTER TYPE "Badge" ADD VALUE 'TOTAL_STUDY_HOURS_200';
