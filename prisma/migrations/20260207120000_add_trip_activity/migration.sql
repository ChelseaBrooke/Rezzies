-- CreateTable (IF NOT EXISTS so safe to re-run)
CREATE TABLE IF NOT EXISTS "TripActivity" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TripActivity_tripId_idx" ON "TripActivity"("tripId");
CREATE INDEX IF NOT EXISTS "TripActivity_tripId_createdAt_idx" ON "TripActivity"("tripId", "createdAt");

-- AddForeignKey (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TripActivity_tripId_fkey'
    ) THEN
        ALTER TABLE "TripActivity" ADD CONSTRAINT "TripActivity_tripId_fkey"
        FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
