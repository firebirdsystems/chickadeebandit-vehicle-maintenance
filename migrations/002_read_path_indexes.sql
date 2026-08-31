-- recent_service orders by service_date DESC under LIMIT 200. service_date is
-- declared in db_plaintext_columns; the existing (vehicle_id, service_date)
-- index cannot serve an unfiltered ordering.
CREATE INDEX IF NOT EXISTS app_vehicle_maintenance__service_log_date_idx
  ON app_vehicle_maintenance__service_log(service_date);

-- vehicles orders by created_at under LIMIT 50, and that table had no index.
CREATE INDEX IF NOT EXISTS app_vehicle_maintenance__vehicles_created_idx
  ON app_vehicle_maintenance__vehicles(created_at);
