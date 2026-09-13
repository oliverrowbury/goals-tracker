-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('STRENGTH', 'CARDIO');

-- CreateEnum
CREATE TYPE "WorkoutMetric" AS ENUM ('SESSIONS', 'MINUTES');

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "workoutMetric" "WorkoutMetric";

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "type" "WorkoutType" NOT NULL DEFAULT 'STRENGTH';
