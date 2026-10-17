-- CreateEnum
CREATE TYPE "TrashedItemKind" AS ENUM ('GOAL', 'WORKOUT');

-- CreateTable
CREATE TABLE "TrashedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TrashedItemKind" NOT NULL,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrashedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrashedItem_userId_deletedAt_idx" ON "TrashedItem"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "TrashedItem" ADD CONSTRAINT "TrashedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
