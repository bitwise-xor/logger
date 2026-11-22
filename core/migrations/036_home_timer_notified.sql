-- The Home timer's notification (web item 57, 22.11.2026): a phone notification at the moment the pick timer ends (hometimer.py,
-- a thread of the core that looks every 10 seconds).
--   home_timers.notified_at  when the timer's end was claimed for its notification; NULL = not yet. The claim is one UPDATE that
--                            sets it, so two rounds (or two processes) never send twice; a timer that ended more than 10 minutes
--                            before it was seen (the core was down) is never announced late, and keeps NULL.
-- core_rw's table-wide grants on home_timers (026) cover the new column.
ALTER TABLE home_timers ADD COLUMN notified_at timestamptz;
