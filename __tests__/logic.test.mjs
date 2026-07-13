import { describe, it, expect } from "vitest";
import {
  kindMeta, daysInMonth, nextOccurrence, daysUntil, countdownLabel,
  upcomingRenewals, sortedLog, totalCostCents, parseMoneyToCents, latestOdometer,
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
