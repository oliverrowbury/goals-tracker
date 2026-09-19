-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
