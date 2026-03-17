-- Remove AdminUser and Trip.hostId (admin section removed; ownership is via TripMember.role)
ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_hostId_fkey";
DROP INDEX IF EXISTS "Trip_hostId_idx";
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "hostId";
DROP TABLE IF EXISTS "AdminUser";
