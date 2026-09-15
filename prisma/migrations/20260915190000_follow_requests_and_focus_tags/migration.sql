-- CreateEnum
CREATE TYPE "FocusTag" AS ENUM ('JOURNALING', 'GOALS', 'STUDY', 'WORKOUTS');

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "focusTags" "FocusTag"[] NOT NULL DEFAULT ARRAY[]::"FocusTag"[];

-- AlterTable
ALTER TABLE "Follow" ADD COLUMN "status" "FollowStatus" NOT NULL DEFAULT 'PENDING';
