-- AI read export: annual renewals ordered by calendar position (month, day).
-- The caller derives "days until next occurrence" from these columns.
-- kind is declared in db_plaintext_columns; the INTEGER month/day columns are
-- never encrypted.
SELECT
  id,
  vehicle_id,
  kind,
  title,
  event_month,
  event_day,
  lead_days,
  notes
FROM app_vehicle_maintenance__renewals
ORDER BY event_month, event_day
LIMIT 200
