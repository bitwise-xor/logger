-- A reminder time for one habit (web item 49, 22.11.2026): log_types.remind_after is the hours after waking at which the phone
-- reminds the owner of this habit while it is still open today (nudges.py, kind habit-<name>); NULL = no reminder of its own.
-- 0.5 to 15.5 in half hours (the awake frame of the nudges is 16 hours); the door and app.'s functions check the range, the table
-- keeps it too. core_rw has column-level rights on log_types (016, 017), so the new column gets its own UPDATE right. log_types has
-- no change-log trigger (010), so nothing else is needed.
ALTER TABLE log_types ADD COLUMN remind_after numeric CHECK (remind_after IS NULL OR (remind_after >= 0.5 AND remind_after <= 15.5));
GRANT UPDATE (remind_after) ON log_types TO core_rw;
