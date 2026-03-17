-- AlterTable
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "activitySnapshot" JSONB;
