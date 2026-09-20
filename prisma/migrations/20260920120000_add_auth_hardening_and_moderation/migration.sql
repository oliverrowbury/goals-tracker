-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "resetToken" TEXT,
  ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifyToken" TEXT,
  ADD COLUMN "verifyTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_verifyToken_key" ON "User"("verifyToken");

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'COMMENT', 'WORKOUT', 'STUDY_SESSION', 'MESSAGE');

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_targetUserId_idx" ON "Report"("targetUserId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
