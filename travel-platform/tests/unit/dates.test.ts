import { describe, expect, it } from "vitest";
import { addDays, daysBetween, utcToLocal, zonedToUtc } from "@/lib/domain/dates";

describe("dates & time zones", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-29", 5)).toBe("2027-01-03");
    expect(daysBetween("2026-12-11", "2027-01-03")).toBe(23);
  });
  it("converts wall-clock times in different zones", () => {
    // 13:20 in Oslo (UTC+1 in December) = 12:20 UTC
    expect(new Date(zonedToUtc("2026-12-11", "13:20", "Europe/Oslo")).toISOString()).toBe("2026-12-11T12:20:00.000Z");
    // Same wall-clock in summer is UTC+2
    expect(new Date(zonedToUtc("2027-07-03", "09:00", "Europe/Oslo")).toISOString()).toBe("2027-07-03T07:00:00.000Z");
    expect(utcToLocal(Date.parse("2026-12-11T23:15:00Z"), "Asia/Bangkok")).toBe("2026-12-12T06:15");
  });
});
