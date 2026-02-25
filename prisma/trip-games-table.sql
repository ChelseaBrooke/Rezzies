-- Trip games (add-on games for a trip). Run in Supabase SQL editor if not using migrations.
CREATE TABLE IF NOT EXISTS "TripGame" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "addedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TripGame_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TripGame" ADD CONSTRAINT "TripGame_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripGame" ADD CONSTRAINT "TripGame_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "TripGame_tripId_gameId_key" ON "TripGame"("tripId", "gameId");
CREATE INDEX IF NOT EXISTS "TripGame_tripId_idx" ON "TripGame"("tripId");
