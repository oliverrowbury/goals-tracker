-- Cheer becomes per-activity (one like on a specific workout or study
-- session) rather than a once-per-friend-per-calendar-day aggregate. Old
-- rows have no specific activity to attach to, so this starts clean —
-- kudos counts resetting is an acceptable cost for a personal app.
TRUNCATE TABLE "Cheer";

DROP INDEX "Cheer_fromUserId_toUserId_date_key";
ALTER TABLE "Cheer" DROP COLUMN "date";

ALTER TABLE "Cheer" ADD COLUMN "workoutId" TEXT;
ALTER TABLE "Cheer" ADD COLUMN "studySessionId" TEXT;

CREATE UNIQUE INDEX "Cheer_fromUserId_workoutId_key" ON "Cheer" ("fromUserId", "workoutId");
CREATE UNIQUE INDEX "Cheer_fromUserId_studySessionId_key" ON "Cheer" ("fromUserId", "studySessionId");
