-- CreateEnum
CREATE TYPE "ActivityVisibility" AS ENUM ('PRIVATE', 'FRIENDS');

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "visibility" "ActivityVisibility" NOT NULL DEFAULT 'FRIENDS';

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "visibility" "ActivityVisibility" NOT NULL DEFAULT 'FRIENDS';
