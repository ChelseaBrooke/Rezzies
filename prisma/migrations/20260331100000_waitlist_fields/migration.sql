-- Waitlist / capacity control on Trip
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "maxCapacity" INTEGER;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "waitlistClaimWindowHours" INTEGER NOT NULL DEFAULT 12;

-- Waitlist fields on RSVP
-- status now also accepts: "waitlisted" | "invited_to_rsvp"
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "waitlistPosition"     INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "waitlistJoinedAt"     TIMESTAMP(3);
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "claimWindowExpiresAt" TIMESTAMP(3);

-- Indexes for common waitlist queries
CREATE INDEX IF NOT EXISTS "RSVP_tripId_status_idx"           ON "RSVP"("tripId", "status");
CREATE INDEX IF NOT EXISTS "RSVP_tripId_waitlistPosition_idx" ON "RSVP"("tripId", "waitlistPosition");
