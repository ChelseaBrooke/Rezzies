-- Optional wizard room category (bedroom, living-room, …) for labels when listing has no photo
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "roomType" TEXT;
