-- AlterTable
ALTER TABLE "User" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyContactPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "shareEmergencyWithHosts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "dietaryTags" TEXT;
ALTER TABLE "User" ADD COLUMN "allergiesTags" TEXT;
ALTER TABLE "User" ADD COLUMN "accessibilityNotes" TEXT;
