-- One whole-room claim (bedId NULL) per trip + room — prevents double-booking a room.
CREATE UNIQUE INDEX IF NOT EXISTS "RoomAssignment_whole_room_per_trip_room"
ON "RoomAssignment" ("tripId", "roomId")
WHERE "bedId" IS NULL;
