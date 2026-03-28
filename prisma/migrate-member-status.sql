-- Data migration: map old inviteStatus values to new scheme
UPDATE "TripMember" SET "inviteStatus" = 'approved' WHERE "inviteStatus" IN ('invited', 'accepted');
UPDATE "TripMember" SET "inviteStatus" = 'denied' WHERE "inviteStatus" = 'removed';
