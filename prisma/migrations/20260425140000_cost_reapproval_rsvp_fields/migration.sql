-- Cost re-approval: immutable agreed range, approval state, deadlines.

ALTER TABLE "RSVP" ADD COLUMN "originalRangeMinCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN "originalRangeMaxCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN "costApprovalStatus" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "RSVP" ADD COLUMN "approvedCostShareCents" INTEGER;
ALTER TABLE "RSVP" ADD COLUMN "costApprovalMethod" TEXT;
ALTER TABLE "RSVP" ADD COLUMN "costReapprovalReason" TEXT;
ALTER TABLE "RSVP" ADD COLUMN "reApprovalRequiredAt" TIMESTAMP(3);
ALTER TABLE "RSVP" ADD COLUMN "reApprovalDeadline" TIMESTAMP(3);
ALTER TABLE "RSVP" ADD COLUMN "hostCostApprovalAt" TIMESTAMP(3);

-- Backfill from existing cost commitment fields for YES RSVPs.
UPDATE "RSVP"
SET
  "originalRangeMinCents" = "acceptedEstimateLowCents",
  "originalRangeMaxCents" = "acceptedEstimateHighCents",
  "approvedCostShareCents" = "acceptedEstimateHighCents"
WHERE
  "status" = 'yes'
  AND "acceptedEstimateHighCents" IS NOT NULL;
