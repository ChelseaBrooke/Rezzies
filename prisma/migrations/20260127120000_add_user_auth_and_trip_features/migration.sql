-- Add missing columns to Trip table first (if they don't exist)
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "scrapePayload" TEXT;

-- Update existing rows to have timezone
UPDATE "Trip" SET "timezone" = 'UTC' WHERE "timezone" IS NULL;

-- Now make timezone NOT NULL (after setting default)
ALTER TABLE "Trip" ALTER COLUMN "timezone" SET NOT NULL;
ALTER TABLE "Trip" ALTER COLUMN "timezone" SET DEFAULT 'UTC';

-- Create User model for regular users (separate from AdminUser)
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

-- Create unique index on email (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- User Sessions (must come after User)
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- Trip Members (users who are part of trips)
CREATE TABLE IF NOT EXISTS "TripMember" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'guest',
    "inviteStatus" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TripMember_tripId_idx" ON "TripMember"("tripId");
CREATE INDEX IF NOT EXISTS "TripMember_userId_idx" ON "TripMember"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TripMember_tripId_userId_key" ON "TripMember"("tripId", "userId");

-- Invites
CREATE TABLE IF NOT EXISTS "Invite" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invite_token_key" ON "Invite"("token");
CREATE INDEX IF NOT EXISTS "Invite_tripId_idx" ON "Invite"("tripId");
CREATE INDEX IF NOT EXISTS "Invite_token_idx" ON "Invite"("token");

-- Room Assignments
CREATE TABLE IF NOT EXISTS "RoomAssignment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "bedType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RoomAssignment_tripId_idx" ON "RoomAssignment"("tripId");
CREATE INDEX IF NOT EXISTS "RoomAssignment_roomId_idx" ON "RoomAssignment"("roomId");
CREATE INDEX IF NOT EXISTS "RoomAssignment_userId_idx" ON "RoomAssignment"("userId");

-- Meal Plan
CREATE TABLE IF NOT EXISTS "MealPlan" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'slots',
    "hostBudgetTotal" DOUBLE PRECISION,
    "perGuestMealContribution" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_tripId_key" ON "MealPlan"("tripId");

-- Meal Slots
CREATE TABLE IF NOT EXISTS "MealSlot" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "capacityServings" INTEGER,
    "notes" TEXT,
    "menuText" TEXT,
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MealSlot_tripId_idx" ON "MealSlot"("tripId");
CREATE INDEX IF NOT EXISTS "MealSlot_date_idx" ON "MealSlot"("date");
CREATE INDEX IF NOT EXISTS "MealSlot_assignedUserId_idx" ON "MealSlot"("assignedUserId");

-- Activities
CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "pricePerPerson" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxParticipants" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Activity_tripId_idx" ON "Activity"("tripId");
CREATE INDEX IF NOT EXISTS "Activity_date_idx" ON "Activity"("date");

-- Activity Participants
CREATE TABLE IF NOT EXISTS "ActivityParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActivityParticipant_activityId_userId_key" ON "ActivityParticipant"("activityId", "userId");
CREATE INDEX IF NOT EXISTS "ActivityParticipant_activityId_idx" ON "ActivityParticipant"("activityId");
CREATE INDEX IF NOT EXISTS "ActivityParticipant_userId_idx" ON "ActivityParticipant"("userId");

-- Extra Cost Rules
CREATE TABLE IF NOT EXISTS "ExtraCostRule" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "appliesToJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraCostRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExtraCostRule_tripId_idx" ON "ExtraCostRule"("tripId");

-- Guest Extra Selections
CREATE TABLE IF NOT EXISTS "GuestExtraSelection" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestExtraSelection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestExtraSelection_tripId_idx" ON "GuestExtraSelection"("tripId");
CREATE INDEX IF NOT EXISTS "GuestExtraSelection_userId_idx" ON "GuestExtraSelection"("userId");
CREATE INDEX IF NOT EXISTS "GuestExtraSelection_ruleId_idx" ON "GuestExtraSelection"("ruleId");

-- RSVPs
CREATE TABLE IF NOT EXISTS "RSVP" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "arrivalDatetime" TIMESTAMP(3),
    "departureDatetime" TIMESTAMP(3),
    "adultsCount" INTEGER NOT NULL DEFAULT 1,
    "kidsCount" INTEGER NOT NULL DEFAULT 0,
    "petsCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSVP_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RSVP_tripId_userId_key" ON "RSVP"("tripId", "userId");
CREATE INDEX IF NOT EXISTS "RSVP_tripId_idx" ON "RSVP"("tripId");
CREATE INDEX IF NOT EXISTS "RSVP_userId_idx" ON "RSVP"("userId");

-- Guest Profiles (trip-scoped)
CREATE TABLE IF NOT EXISTS "GuestProfile" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dietaryRestrictions" TEXT,
    "allergies" TEXT,
    "phone" TEXT,
    "emergencyContact" TEXT,
    "paymentPreference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestProfile_tripId_userId_key" ON "GuestProfile"("tripId", "userId");
CREATE INDEX IF NOT EXISTS "GuestProfile_tripId_idx" ON "GuestProfile"("tripId");
CREATE INDEX IF NOT EXISTS "GuestProfile_userId_idx" ON "GuestProfile"("userId");

-- Invoices
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'due',
    "breakdownJson" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Invoice_tripId_idx" ON "Invoice"("tripId");
CREATE INDEX IF NOT EXISTS "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- Payments
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedTripId" TEXT,
    "relatedEntityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON "Notification"("read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Add foreign key constraints (after all tables exist)
DO $$ 
BEGIN
    -- Session -> User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey'
    ) THEN
        ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- TripMember -> Trip, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TripMember_tripId_fkey'
    ) THEN
        ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TripMember_userId_fkey'
    ) THEN
        ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Invite -> Trip, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Invite_tripId_fkey'
    ) THEN
        ALTER TABLE "Invite" ADD CONSTRAINT "Invite_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Invite_invitedByUserId_fkey'
    ) THEN
        ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedByUserId_fkey" 
        FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Invite_recipientUserId_fkey'
    ) THEN
        ALTER TABLE "Invite" ADD CONSTRAINT "Invite_recipientUserId_fkey" 
        FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- RoomAssignment -> Trip, Room, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RoomAssignment_tripId_fkey'
    ) THEN
        ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RoomAssignment_roomId_fkey'
    ) THEN
        ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_roomId_fkey" 
        FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RoomAssignment_userId_fkey'
    ) THEN
        ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- MealPlan -> Trip
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MealPlan_tripId_fkey'
    ) THEN
        ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- MealSlot -> Trip, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MealSlot_tripId_fkey'
    ) THEN
        ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MealSlot_assignedUserId_fkey'
    ) THEN
        ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_assignedUserId_fkey" 
        FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- Activity -> Trip
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Activity_tripId_fkey'
    ) THEN
        ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- ActivityParticipant -> Activity, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ActivityParticipant_activityId_fkey'
    ) THEN
        ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" 
        FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ActivityParticipant_userId_fkey'
    ) THEN
        ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- ExtraCostRule -> Trip
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ExtraCostRule_tripId_fkey'
    ) THEN
        ALTER TABLE "ExtraCostRule" ADD CONSTRAINT "ExtraCostRule_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- GuestExtraSelection -> Trip, User, ExtraCostRule
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GuestExtraSelection_tripId_fkey'
    ) THEN
        ALTER TABLE "GuestExtraSelection" ADD CONSTRAINT "GuestExtraSelection_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GuestExtraSelection_userId_fkey'
    ) THEN
        ALTER TABLE "GuestExtraSelection" ADD CONSTRAINT "GuestExtraSelection_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GuestExtraSelection_ruleId_fkey'
    ) THEN
        ALTER TABLE "GuestExtraSelection" ADD CONSTRAINT "GuestExtraSelection_ruleId_fkey" 
        FOREIGN KEY ("ruleId") REFERENCES "ExtraCostRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- RSVP -> Trip, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RSVP_tripId_fkey'
    ) THEN
        ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RSVP_userId_fkey'
    ) THEN
        ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- GuestProfile -> Trip, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GuestProfile_tripId_fkey'
    ) THEN
        ALTER TABLE "GuestProfile" ADD CONSTRAINT "GuestProfile_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GuestProfile_userId_fkey'
    ) THEN
        ALTER TABLE "GuestProfile" ADD CONSTRAINT "GuestProfile_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Invoice -> Trip, User
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_tripId_fkey'
    ) THEN
        ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tripId_fkey" 
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_userId_fkey'
    ) THEN
        ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Payment -> Invoice
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Payment_invoiceId_fkey'
    ) THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" 
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Notification -> User, Trip
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
    ) THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Notification_relatedTripId_fkey'
    ) THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedTripId_fkey" 
        FOREIGN KEY ("relatedTripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
