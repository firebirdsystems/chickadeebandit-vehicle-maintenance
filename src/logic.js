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

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * The notes count as well as the service title — "which garage did
 * the brakes" is written in the notes of a service entry.
 */
export function searchableFields(item) {
  return [item.title, item.notes, item.service_date];
}

/* ── Calendar automation helpers ───────────────────────────────────────────────
 * Two separate lanes hang off a renewal, and they are not the same thing.
 * `date_reminders` (see manifest.json) is the hub's EMAIL lane: cron
 * reads event_month/event_day/lead_days straight off the row and sends a
 * message. It is untouched by anything below. These helpers feed the OTHER
 * lane — the `vehicle.renewal_added` event an automation rule turns into a
 * calendar entry, which is also what lands in the household's ICS feed. The
 * renewals table stores a month and a day, never a year, so the calendar's
 * `create_event` (which demands a full yyyy-mm-dd) has to be handed a
 * projected date; that projection is what nextRenewalDate is for.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoOf(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-09-30" → "Sep 30". Parsed as a plain calendar date, never a UTC
 *  instant, so it can't slide a day for a household west of Greenwich. */
export function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  const month = Number(m[2]);
  if (month < 1 || month > 12) return String(iso ?? "");
  return `${MONTHS[month - 1]} ${Number(m[3])}`;
}

/**
 * The next annual occurrence of (month, day) on or after the household's own
 * calendar day, as a full `yyyy-mm-dd`. Null when the row has no usable
 * month/day, or when the caller could not supply a household day — a blank
 * date reaches the automation runner as `missing required param` and fails the
 * whole run, so the publisher has to guard on this being non-null.
 *
 * Built on the existing `nextOccurrence`, deliberately: that is the same
 * projection the countdown in the renewals list already shows, and a second
 * implementation would eventually disagree with it about which year a date
 * falls in. Its `makeDate` clamps the day to the length of the month, so a
 * 29 February renewal lands on 28 February in a non-leap year — a registration
 * that is due "end of February" is due in every February, and the alternative
 * (skipping to 2032) would silently drop three years of reminders.
 *
 * `todayIso` is the HOUSEHOLD's day (hubToday()), not the device's: near
 * midnight, or for a member travelling, the two name different days and the
 * projection would roll a year early or late.
 */
export function nextRenewalDate(month, day, todayIso) {
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayIso ?? ""))) return null;
  const from = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(from.getTime())) return null;
  return isoOf(nextOccurrence(m, d, from));
}

/**
 * The day the calendar entry goes on: `lead_days` before the renewal, clamped
 * so it never lands in the past.
 *
 * The entry is dated the lead day rather than the renewal day on purpose. The
 * point of a renewal nudge is to act BEFORE the date — booking the inspection,
 * paying the registration — and an entry on the day itself arrives when the
 * only remaining option is being late. Clamping matters because a renewal
 * added a week before it is due would otherwise be dated last week, where no
 * calendar will ever surface it.
 *
 * Null when there is no usable renewal date; the caller must not publish then.
 */
export function remindOnDate(renewalDate, leadDays, todayIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(renewalDate ?? ""))) return null;
  const renewal = new Date(`${renewalDate}T12:00:00`);
  if (Number.isNaN(renewal.getTime())) return null;
  const lead = Math.max(0, Math.floor(Number(leadDays)) || 0);
  const remindOn = new Date(renewal.getFullYear(), renewal.getMonth(), renewal.getDate() - lead, 12, 0, 0, 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayIso ?? ""))) return isoOf(remindOn);
  const today = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(today.getTime())) return isoOf(remindOn);
  return remindOn < today ? isoOf(today) : isoOf(remindOn);
}

/** Calendar-entry title. Names the thing that is due, because the entry shows
 *  up in a month grid beside everything else the household has on. */
export function renewalReviewTitle(renewal) {
  return `${String(renewal?.title ?? "Renewal").trim() || "Renewal"} due`;
}

/** Second line of the calendar entry: which vehicle, what kind of renewal, and
 *  the day it is actually due — the lead day is where the entry sits, so the
 *  real deadline has to be said somewhere. The row's `notes` are deliberately
 *  NOT here: free text a member typed for the household reaches an external
 *  calendar service through the ICS feed. */
export function renewalSummary(renewal, vehicleName, renewalDate) {
  const parts = [];
  if (vehicleName) parts.push(String(vehicleName));
  parts.push(`${kindMeta(renewal?.kind).label.toLowerCase()} due ${shortDate(renewalDate)}`);
  return parts.join(" · ");
}

/**
 * Whether an edit changed anything the calendar entry is built FROM.
 * Announcing is idempotent — the calendar upserts on source_ref_id — but it
 * still spends an automation run, and rules are rate limited per day. A
 * notes-only edit must therefore not re-announce: the notes never reach the
 * entry at all.
 *
 * `title` and `kind` are in the list even though neither moves the date,
 * because both are rendered INTO the entry (review_title / summary) and an
 * entry naming the wrong thing is as wrong as one on the wrong day. That is
 * the opposite call from subscriptions, where the name is cosmetic on a row
 * that re-announces every billing cycle anyway; an annual renewal would carry
 * a stale title for a year.
 */
export function renewalInputsChanged(prev, next) {
  if (!prev) return true;
  return ["event_month", "event_day", "lead_days", "title", "kind"]
    .some((k) => String(prev[k] ?? "") !== String(next[k] ?? ""));
}
