-- CreateEnum
CREATE TYPE "AccentTheme" AS ENUM ('TERRACOTTA', 'OCEAN', 'FOREST', 'BERRY', 'SLATE');

-- CreateEnum
CREATE TYPE "ReminderSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT');

-- AlterTable
ALTER TABLE "Reminder" DROP COLUMN "timeOfDay",
ADD COLUMN     "slots" "ReminderSlot"[];

-- AlterTable
ALTER TABLE "User" DROP COLUMN "reminderEnabled",
DROP COLUMN "reminderTime",
ADD COLUMN     "accentTheme" "AccentTheme" NOT NULL DEFAULT 'TERRACOTTA',
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

