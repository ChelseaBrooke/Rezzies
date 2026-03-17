-- Restored migration file (was missing on disk; DB had this migration applied).
-- Creates User so that 20260126191146 (Session) can reference it.

-- Trip columns
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "scrapePayload" TEXT;
UPDATE "Trip" SET "timezone" = 'UTC' WHERE "timezone" IS NULL;
ALTER TABLE "Trip" ALTER COLUMN "timezone" SET NOT NULL;
ALTER TABLE "Trip" ALTER COLUMN "timezone" SET DEFAULT 'UTC';

-- User (Session is created in next migration 20260126191146)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
