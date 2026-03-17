-- AlterTable
ALTER TABLE "Bed" ADD COLUMN     "capacitySlots" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "numberOfSlots" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pricingSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "allowPartialStays" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bedWeights" TEXT,
ADD COLUMN     "expectedPeopleCount" INTEGER,
ADD COLUMN     "maxGuests" INTEGER,
ADD COLUMN     "privacyPremiumP" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
ADD COLUMN     "sharingExponentAlpha" DOUBLE PRECISION NOT NULL DEFAULT 0.60;
