-- AlterTable (IF NOT EXISTS so safe to re-run if column already exists)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailTripInvites" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailTripUpdates" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inAppNotifications" BOOLEAN NOT NULL DEFAULT true;
