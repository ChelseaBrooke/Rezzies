-- Close the drift between prisma/migrations and prisma/schema.prisma (TD4).
--
-- WHY THIS EXISTS
-- Several features shipped by running SQL against the database by hand
-- (see prisma/add-meals-attendance.sql, prisma/add-activity-status-and-cost.sql)
-- instead of via a migration. The result: `prisma migrate deploy` against an
-- EMPTY database produced a schema the app could not run on -- e2e seeding died
-- with `The column 'dismissedTooltips' does not exist in the current database`.
-- This migration replays those hand-applied changes so a fresh database built
-- from the migration history matches schema.prisma exactly.
--
-- WHY IT IS WRITTEN IDEMPOTENTLY
-- Databases that predate this migration (production, existing local databases)
-- ALREADY have these columns -- that is precisely why the app works there. Every
-- statement below is therefore guarded so it is a no-op when the change is
-- already present, and safe to apply anywhere. This matches how these changes
-- actually reached production (idempotent hand-run SQL) and how existing
-- migrations in this repo are written (see 20260214000000_polls_enhanced).
--
-- BEFORE MERGING: run a read-only `prisma migrate diff` against production to
-- confirm production already matches schema.prisma. See CONTRIBUTING.md.

-- DropIndex: indexes belonging to the removed Trip.inviteCode column
DROP INDEX IF EXISTS "Trip_inviteCode_idx";
DROP INDEX IF EXISTS "Trip_inviteCode_key";

-- AlterTable: Activity
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "totalCostToSplit" DOUBLE PRECISION;

-- AlterTable: updatedAt is application-managed (@updatedAt), so it carries no
-- database default. DROP DEFAULT is inherently idempotent.
ALTER TABLE "CaptionThisCaption" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CaptionThisRound" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CaptionThisScore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: MealSlot
ALTER TABLE "MealSlot" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "MealSlot" ADD COLUMN IF NOT EXISTS "tags" TEXT;

-- AlterTable: Poll
ALTER TABLE "Poll" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- These three were introduced as nullable-with-default in 20260214000000_polls_enhanced
-- and are NOT NULL in schema.prisma. Backfill any explicit NULLs before tightening,
-- so SET NOT NULL cannot fail on real data. Each UPDATE is a no-op when clean.
UPDATE "Poll" SET "category" = 'Other' WHERE "category" IS NULL;
UPDATE "Poll" SET "pollType" = 'single' WHERE "pollType" IS NULL;
UPDATE "Poll" SET "showResultsLive" = true WHERE "showResultsLive" IS NULL;

ALTER TABLE "Poll" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Poll" ALTER COLUMN "pollType" SET NOT NULL;
ALTER TABLE "Poll" ALTER COLUMN "showResultsLive" SET NOT NULL;

-- AlterTable: RSVP
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "priceApprovedByHost" BOOLEAN;

-- AlterTable: Trip
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "activitiesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "checkInTime" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "checkOutTime" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "childrenAllowed" BOOLEAN;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "costSharingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "fullAddress" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "gamesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "houseRules" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "inviteMode" TEXT NOT NULL DEFAULT 'approval_required';
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "locationCity" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "parkingNotes" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "petsAllowed" BOOLEAN;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "platformFeePerPerson" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "tripInfoEditedAt" TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "tripNotes" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "whatToBring" TEXT;
ALTER TABLE "Trip" ALTER COLUMN "totalCost" SET DEFAULT 0;
ALTER TABLE "Trip" ALTER COLUMN "pricingModel" SET DEFAULT 'PER_PERSON';

-- DESTRUCTIVE (the only destructive statement in this migration).
-- Trip.inviteCode was created TEXT NOT NULL with no default by
-- 20260125155923_add_trip_model, and is absent from schema.prisma and from all
-- application code. Any database still carrying it as NOT NULL could not insert
-- a Trip at all, so a working deployment has necessarily already dropped it and
-- this is a no-op there. The pre-merge production `migrate diff` confirms that.
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "inviteCode";

-- AlterTable: TripMember
ALTER TABLE "TripMember" ALTER COLUMN "inviteStatus" SET DEFAULT 'pending';

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatBubbleColor" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dismissedTooltips" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: MealSlotAttendance
-- Column-for-column identical to prisma/add-meals-attendance.sql, which is how
-- this table reached already-migrated databases, so IF NOT EXISTS cannot skip a
-- differently-shaped table here.
CREATE TABLE IF NOT EXISTS "MealSlotAttendance" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optOutReason" TEXT,
    "dietaryNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSlotAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MealSlotAttendance_slotId_idx" ON "MealSlotAttendance"("slotId");
CREATE INDEX IF NOT EXISTS "MealSlotAttendance_userId_idx" ON "MealSlotAttendance"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MealSlotAttendance_slotId_userId_key" ON "MealSlotAttendance"("slotId", "userId");
CREATE INDEX IF NOT EXISTS "Invite_tripId_status_idx" ON "Invite"("tripId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_tripId_userId_idx" ON "Invoice"("tripId", "userId");
CREATE INDEX IF NOT EXISTS "Invoice_tripId_userId_status_idx" ON "Invoice"("tripId", "userId", "status");
CREATE INDEX IF NOT EXISTS "RoomAssignment_tripId_userId_idx" ON "RoomAssignment"("tripId", "userId");
CREATE INDEX IF NOT EXISTS "TripMember_userId_inviteStatus_idx" ON "TripMember"("userId", "inviteStatus");

-- AddForeignKey (guarded: ADD CONSTRAINT has no IF NOT EXISTS form)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'MealSlotAttendance_slotId_fkey'
          AND conrelid = '"MealSlotAttendance"'::regclass
    ) THEN
        ALTER TABLE "MealSlotAttendance"
            ADD CONSTRAINT "MealSlotAttendance_slotId_fkey"
            FOREIGN KEY ("slotId") REFERENCES "MealSlot"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'MealSlotAttendance_userId_fkey'
          AND conrelid = '"MealSlotAttendance"'::regclass
    ) THEN
        ALTER TABLE "MealSlotAttendance"
            ADD CONSTRAINT "MealSlotAttendance_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
