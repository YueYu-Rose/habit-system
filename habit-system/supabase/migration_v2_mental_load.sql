-- HabitOS V2.0 mental-load upgrade (JSON schema update notes)
--
-- Existing rows in user_habit_data.catalog do not need hard migration:
-- missing keys are handled by client-side parser defaults.
-- This script is intentionally lightweight for compatibility.

-- Optional: touch updated_at to mark rollout window (no data rewrite).
update public.user_habit_data
set updated_at = now()
where updated_at is not null;

-- V2.0 expected catalog keys:
-- {
--   "customDoneMeta": { [date]: { [habitId]: { backfillDays, decayRate, awardedPoints, recordedAtIso } } },
--   "heartbeats": { [date]: { atIso, mood } }
-- }
