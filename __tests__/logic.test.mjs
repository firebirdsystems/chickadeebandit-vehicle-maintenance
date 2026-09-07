import { describe, it, expect } from "vitest";
import {
  kindMeta, daysInMonth, nextOccurrence, daysUntil, countdownLabel,
  upcomingRenewals, sortedLog, totalCostCents, parseMoneyToCents, latestOdometer, searchableFields,
  nextRenewalDate, remindOnDate, renewalReviewTitle, renewalSummary, renewalInputsChanged, shortDate,
} from "../src/logic.js";

const FROM = new Date(2026, 6, 12, 9, 0, 0); // July 12, 2026 local

describe("date math", () => {
  it("handles leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
  it("rolls to next year when this year's date passed", () => {
    const next = nextOccurrence(3, 1, FROM);
    expect(next.getFullYear()).toBe(2027);
  });
  it("counts whole days, 0 for today", () => {
    expect(daysUntil(7, 12, FROM)).toBe(0);
    expect(daysUntil(7, 13, FROM)).toBe(1);
  });
  it("clamps Feb 29 to Feb 28 in non-leap years", () => {
    const next = nextOccurrence(2, 29, FROM); // 2027 is not a leap year
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });
});

describe("countdownLabel", () => {
  it("buckets by proximity", () => {
    expect(countdownLabel(0)).toBe("Today");
    expect(countdownLabel(1)).toBe("Tomorrow");
    expect(countdownLabel(5)).toBe("In 5 days");
    expect(countdownLabel(21)).toBe("In 3 weeks");
    expect(countdownLabel(91)).toBe("In 3 months");
  });
});

describe("upcomingRenewals", () => {
  it("sorts soonest first and drops invalid rows", () => {
    const rows = [
      { id: "a", title: "Registration", event_month: 9, event_day: 30 },
      { id: "b", title: "Inspection", event_month: 8, event_day: 1 },
      { id: "c", title: "Broken", event_month: 0, event_day: 1 },
    ];
    const out = upcomingRenewals(rows, FROM);
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
    expect(out[0]._days).toBeGreaterThan(0);
  });
});

describe("sortedLog", () => {
  it("orders newest service_date first", () => {
    const log = [
      { id: "a", service_date: "2026-02-02", created_at: "1" },
      { id: "b", service_date: "2026-05-14", created_at: "1" },
    ];
    expect(sortedLog(log).map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("money", () => {
  it("totals cents, skipping nulls", () => {
    expect(totalCostCents([{ cost_cents: 8900 }, { cost_cents: null }, { cost_cents: 100 }])).toBe(9000);
  });
  it("parses dollar strings to integer cents", () => {
    expect(parseMoneyToCents("89")).toBe(8900);
    expect(parseMoneyToCents("89.5")).toBe(8950);
    expect(parseMoneyToCents("$1,200.99")).toBe(120099);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1.999")).toBeNull();
  });
});

describe("latestOdometer", () => {
  it("returns the max recorded reading", () => {
    expect(latestOdometer([{ odometer: 38900 }, { odometer: 41200 }, { odometer: null }])).toBe(41200);
    expect(latestOdometer([])).toBeNull();
  });
});

describe("kindMeta", () => {
  it("falls back to other", () => expect(kindMeta("bogus").value).toBe("other"));
});

describe("searchableFields", () => {
  it("matches on the service notes, not just the entry title", () => {
    const fields = searchableFields({ title: "Brake pads", notes: "Halfords, front only", service_date: "2026-03-04" });
    expect(fields).toContain("Halfords, front only");
  });
});

const TODAY = "2026-07-12"; // the household's day, not the device's

describe("nextRenewalDate", () => {
  it("projects the next annual occurrence as a full date", () => {
    expect(nextRenewalDate(9, 30, TODAY)).toBe("2026-09-30");
  });
  it("rolls into next year once this year's day has passed", () => {
    expect(nextRenewalDate(3, 1, TODAY)).toBe("2027-03-01");
  });
  it("keeps today itself, so a renewal due today still gets an entry", () => {
    expect(nextRenewalDate(7, 12, TODAY)).toBe("2026-07-12");
  });
  it("lands Feb 29 on Feb 28 in a non-leap year rather than skipping the year", () => {
    expect(nextRenewalDate(2, 29, TODAY)).toBe("2027-02-28");
    expect(nextRenewalDate(2, 29, "2028-01-01")).toBe("2028-02-29");
  });
  it("returns null for an unusable month/day or a missing household day", () => {
    // The publisher guards on this: a blank event_date reaches the automation
    // runner as `missing required param` and fails the whole run.
    expect(nextRenewalDate(0, 1, TODAY)).toBeNull();
    expect(nextRenewalDate(13, 1, TODAY)).toBeNull();
    expect(nextRenewalDate(9, 0, TODAY)).toBeNull();
    expect(nextRenewalDate(9, 30, "")).toBeNull();
    expect(nextRenewalDate(9, 30, undefined)).toBeNull();
  });
});

describe("remindOnDate", () => {
  it("sits lead_days before the renewal, not on it", () => {
    expect(remindOnDate("2026-09-30", 14, TODAY)).toBe("2026-09-16");
    expect(remindOnDate("2026-09-30", 0, TODAY)).toBe("2026-09-30");
  });
  it("crosses a month boundary correctly", () => {
    expect(remindOnDate("2026-09-05", 30, TODAY)).toBe("2026-08-06");
  });
  it("clamps to today rather than dating an entry into the past", () => {
    // A renewal added a week before it is due would otherwise be dated last
    // week, where no calendar will ever surface it.
    expect(remindOnDate("2026-07-15", 30, TODAY)).toBe(TODAY);
  });
  it("returns null when there is no usable renewal date", () => {
    expect(remindOnDate("", 14, TODAY)).toBeNull();
    expect(remindOnDate(null, 14, TODAY)).toBeNull();
    expect(remindOnDate("nope", 14, TODAY)).toBeNull();
  });
});

describe("calendar entry text", () => {
  it("names the thing that is due", () => {
    expect(renewalReviewTitle({ title: "Registration" })).toBe("Registration due");
  });
  it("says which vehicle, what kind, and the real deadline", () => {
    const summary = renewalSummary({ kind: "registration", notes: "renew at the DMV on Elm" }, "Blue Subaru", "2026-09-30");
    expect(summary).toBe("Blue Subaru · registration due Sep 30");
    // The notes never reach the entry: they would travel to an external
    // calendar service through the ICS feed.
    expect(summary).not.toContain("DMV");
  });
  it("formats a stored date without going through a UTC instant", () => {
    expect(shortDate("2026-01-01")).toBe("Jan 1");
  });
});

describe("renewalInputsChanged", () => {
  const base = { event_month: 9, event_day: 30, lead_days: 14, title: "Registration", kind: "registration", notes: "" };
  it("is true for a first announcement", () => {
    expect(renewalInputsChanged(null, base)).toBe(true);
  });
  it("is true when the date, the lead time, the title or the kind moves", () => {
    expect(renewalInputsChanged(base, { ...base, event_month: 10 })).toBe(true);
    expect(renewalInputsChanged(base, { ...base, event_day: 29 })).toBe(true);
    expect(renewalInputsChanged(base, { ...base, lead_days: 7 })).toBe(true);
    expect(renewalInputsChanged(base, { ...base, title: "Reg." })).toBe(true);
    expect(renewalInputsChanged(base, { ...base, kind: "inspection" })).toBe(true);
  });
  it("is false for a notes-only edit", () => {
    // Re-announcing is idempotent but still spends an automation run, and rules
    // are rate limited per day. Notes never reach the entry at all.
    expect(renewalInputsChanged(base, { ...base, notes: "fixed a typo" })).toBe(false);
  });
  it("is false when nothing changed", () => {
    expect(renewalInputsChanged(base, { ...base })).toBe(false);
  });
});
