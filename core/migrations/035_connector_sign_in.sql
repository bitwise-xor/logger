-- The connector's sign-in (core item 36, 21.11.2026). A stranger could lock the owner out of it: every failed try went into one
-- pool, and 50 junk client registrations blocked a new connector for good (nothing removed one).
--   oauth_clients.used_at  when the owner first signed in with this client (auth.login_submit); NULL = never signed in with.
--                          A client never used is removed after a day (maintenance.py), or as the oldest such one when the
--                          limit of registered clients is reached (auth.register_client); a used one never is.
-- The connector's failed tries are counted as the web's are (014): a device that signed in before (its cookie, hashed in
-- trusted_devices) counts its own; every other try goes into the connector's own shared pool, login_failures.device_hash
-- 'connector' (auth.CONNECTOR_POOL; not a hash, so it never meets one of the web's pools).
BEGIN;

ALTER TABLE oauth_clients ADD COLUMN used_at timestamptz;
-- clients with a live token or code now are the owner's: they count as used
UPDATE oauth_clients c SET used_at = now()
 WHERE EXISTS (SELECT 1 FROM oauth_tokens t WHERE t.client_id = c.client_id)
    OR EXISTS (SELECT 1 FROM oauth_codes k WHERE k.data->>'client_id' = c.client_id);
GRANT UPDATE (used_at) ON oauth_clients TO core_rw;

COMMIT;
