-- Fix Room table sequence if it's out of sync
-- Run this if you get "Unique constraint failed on the fields: (id)" errors

SELECT setval(
    pg_get_serial_sequence('"Room"', 'id'),
    COALESCE((SELECT MAX(id) FROM "Room"), 1),
    true
);
