/**
 * Pure business logic for the Vehicle Maintenance app.
 * No DOM, no fetch — importable in both browser and test environments.
 */

export const RENEWAL_KINDS = [
  { value: "registration", label: "Registration", icon: "📋" },
  { value: "inspection",   label: "Inspection",   icon: "🔧" },
  { value: "insurance",    label: "Insurance",    icon: "🛡️" },
  { value: "other",        label: "Other",        icon: "📌" },
];

const KIND_BY_VALUE = new Map(RENEWAL_KINDS.map((k) => [k.value, k]));

export function kindMeta(kind) {
  return KIND_BY_VALUE.get(kind) ?? { value: "other", label: "Other", icon: "📌" };
}

/** Days in a given month (1-12) of a given year, honoring leap years. */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function makeDate(year, month, day) {
  const clamped = Math.min(day, daysInMonth(year, month));
  return new Date(year, month - 1, clamped, 12, 0, 0, 0);
}

function atMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Next date on/after `from` on which (month, day) recurs annually. */
export function nextOccurrence(month, day, from = new Date()) {
  const today = atMidnight(from);
  let candidate = atMidnight(makeDate(today.getFullYear(), month, day));
  if (candidate < today) candidate = atMidnight(makeDate(today.getFullYear() + 1, month, day));
  return candidate;
}

/** Whole days from `from` until the next occurrence. 0 = today. */
export function daysUntil(month, day, from = new Date()) {
  return Math.round((nextOccurrence(month, day, from) - atMidnight(from)) / 86400000);
}

/** "Today" / "Tomorrow" / "In 12 days" / "In 3 months". */
export function countdownLabel(days) {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  if (days < 365) return `In ${Math.round(days / 30)} months`;
  return "In a year";
}

/** Renewals decorated with countdown, soonest first; invalid rows dropped. */
export function upcomingRenewals(renewals, from = new Date()) {
  return renewals
    .map((r) => {
      const month = Number(r.event_month);
      const day = Number(r.event_day);
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1) return null;
      return { ...r, _days: daysUntil(month, day, from) };
    })
    .filter(Boolean)
    .sort((a, b) => a._days - b._days || String(a.title).localeCompare(String(b.title)));
}

/** Service log sorted newest-first by service_date (ties: created_at). */
export function sortedLog(log) {
  return [...log].sort(
    (a, b) => String(b.service_date).localeCompare(String(a.service_date))
      || String(b.created_at).localeCompare(String(a.created_at)),
  );
}

/** Total cost in cents across log entries (null costs skipped). */
export function totalCostCents(log) {
  return log.reduce((sum, e) => sum + (Number.isFinite(Number(e.cost_cents)) && e.cost_cents != null ? Number(e.cost_cents) : 0), 0);
}

/** Parse a user-entered dollar amount ("45", "45.50", "$1,200.99") to cents; null if empty/invalid. */
export function parseMoneyToCents(raw) {
  const s = String(raw ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

/** Highest odometer reading in the log (null when none recorded). */
export function latestOdometer(log) {
  const vals = log.map((e) => Number(e.odometer)).filter((n) => Number.isFinite(n) && n > 0);
  return vals.length ? Math.max(...vals) : null;
}
