-- Polls enhanced: add new fields, rename question->title, update PollVote unique for multi-choice

-- Poll: add new columns
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'Other';
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "pollType" TEXT DEFAULT 'single';
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "showResultsLive" BOOLEAN DEFAULT true;
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3);
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);

-- Add title column (nullable first for migration)
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "title" TEXT;

-- Copy question to title for existing rows
UPDATE "Poll" SET "title" = "question" WHERE "title" IS NULL AND "question" IS NOT NULL;

-- For any row where title is still null (new inserts), use placeholder
UPDATE "Poll" SET "title" = COALESCE("question", 'Untitled poll') WHERE "title" IS NULL;

ALTER TABLE "Poll" ALTER COLUMN "title" SET NOT NULL;

-- Migrate status: active -> open, closed -> closed
UPDATE "Poll" SET "status" = 'open' WHERE "status" = 'active';

-- Add status default for new rows
ALTER TABLE "Poll" ALTER COLUMN "status" SET DEFAULT 'draft';

-- Drop question column
ALTER TABLE "Poll" DROP COLUMN IF EXISTS "question";

-- Create index for category
CREATE INDEX IF NOT EXISTS "Poll_tripId_category_idx" ON "Poll"("tripId", "category");

-- PollOption: map sortOrder to existing "order" column (Prisma @map("order")) - no change needed; column already exists as "order"

-- PollVote: change unique constraint for multi-choice support
DROP INDEX IF EXISTS "PollVote_pollId_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_pollId_userId_optionId_key" ON "PollVote"("pollId", "userId", "optionId");
