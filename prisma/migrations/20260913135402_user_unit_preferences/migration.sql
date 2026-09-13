-- CreateEnum
CREATE TYPE "DistanceUnit" AS ENUM ('KM', 'MI');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'KM',
ADD COLUMN     "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG';
