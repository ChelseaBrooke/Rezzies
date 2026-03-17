-- Step 1: Create Trip table first
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "listingUrl" TEXT,
    "listingTitle" TEXT,
    "listingCoverPhoto" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "pricingModel" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "hostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create a default trip for existing rooms (legacy data)
INSERT INTO "Trip" (
    "id",
    "name",
    "description",
    "checkInDate",
    "checkOutDate",
    "totalCost",
    "pricingModel",
    "inviteCode",
    "isPublished",
    "createdAt",
    "updatedAt"
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Legacy Trip',
    'Migration placeholder for existing rooms',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    0,
    'per_bed',
    'LEGACY',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Step 3: Add tripId to Room as nullable first
ALTER TABLE "Room" ADD COLUMN "tripId" TEXT,
ADD COLUMN "maxOccupancy" INTEGER,
ADD COLUMN "photoUrls" TEXT[];

-- Step 4: Update existing rooms to use the default trip
UPDATE "Room" SET "tripId" = '00000000-0000-0000-0000-000000000000' WHERE "tripId" IS NULL;

-- Step 5: Make tripId required
ALTER TABLE "Room" ALTER COLUMN "tripId" SET NOT NULL;

-- Step 6: Create Reservation table
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "bedId" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "calculatedPrice" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_inviteCode_key" ON "Trip"("inviteCode");
CREATE INDEX "Trip_inviteCode_idx" ON "Trip"("inviteCode");
CREATE INDEX "Trip_isPublished_idx" ON "Trip"("isPublished");
CREATE INDEX "Trip_hostId_idx" ON "Trip"("hostId");
CREATE INDEX "Reservation_email_idx" ON "Reservation"("email");
CREATE INDEX "Reservation_tripId_idx" ON "Reservation"("tripId");
CREATE INDEX "Reservation_roomId_idx" ON "Reservation"("roomId");
CREATE INDEX "Reservation_bedId_idx" ON "Reservation"("bedId");
CREATE INDEX "Reservation_submittedAt_idx" ON "Reservation"("submittedAt");
CREATE INDEX "Room_tripId_idx" ON "Room"("tripId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
