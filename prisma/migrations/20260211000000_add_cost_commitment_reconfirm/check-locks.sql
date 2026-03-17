-- Run these in Supabase SQL Editor to see what's blocking the Trip table.
-- Run the first query; if you see rows, something is locking Trip.

-- 1) Who is blocking / waiting, and what are they doing?
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocking_activity.query AS blocking_query,
  blocked_activity.query AS blocked_query,
  now() - blocking_activity.query_start AS blocking_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 2) All current activity (see if anything is "idle in transaction" on Trip)
SELECT pid, usename, state, query_start, state_change, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
ORDER BY query_start;

-- 3) Locks on the Trip table specifically (relation name might be "Trip")
SELECT l.pid, l.mode, l.granted, a.state, left(a.query, 100) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
JOIN pg_class c ON c.oid = l.relation
WHERE c.relname = 'Trip';
