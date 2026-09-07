import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });
  it("entrypoint/runtime/storage are standard", () => {
    expect(manifest.entrypoint).toBe("index.html");
    expect(manifest.runtime).toBe("static");
    expect(manifest.storage).toBe("db");
  });
  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));
  it("has a nav label", () => expect(manifest.nav?.label).toBeTruthy());

  it("all tables are adult_writable (everyone reads, adults manage)", () => {
    for (const table of ["vehicles", "service_log", "renewals"]) {
      expect(manifest.row_policies?.[table]?.kind, table).toBe("adult_writable");
    }
  });

  it("date_reminders is wired to the renewals table with plaintext-safe columns", () => {
    const d = manifest.date_reminders;
    expect(d?.table).toBe("renewals");
    expect(d?.month_column).toBe("event_month");
    expect(d?.day_column).toBe("event_day");
    expect(d?.last_reminded_column).toBe("last_reminded_at");
    expect(manifest.required_capabilities).toContain("cron");
    expect(manifest.required_capabilities).toContain("email");
  });

  it("SQL-filtered columns are declared plaintext", () => {
    expect(manifest.db_plaintext_columns).toContain("kind");
    expect(manifest.db_plaintext_columns).toContain("service_date");
  });

  describe("calendar automations", () => {
    it("publishes both halves of the calendar pair, adults only", () => {
      for (const type of ["vehicle.renewal_added", "vehicle.renewal_cancelled"]) {
        expect(manifest.publishes).toContain(type);
        // Each drives a trusted write in another app (a calendar entry, and its
        // removal), so a child must not be able to POST a fabricated one.
        expect(manifest.publish_acls?.[type]).toEqual({ require_role: "adult" });
      }
    });

    it("triggers on events this app actually publishes", () => {
      // The hub only offers a suggestion whose trigger has an installed
      // publisher, so a typo here makes the rule invisible rather than broken.
      for (const s of manifest.suggested_automations) {
        expect(manifest.publishes, s.trigger_event).toContain(s.trigger_event);
      }
    });

    it("maps every required param of the calendar actions it targets", () => {
      // create_event requires title AND event_date; an unmapped required param
      // fails the run with `missing required param`.
      const create = manifest.suggested_automations.find((s) => s.action_id === "create_event");
      expect(create.target_app_id).toBe("calendar");
      expect(create.param_map.title).toEqual({ kind: "payload_field", value: "review_title" });
      expect(create.param_map.event_date).toEqual({ kind: "payload_field", value: "remind_on" });
      // The entry sits on the reminder day, not the renewal day: the point of a
      // renewal nudge is to act before the date, not on it.
      expect(create.param_map.event_date.value).not.toBe("renewal_date");
      expect(create.param_map.source_ref_id).toEqual({ kind: "payload_field", value: "source_ref_id" });
    });

    it("ships the retraction beside the announcement, on the same reference", () => {
      const create = manifest.suggested_automations.find((s) => s.action_id === "create_event");
      const retract = manifest.suggested_automations.find((s) => s.action_id === "retract_dated_event");
      expect(retract.target_app_id).toBe("calendar");
      expect(retract.trigger_event).toBe("vehicle.renewal_cancelled");
      // A mismatch between the two references silently retracts nothing.
      expect(retract.param_map.source_ref_id).toEqual(create.param_map.source_ref_id);
      // Only the reference is mapped: a retraction carrying a date or a title
      // would be claiming to know something it is not scoped by.
      expect(Object.keys(retract.param_map)).toEqual(["source_ref_id"]);
    });

    it("does not put the service log on the calendar", () => {
      // A service entry records a PAST visit. There is nothing upcoming in it.
      for (const s of manifest.suggested_automations) {
        expect(s.trigger_event).not.toBe("vehicle.service_logged");
      }
    });

    it("keeps the email reminder lane untouched", () => {
      // date_reminders is the hub's cron/email lane and is a separate feature
      // from the calendar entry: a household can have either, both, or neither.
      expect(manifest.date_reminders?.table).toBe("renewals");
      expect(manifest.date_reminders?.lead_days_column).toBe("lead_days");
    });
  });

  it("ai exports match the query files", () => {
    expect(manifest.ai_access?.db_exports?.sort()).toEqual(["recent_service", "upcoming_renewals", "vehicles"]);
  });
});
