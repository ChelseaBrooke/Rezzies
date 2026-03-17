-- AlterTable (IF NOT EXISTS so safe to re-run)
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "rsvpByDate" TIMESTAMP(3);
