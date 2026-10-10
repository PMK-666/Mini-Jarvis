import { defaultPlan, getTrip } from "@/lib/data/trips";
import type { ScenarioId, TripPlan } from "@/lib/domain/types";
import { applyPatch, runAvailability } from "@/lib/engine";
import { createMockProviders } from "@/lib/providers/registry";

export const NOW = Date.parse("2026-10-10T10:00:00Z");
export const ph = getTrip("philippines-honeymoon")!;

/** A Philippines plan with the incomplete parts decided, so it can be fully booked. */
export function completePlan(extra: Partial<TripPlan> = {}): TripPlan {
  return applyPatch(
    { ...defaultPlan(ph, NOW), ...extra },
    { stays: { "stay-bkk": { propertyId: "kimpton-maa-lai", roomId: "king" } }, choices: { "choice-open": "manila" } },
  );
}

export const run = (plan: TripPlan, scenario: ScenarioId = "all-available", providers = createMockProviders()) =>
  runAvailability(getTrip(plan.slug)!, plan, { scenario, now: NOW, providers });
