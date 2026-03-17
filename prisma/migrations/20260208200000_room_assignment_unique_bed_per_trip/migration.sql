-- One bed can only be claimed by one guest per trip (PostgreSQL allows multiple NULLs in UNIQUE).
CREATE UNIQUE INDEX "RoomAssignment_tripId_bedId_key" ON "RoomAssignment"("tripId", "bedId");
