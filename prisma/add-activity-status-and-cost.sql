-- Add Activity.status and Activity.totalCostToSplit (run if your DB doesn't have these yet)
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "totalCostToSplit" DOUBLE PRECISION;
