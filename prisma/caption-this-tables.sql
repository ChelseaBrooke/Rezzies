-- Caption This game tables. Run this in Supabase SQL editor (or: psql $DATABASE_URL -f prisma/caption-this-tables.sql)
-- Prisma uses quoted identifiers for table names (e.g. "CaptionThisRound").

CREATE TABLE IF NOT EXISTS "CaptionThisRound" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "photoUrl" TEXT,
  "photoSubmitterUserId" TEXT,
  "tripTimezone" TEXT NOT NULL DEFAULT 'UTC',
  "endsAtMidnightTs" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaptionThisRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaptionThisCaption" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaptionThisCaption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaptionThisVote" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "voterUserId" TEXT NOT NULL,
  "captionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaptionThisVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaptionThisScore" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pointsTotal" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaptionThisScore_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CaptionThisRound" ADD CONSTRAINT "CaptionThisRound_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionThisRound" ADD CONSTRAINT "CaptionThisRound_photoSubmitterUserId_fkey" FOREIGN KEY ("photoSubmitterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaptionThisCaption" ADD CONSTRAINT "CaptionThisCaption_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CaptionThisRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionThisCaption" ADD CONSTRAINT "CaptionThisCaption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaptionThisVote" ADD CONSTRAINT "CaptionThisVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CaptionThisRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionThisVote" ADD CONSTRAINT "CaptionThisVote_captionId_fkey" FOREIGN KEY ("captionId") REFERENCES "CaptionThisCaption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionThisVote" ADD CONSTRAINT "CaptionThisVote_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaptionThisScore" ADD CONSTRAINT "CaptionThisScore_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptionThisScore" ADD CONSTRAINT "CaptionThisScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CaptionThisCaption_roundId_userId_key" ON "CaptionThisCaption"("roundId", "userId");
CREATE INDEX IF NOT EXISTS "CaptionThisCaption_roundId_idx" ON "CaptionThisCaption"("roundId");

CREATE UNIQUE INDEX IF NOT EXISTS "CaptionThisVote_roundId_voterUserId_key" ON "CaptionThisVote"("roundId", "voterUserId");
CREATE INDEX IF NOT EXISTS "CaptionThisVote_roundId_idx" ON "CaptionThisVote"("roundId");
CREATE INDEX IF NOT EXISTS "CaptionThisVote_captionId_idx" ON "CaptionThisVote"("captionId");

CREATE UNIQUE INDEX IF NOT EXISTS "CaptionThisScore_tripId_userId_key" ON "CaptionThisScore"("tripId", "userId");
CREATE INDEX IF NOT EXISTS "CaptionThisScore_tripId_idx" ON "CaptionThisScore"("tripId");

CREATE INDEX IF NOT EXISTS "CaptionThisRound_tripId_idx" ON "CaptionThisRound"("tripId");
CREATE INDEX IF NOT EXISTS "CaptionThisRound_tripId_phase_idx" ON "CaptionThisRound"("tripId", "phase");
CREATE INDEX IF NOT EXISTS "CaptionThisRound_dayKey_idx" ON "CaptionThisRound"("dayKey");
