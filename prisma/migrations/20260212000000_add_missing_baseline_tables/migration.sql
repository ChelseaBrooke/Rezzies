-- Gap-filler: creates tables that were only in the removed 0_init snapshot.
-- All statements use IF NOT EXISTS so this is safe to apply against the live DB
-- (which already has them) and the shadow DB (which doesn't).

-- ── Poll system ───────────────────────────────────────────────────────────────
-- Note: polls_enhanced (20260214) later renames question->title and tweaks status.

CREATE TABLE IF NOT EXISTS "Poll" (
    "id"               TEXT          NOT NULL,
    "tripId"           TEXT          NOT NULL,
    "createdById"      TEXT          NOT NULL,
    "question"         TEXT          NOT NULL,
    "status"           TEXT          NOT NULL DEFAULT 'active',
    "allowAnonymous"   BOOLEAN       NOT NULL DEFAULT false,
    "activityDate"     TIMESTAMP(3),
    "activityTime"     TEXT,
    "activityLocation" TEXT,
    "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Poll_tripId_idx"        ON "Poll"("tripId");
CREATE INDEX IF NOT EXISTS "Poll_tripId_status_idx" ON "Poll"("tripId", "status");

CREATE TABLE IF NOT EXISTS "PollOption" (
    "id"        TEXT    NOT NULL,
    "pollId"    TEXT    NOT NULL,
    "label"     TEXT    NOT NULL,
    "order"     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PollOption_pollId_idx" ON "PollOption"("pollId");

CREATE TABLE IF NOT EXISTS "PollVote" (
    "id"        TEXT         NOT NULL,
    "pollId"    TEXT         NOT NULL,
    "optionId"  TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);
-- Original unique was (pollId, userId); polls_enhanced changes it to (pollId, userId, optionId)
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_pollId_userId_key" ON "PollVote"("pollId", "userId");
CREATE INDEX IF NOT EXISTS "PollVote_pollId_idx" ON "PollVote"("pollId");
CREATE INDEX IF NOT EXISTS "PollVote_userId_idx"  ON "PollVote"("userId");

CREATE TABLE IF NOT EXISTS "PollWatcher" (
    "id"        TEXT         NOT NULL,
    "pollId"    TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollWatcher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PollWatcher_pollId_userId_key" ON "PollWatcher"("pollId", "userId");
CREATE INDEX IF NOT EXISTS "PollWatcher_pollId_idx" ON "PollWatcher"("pollId");
CREATE INDEX IF NOT EXISTS "PollWatcher_userId_idx"  ON "PollWatcher"("userId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Poll_tripId_fkey') THEN
        ALTER TABLE "Poll" ADD CONSTRAINT "Poll_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Poll_createdById_fkey') THEN
        ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollOption_pollId_fkey') THEN
        ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey"
            FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollVote_pollId_fkey') THEN
        ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey"
            FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollVote_optionId_fkey') THEN
        ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey"
            FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollVote_userId_fkey') THEN
        ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollWatcher_pollId_fkey') THEN
        ALTER TABLE "PollWatcher" ADD CONSTRAINT "PollWatcher_pollId_fkey"
            FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollWatcher_userId_fkey') THEN
        ALTER TABLE "PollWatcher" ADD CONSTRAINT "PollWatcher_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── TripGame ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TripGame" (
    "id"            TEXT         NOT NULL,
    "tripId"        TEXT         NOT NULL,
    "gameId"        TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "addedByUserId" TEXT         NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripGame_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TripGame_tripId_gameId_key" ON "TripGame"("tripId", "gameId");
CREATE INDEX IF NOT EXISTS "TripGame_tripId_idx" ON "TripGame"("tripId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TripGame_tripId_fkey') THEN
        ALTER TABLE "TripGame" ADD CONSTRAINT "TripGame_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TripGame_addedByUserId_fkey') THEN
        ALTER TABLE "TripGame" ADD CONSTRAINT "TripGame_addedByUserId_fkey"
            FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── Chat messages ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id"        TEXT         NOT NULL,
    "tripId"    TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "message"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChatMessage_tripId_idx"           ON "ChatMessage"("tripId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx"        ON "ChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_tripId_createdAt_idx" ON "ChatMessage"("tripId", "createdAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_tripId_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_userId_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── Direct messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "DirectMessage" (
    "id"          TEXT         NOT NULL,
    "senderId"    TEXT         NOT NULL,
    "recipientId" TEXT         NOT NULL,
    "message"     TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DirectMessage_senderId_idx"              ON "DirectMessage"("senderId");
CREATE INDEX IF NOT EXISTS "DirectMessage_recipientId_idx"           ON "DirectMessage"("recipientId");
CREATE INDEX IF NOT EXISTS "DirectMessage_senderId_recipientId_idx"  ON "DirectMessage"("senderId", "recipientId");
CREATE INDEX IF NOT EXISTS "DirectMessage_createdAt_idx"             ON "DirectMessage"("createdAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_senderId_fkey') THEN
        ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey"
            FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_recipientId_fkey') THEN
        ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey"
            FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── Caption This game ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CaptionThisRound" (
    "id"                   TEXT         NOT NULL,
    "tripId"               TEXT         NOT NULL,
    "dayKey"               TEXT         NOT NULL,
    "phase"                TEXT         NOT NULL,
    "photoUrl"             TEXT,
    "photoSubmitterUserId" TEXT,
    "tripTimezone"         TEXT         NOT NULL DEFAULT 'UTC',
    "endsAtMidnightTs"     TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptionThisRound_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CaptionThisRound_tripId_idx"       ON "CaptionThisRound"("tripId");
CREATE INDEX IF NOT EXISTS "CaptionThisRound_tripId_phase_idx" ON "CaptionThisRound"("tripId", "phase");
CREATE INDEX IF NOT EXISTS "CaptionThisRound_dayKey_idx"       ON "CaptionThisRound"("dayKey");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisRound_tripId_fkey') THEN
        ALTER TABLE "CaptionThisRound" ADD CONSTRAINT "CaptionThisRound_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisRound_photoSubmitterUserId_fkey') THEN
        ALTER TABLE "CaptionThisRound" ADD CONSTRAINT "CaptionThisRound_photoSubmitterUserId_fkey"
            FOREIGN KEY ("photoSubmitterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CaptionThisCaption" (
    "id"        TEXT         NOT NULL,
    "roundId"   TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "text"      VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptionThisCaption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CaptionThisCaption_roundId_userId_key" ON "CaptionThisCaption"("roundId", "userId");
CREATE INDEX IF NOT EXISTS "CaptionThisCaption_roundId_idx" ON "CaptionThisCaption"("roundId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisCaption_roundId_fkey') THEN
        ALTER TABLE "CaptionThisCaption" ADD CONSTRAINT "CaptionThisCaption_roundId_fkey"
            FOREIGN KEY ("roundId") REFERENCES "CaptionThisRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisCaption_userId_fkey') THEN
        ALTER TABLE "CaptionThisCaption" ADD CONSTRAINT "CaptionThisCaption_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CaptionThisVote" (
    "id"          TEXT         NOT NULL,
    "roundId"     TEXT         NOT NULL,
    "voterUserId" TEXT         NOT NULL,
    "captionId"   TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptionThisVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CaptionThisVote_roundId_voterUserId_key" ON "CaptionThisVote"("roundId", "voterUserId");
CREATE INDEX IF NOT EXISTS "CaptionThisVote_roundId_idx"   ON "CaptionThisVote"("roundId");
CREATE INDEX IF NOT EXISTS "CaptionThisVote_captionId_idx" ON "CaptionThisVote"("captionId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisVote_roundId_fkey') THEN
        ALTER TABLE "CaptionThisVote" ADD CONSTRAINT "CaptionThisVote_roundId_fkey"
            FOREIGN KEY ("roundId") REFERENCES "CaptionThisRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisVote_captionId_fkey') THEN
        ALTER TABLE "CaptionThisVote" ADD CONSTRAINT "CaptionThisVote_captionId_fkey"
            FOREIGN KEY ("captionId") REFERENCES "CaptionThisCaption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisVote_voterUserId_fkey') THEN
        ALTER TABLE "CaptionThisVote" ADD CONSTRAINT "CaptionThisVote_voterUserId_fkey"
            FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CaptionThisScore" (
    "id"          TEXT         NOT NULL,
    "tripId"      TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "pointsTotal" INTEGER      NOT NULL DEFAULT 0,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptionThisScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CaptionThisScore_tripId_userId_key" ON "CaptionThisScore"("tripId", "userId");
CREATE INDEX IF NOT EXISTS "CaptionThisScore_tripId_idx" ON "CaptionThisScore"("tripId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisScore_tripId_fkey') THEN
        ALTER TABLE "CaptionThisScore" ADD CONSTRAINT "CaptionThisScore_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptionThisScore_userId_fkey') THEN
        ALTER TABLE "CaptionThisScore" ADD CONSTRAINT "CaptionThisScore_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── TripFile ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TripFile" (
    "id"           TEXT         NOT NULL,
    "tripId"       TEXT         NOT NULL,
    "uploadedById" TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "url"          TEXT         NOT NULL,
    "mimeType"     TEXT,
    "sizeBytes"    INTEGER,
    "category"     TEXT,
    "mealSlotId"   TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TripFile_tripId_idx"    ON "TripFile"("tripId");
CREATE INDEX IF NOT EXISTS "TripFile_mealSlotId_idx" ON "TripFile"("mealSlotId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TripFile_tripId_fkey') THEN
        ALTER TABLE "TripFile" ADD CONSTRAINT "TripFile_tripId_fkey"
            FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TripFile_uploadedById_fkey') THEN
        ALTER TABLE "TripFile" ADD CONSTRAINT "TripFile_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TripFile_mealSlotId_fkey') THEN
        ALTER TABLE "TripFile" ADD CONSTRAINT "TripFile_mealSlotId_fkey"
            FOREIGN KEY ("mealSlotId") REFERENCES "MealSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
