-- AI read export: the household's vehicles.
-- adult_writable reads are open to every member, so no member_id is required.
SELECT
  id,
  name,
  make_model,
  model_year,
  archived
FROM app_vehicle_maintenance__vehicles
ORDER BY created_at
LIMIT 50
