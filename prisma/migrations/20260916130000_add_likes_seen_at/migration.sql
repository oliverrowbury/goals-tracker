-- AlterTable
ALTER TABLE "User" ADD COLUMN "likesSeenAt" TIMESTAMP(3);

-- Backfill existing accounts to "seen up to now" so nobody's flooded with
-- all-time cheer history the moment this ships — only cheers from here on
-- count as unseen.
UPDATE "User" SET "likesSeenAt" = CURRENT_TIMESTAMP WHERE "likesSeenAt" IS NULL;
