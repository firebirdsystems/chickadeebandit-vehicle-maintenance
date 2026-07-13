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

  it("ai exports match the query files", () => {
    expect(manifest.ai_access?.db_exports?.sort()).toEqual(["recent_service", "upcoming_renewals", "vehicles"]);
  });
});
