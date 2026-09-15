-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN     "birthday" TIMESTAMP(3),
  ADD COLUMN     "gender" "Gender",
  ADD COLUMN     "city" TEXT,
  ADD COLUMN     "bio" TEXT,
  ADD COLUMN     "pronouns" TEXT,
  ADD COLUMN     "avatarUrl" TEXT,
  ADD COLUMN     "weightKg" DOUBLE PRECISION,
  ADD COLUMN     "heightCm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey (Friendship had 0 rows in production at the time of this
-- migration — nothing to migrate)
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_requesterId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_addresseeId_fkey";

-- DropTable
DROP TABLE "Friendship";

-- DropEnum
DROP TYPE "FriendshipStatus";
