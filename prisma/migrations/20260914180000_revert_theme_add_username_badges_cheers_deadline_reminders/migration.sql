-- CreateEnum
CREATE TYPE "DeadlineReminderKind" AS ENUM ('WEEK_BEFORE', 'DAY_BEFORE', 'HOUR_BEFORE');

-- CreateEnum
CREATE TYPE "Badge" AS ENUM ('FIRST_JOURNAL_ENTRY', 'FIRST_STUDY_SESSION', 'FIRST_WORKOUT', 'FIRST_GOAL_COMPLETE', 'FIRST_DEADLINE_COMPLETE', 'JOURNAL_STREAK_7', 'JOURNAL_STREAK_30', 'STUDY_STREAK_7', 'WORKOUT_STREAK_7', 'LEVEL_5', 'LEVEL_10');

-- AlterTable
ALTER TABLE "Deadline" ADD COLUMN     "dueTime" TEXT NOT NULL DEFAULT '23:59';

-- AlterTable: username added nullable first, backfilled from email, then
-- locked to NOT NULL — a plain NOT NULL column can't be added directly to
-- a table that already has rows.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

WITH ranked AS (
  SELECT
    id,
    lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9]', '_', 'g')) AS base,
    row_number() OVER (
      PARTITION BY lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9]', '_', 'g'))
      ORDER BY "createdAt"
    ) AS rn
  FROM "User"
)
UPDATE "User" u
SET "username" = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || r.rn::text END
FROM ranked r
WHERE r.id = u.id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accentTheme";

-- DropEnum
DROP TYPE "AccentTheme";

-- CreateTable
CREATE TABLE "DeadlineReminderSent" (
    "id" TEXT NOT NULL,
    "deadlineId" TEXT NOT NULL,
    "kind" "DeadlineReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadlineReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheer" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cheer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badge" "Badge" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineReminderSent_deadlineId_kind_key" ON "DeadlineReminderSent"("deadlineId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Cheer_fromUserId_toUserId_date_key" ON "Cheer"("fromUserId", "toUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badge_key" ON "UserBadge"("userId", "badge");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "DeadlineReminderSent" ADD CONSTRAINT "DeadlineReminderSent_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "Deadline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
