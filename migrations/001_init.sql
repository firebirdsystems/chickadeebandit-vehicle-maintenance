-- Vehicle Maintenance — service history + annual renewal reminders per vehicle.
--
-- Access: all three tables are `adult_writable` (manifest.json) — every member
-- may read (a teen driver can check when the inspection is due), only adults
-- write. Nothing here is per-member private.
--
-- `renewals` are annually-recurring dates (registration, inspection,
-- insurance) anchored on (event_month, event_day), wired to the hub's
-- date_reminders cron via the manifest `date_reminders` block — the hub emails
-- a nudge lead_days before each occurrence and stamps last_reminded_at
-- (trusted code; the app never writes that column).
--
-- Plaintext columns (manifest db_plaintext_columns): `kind` (renewal enum,
-- read by date_reminders + AI export) and `service_date` (ISO date the log
-- sorts on). cost_cents/odometer are INTEGER (money in integer cents).
-- Free text (titles, notes, plate) stays encrypted and is only displayed.
CREATE TABLE IF NOT EXISTS app_vehicle_maintenance__vehicles (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,                -- "Blue Subaru"
  make_model TEXT NOT NULL DEFAULT '',
  model_year INTEGER,
  plate      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  archived   INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_vehicle_maintenance__service_log (
  id           TEXT PRIMARY KEY,
  vehicle_id   TEXT NOT NULL,
  service_date TEXT NOT NULL,              -- ISO YYYY-MM-DD (plaintext, sorted in SQL)
  title        TEXT NOT NULL,              -- "Oil change", "New tires"
  odometer     INTEGER,                    -- miles/km reading at service time
  cost_cents   INTEGER,                    -- integer minor units; NULL = unknown
  notes        TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES app_vehicle_maintenance__vehicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_vehicle_maintenance__renewals (
  id               TEXT PRIMARY KEY,
  vehicle_id       TEXT NOT NULL,
  member_id        TEXT NOT NULL,           -- creator; date_reminders owner_column
  kind             TEXT NOT NULL DEFAULT 'registration', -- registration|inspection|insurance|other
  title            TEXT NOT NULL,           -- "Subaru registration"
  event_month      INTEGER NOT NULL CHECK (event_month BETWEEN 1 AND 12),
  event_day        INTEGER NOT NULL CHECK (event_day BETWEEN 1 AND 31),
  lead_days        INTEGER NOT NULL DEFAULT 14 CHECK (lead_days >= 0),
  visibility       TEXT NOT NULL DEFAULT 'everyone',
  notes            TEXT NOT NULL DEFAULT '',
  last_reminded_at TEXT,                    -- stamped by the hub reminder cron
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES app_vehicle_maintenance__vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_vehicle_maintenance__service_log_vehicle_idx
  ON app_vehicle_maintenance__service_log (vehicle_id, service_date);

CREATE INDEX IF NOT EXISTS app_vehicle_maintenance__renewals_when_idx
  ON app_vehicle_maintenance__renewals (event_month, event_day);
