import { describe, expect, it } from "vitest";
import { defaultPlan, getTrip, listTrips } from "@/lib/data/trips";
import { applyPatch } from "@/lib/engine";
import { resolveItinerary } from "@/lib/engine/resolve";
import { FLIGHTS } from "@/lib/providers/mock/inventory";
import { zonedToUtc, addDays } from "@/lib/domain/dates";
import { place } from "@/lib/domain/places";
import { completePlan, NOW, ph, run } from "./helpers";

describe("trip templates", () => {
  it("Philippines template reproduces the original route and dates", () => {
    const it = resolveItinerary(ph, defaultPlan(ph, NOW));
    expect(it.startDate).toBe("2026-12-11");
    expect(it.endDate).toBe("2027-01-03");
    const stays = it.components.filter((c) => c.kind === "stay");
    expect(stays.map((s) => s.kind === "stay" && [s.checkIn, s.checkOut, s.propertyId])).toEqual([
      ["2026-12-12", "2026-12-15", undefined], // Bangkok: incomplete, not invented
      ["2026-12-15", "2026-12-16", "waterfront-airport-cebu"],
      ["2026-12-16", "2026-12-19", "paolyn-houseboats"],
      ["2026-12-19", "2026-12-23", "two-seasons-coron"],
      ["2026-12-23", "2026-12-29", "cauayan"],
    ]);
    expect(it.openSegments[0]).toMatchObject({ date: "2026-12-29", nights: 4, selectedOptionId: undefined });
  });

  it("shifts every date with a new departure, keeping duration and order", () => {
    const it = resolveItinerary(ph, { ...defaultPlan(ph, NOW), startDate: "2027-02-05" });
    expect(it.endDate).toBe("2027-02-28");
    expect(it.components.find((c) => c.id === "stay-cauayan")).toMatchObject({ checkIn: "2027-02-17", checkOut: "2027-02-23" });
  });

  it("changing nights at one stay moves everything after it", () => {
    const it = resolveItinerary(ph, applyPatch(defaultPlan(ph, NOW), { stays: { "stay-twoseasons": { nightsDelta: 2 } } }));
    expect(it.totalNights).toBe(25);
    expect(it.components.find((c) => c.id === "stay-twoseasons")).toMatchObject({ checkOut: "2026-12-25" });
    expect(it.components.find((c) => c.id === "flight-usu-eni")?.date).toBe("2026-12-25");
    expect(it.components.find((c) => c.id === "stay-houseboat")).toMatchObject({ checkIn: "2026-12-16" });
  });

  it("every mock flight has a plausible duration after time-zone conversion", () => {
    for (const f of FLIGHTS) {
      const dep = zonedToUtc("2027-03-01", f.dep, place(f.from).tz);
      const arr = zonedToUtc(addDays("2027-03-01", f.arrDayOffset), f.arr, place(f.to).tz);
      const h = (arr - dep) / 3_600_000;
      expect(h, f.flightNo).toBeGreaterThan(0.5);
      expect(h, f.flightNo).toBeLessThan(16);
    }
  });

  it("every sample trip is bookable in the all-available scenario once choices are made", async () => {
    for (const t of listTrips()) {
      let plan = defaultPlan(t, NOW);
      const first = await run(plan);
      for (const i of first.issues) if (i.alternatives?.[0]) plan = applyPatch(plan, i.alternatives[0].patch);
      const q = await run(plan);
      expect(q.issues.filter((i) => i.severity === "blocker"), t.slug).toEqual([]);
      expect(q.bookable, t.slug).toBe(true);
    }
  });
});

