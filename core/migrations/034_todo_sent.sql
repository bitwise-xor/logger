-- A Todoist task is made once (core item 33, 21.11.2026). todos._create adds a task inside the transaction that saves a
-- message (or an answer, or a waiting item sent later); when a later step of that transaction failed, the rows rolled back
-- but the task stayed in Todoist, and the retry added it again. Each add now has a key that is the same on every retry of
-- the same request (todos._create's `once`); right after Todoist made the task, the task is written here on its own
-- connection and committed, so a retry takes it from here instead of adding it again.
--   once  sha256 of the request's key (it may hold the item's words, which are not kept twice in clear)
--   task  the task as Todoist returned it; {"unsure": true, ...} when the add got no answer (a timeout): it may have been
--         made, so the next try first looks for it in Todoist (todos._made)
-- The nightly clean-up (maintenance.py) removes rows older than 7 days.
BEGIN;

CREATE TABLE todo_sent (
  once  text PRIMARY KEY,
  task  jsonb NOT NULL,
  at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON todo_sent TO core_rw;

COMMIT;
