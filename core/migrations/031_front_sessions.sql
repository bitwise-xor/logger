-- The new front end's sessions (16.11.2026, deploy 75): the JSON door /api/v1 (api.py) signs the owner in with the same
-- password, code, limits and trusted devices as /web/login and keeps the session in web_sessions, so it is listed under
-- Settings > Devices and renewed like a page view. The new column says which front end a session belongs to:
--   NULL      the web app at app. (its cookie, web.current_session)
--   'logger'  the new front end, through the door only (a bearer token; api.py)
-- A session of one never works in the other. core_rw's table-wide grants on web_sessions cover the new column.
ALTER TABLE web_sessions ADD COLUMN front text CHECK (front IN ('logger'));