describe("availability engine — Philippines", () => {
  it("never fills incomplete parts silently", async () => {
    const q = await run(defaultPlan(ph, NOW));
    expect(q.bookable).toBe(false);
    expect(q.results.find((r) => r.componentId === "stay-bkk")?.status).toBe("needs_selection");
    expect(q.issues.map((i) => i.rule)).toEqual(expect.arrayContaining(["needs-selection", "open-segment"]));
    expect(q.issues.find((i) => i.rule === "open-segment")?.alternatives?.map((a) => a.label)).toHaveLength(3);
  });

  it("books cleanly when everything is available and decided", async () => {
    const q = await run(completePlan());
    expect(q.bookable).toBe(true);
    expect(q.pricing.unpriced).toEqual([]);
    expect(q.pricing.total).toBe(q.pricing.subtotal + q.pricing.taxesAndFees + q.pricing.serviceFee);
    expect(q.pricing.lines.every((l) => l.price.source === "simulated")).toBe(true);
    // Engine-picked flights are disclosed
    expect(q.issues.some((i) => i.rule === "provenance" && i.componentIds[0] === "flight-return")).toBe(true);
  });

  it("offers labelled, priced alternatives when the resort room is sold out", async () => {
    const q = await run(completePlan(), "cauayan-room-unavailable");
    const issue = q.issues.find((i) => i.id === "unavailable:stay-cauayan")!;
    expect(issue.severity).toBe("blocker");
    const ids = issue.alternatives!.map((a) => a.id.split(":")[0]);
    expect(ids).toEqual(expect.arrayContaining(["room", "property", "dates", "realloc"]));
    for (const a of issue.alternatives!) expect(typeof a.priceDelta).toBe("number");

    // Every alternative actually resolves the problem.
    for (const a of issue.alternatives!) {
      const next = await run(applyPatch(q.plan, a.patch), "cauayan-room-unavailable");
      expect(next.issues.find((i) => i.id === issue.id), a.label).toBeUndefined();
    }
  });

  it("re-allocating nights keeps the total trip length", async () => {
    const q = await run(completePlan(), "cauayan-room-unavailable");
    const realloc = q.issues.flatMap((i) => i.alternatives ?? []).find((a) => a.id.startsWith("realloc"))!;
    const next = await run(applyPatch(q.plan, realloc.patch), "cauayan-room-unavailable");
    expect(next.itinerary.totalNights).toBe(23);
    expect(next.bookable).toBe(true);
    expect(next.itinerary.components.find((c) => c.id === "flight-usu-eni")?.date).toBe("2026-12-25");
  });

  it("refuses a resort you can't reach and proposes a flight that works", async () => {
    const q = await run(completePlan(), "late-flight-transfer");
    const issue = q.issues.find((i) => i.rule === "transfer-feasibility")!;
    expect(issue.title).toMatch(/can't reach Cauayan Island Resort/);
    expect(issue.componentIds).toEqual(expect.arrayContaining(["transfer-eni-cauayan", "flight-usu-eni", "stay-cauayan"]));
    expect(q.bookable).toBe(false);
    const alt = issue.alternatives![0];
    expect(alt.label).toMatch(/T6404/);
    const next = await run(applyPatch(q.plan, alt.patch), "late-flight-transfer");
    expect(next.bookable).toBe(true);
  });

  it("flags prices that are only estimates as not bookable", async () => {
    const q = await run(completePlan({ startDate: "2027-12-11" }));
    expect(q.issues.some((i) => i.rule === "not-on-sale")).toBe(true);
    expect(q.bookable).toBe(false);
  });

  it("moving a night between stays keeps every night covered once", async () => {
    const plan = applyPatch(completePlan(), { stays: { "stay-ceb": { nightsDelta: 1 }, "stay-houseboat": { nightsDelta: -1 } } });
    const q = await run(plan);
    expect(q.itinerary.totalNights).toBe(23);
    expect(q.issues.filter((i) => i.rule === "nights")).toEqual([]);
  });

  it("handles more travellers with more rooms and refuses over-capacity", async () => {
    const q = await run(completePlan({ travelers: 8 }));
    expect(q.results.find((r) => r.componentId === "stay-houseboat")?.status).toBe("unavailable");
    expect(q.issues.find((i) => i.id === "unavailable:stay-houseboat")?.alternatives?.length).toBeGreaterThan(0);
  });
});

describe("other trips", () => {
  it("Maldives seaplane must leave inside operating hours", async () => {
    const t = getTrip("maldives-luxury")!;
    const q = await run(defaultPlan(t, NOW));
    expect(q.bookable).toBe(true);
    const seaplane = q.results.find((r) => r.componentId === "seaplane-out")!;
    expect(seaplane.offer!.startLocal!.slice(11)).toBe("06:25") // 09:45 departure − 150 min at airport − 50 min flight;
  });
});
