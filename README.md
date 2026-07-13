# Vehicle Maintenance

Service history plus annual renewal reminders (registration, inspection,
insurance) for every household vehicle.

- **Storage:** D1 (`vehicles`, `service_log`, `renewals`)
- **Access:** all tables `adult_writable` — everyone reads, adults manage.
- **Reminders:** `renewals` is wired to the hub `date_reminders` cron
  (month/day + lead_days + `last_reminded_at` stamp); requires the cron+email
  capabilities.
- **Money:** service costs stored as integer cents (`cost_cents`).
- **AI:** read-only exports `vehicles`, `recent_service`, `upcoming_renewals`.

## Develop

```bash
make install
make dev
make test
make build
```
