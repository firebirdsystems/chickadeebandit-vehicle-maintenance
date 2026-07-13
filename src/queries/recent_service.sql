-- AI read export: recent service-log entries, newest first.
-- service_date is declared in db_plaintext_columns so this ORDER BY is
-- meaningful; cost_cents is integer minor units.
SELECT
  id,
  vehicle_id,
  service_date,
  title,
  odometer,
  cost_cents,
  notes
FROM app_vehicle_maintenance__service_log
ORDER BY service_date DESC
LIMIT 200
