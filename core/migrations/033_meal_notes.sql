-- A one-line note on a meal (21.11.2026, the Food space at logger.; the note on a single food stays food_entries.note).
-- Meal numbers are not stable (assign_meals renumbers a day's meals by time whenever its entries change), so a note is not
-- stored against a meal number: it is anchored to a time, `at` (the time of the meal's first entry when it was saved), and
-- belongs to the meal of the day's food entry nearest to `at` (drinks left out; ties: the earlier entry). A day with no such
-- entry left shows it as a note on the day. The one place that resolves this is core/app/mealnotes.py. Not visible to the
-- Google Sheet's reader.
CREATE TABLE food_meal_notes (
  id          bigserial PRIMARY KEY,
  day         date NOT NULL,
  at          timestamptz NOT NULL,
  note        text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 300),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX food_meal_notes_day ON food_meal_notes (day);

CREATE TRIGGER log_change_trg AFTER INSERT OR UPDATE OR DELETE ON food_meal_notes FOR EACH ROW EXECUTE FUNCTION log_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON food_meal_notes TO core_rw;
GRANT USAGE, SELECT ON SEQUENCE food_meal_notes_id_seq TO core_rw;
