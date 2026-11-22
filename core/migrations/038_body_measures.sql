-- The body measures come from the database (web item 58, 22.11.2026): log_types.body_measure marks a tape measure, so the
-- owner can add, change, move and remove measures in Settings > Body at logger. (the door's POST /settings/body_measure,
-- websettings.measure_*). The five of 024 are marked; a new one is a row like them (kind measurement, category vitals, unit cm).
-- core_rw may already insert and delete log_types rows (016, 017) and change label and sort_order (016); a measure's form also
-- changes its range, its words and its landmark, so those columns get their own UPDATE right. log_types has no change-log
-- trigger (010), so nothing else is needed.
ALTER TABLE log_types ADD COLUMN body_measure boolean NOT NULL DEFAULT false;
UPDATE log_types SET body_measure = true WHERE name IN ('waist', 'hips', 'chest', 'upper_arm', 'thigh');
GRANT UPDATE (min1, max1, aliases, notes) ON log_types TO core_rw;
