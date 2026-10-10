import type { PlanPatch, TripPlan } from "../domain/types";

/** Apply an alternative's change to a plan. Pure; safe to use in the browser. */
export function applyPatch(plan: TripPlan, patch: PlanPatch): TripPlan {
  const stays = { ...plan.stays };
  for (const [id, v] of Object.entries(patch.stays ?? {})) stays[id] = { ...stays[id], ...v };
  return {
    ...plan,
    startDate: patch.startDate ?? plan.startDate,
    stays,
    choices: { ...plan.choices, ...patch.choices },
    flights: { ...plan.flights, ...patch.flights },
    activities: { ...plan.activities, ...patch.activities },
  };
}
