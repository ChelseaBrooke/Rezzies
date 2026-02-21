-- Add MealSlot.title, MealSlot.tags; create MealSlotAttendance table
ALTER TABLE "MealSlot" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "MealSlot" ADD COLUMN IF NOT EXISTS "tags" TEXT;

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

CREATE UNIQUE INDEX IF NOT EXISTS "MealSlotAttendance_slotId_userId_key" ON "MealSlotAttendance"("slotId", "userId");
CREATE INDEX IF NOT EXISTS "MealSlotAttendance_slotId_idx" ON "MealSlotAttendance"("slotId");
CREATE INDEX IF NOT EXISTS "MealSlotAttendance_userId_idx" ON "MealSlotAttendance"("userId");

ALTER TABLE "MealSlotAttendance" DROP CONSTRAINT IF EXISTS "MealSlotAttendance_slotId_fkey";
ALTER TABLE "MealSlotAttendance" ADD CONSTRAINT "MealSlotAttendance_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MealSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealSlotAttendance" DROP CONSTRAINT IF EXISTS "MealSlotAttendance_userId_fkey";
ALTER TABLE "MealSlotAttendance" ADD CONSTRAINT "MealSlotAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
