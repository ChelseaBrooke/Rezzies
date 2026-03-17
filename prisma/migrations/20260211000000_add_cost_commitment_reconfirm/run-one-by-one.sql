-- Run these in Supabase SQL Editor ONE AT A TIME if the full migration times out.
-- Optional: run this first to give each statement up to 2 minutes:
--   SET statement_timeout = '120000';

-- RSVP columns:
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "costCommitmentAccepted" BOOLEAN;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "rsvpYesAcceptedAt" TIMESTAMP(3);
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "yesSubstatus" TEXT;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "acceptedEstimateLowCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "acceptedEstimateHighCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "acceptedHeadcountMin" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "acceptedHeadcountMax" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "acceptedCostBasisVersion" TEXT;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "reconfirmRequiredAt" TIMESTAMP(3);
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "reconfirmDeadlineAt" TIMESTAMP(3);
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "latestEstimateLowCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "latestEstimateHighCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN IF NOT EXISTS "latestEstimateUpdatedAt" TIMESTAMP(3);

-- After all succeed, from your project folder run:
--   npx prisma migrate resolve --applied 20260211000000_add_cost_commitment_reconfirm
