/**
 * "From" prices for the marketplace: the cheapest complete version of each trip for its
 * default travellers on its default dates. Computed by the same engine (no latency) and cached.
 */
import type { TripTemplate } from "./domain/types";
import { defaultPlan } from "./data/trips";
import { applyPatch, runAvailability } from "./engine";

export interface StartingPrice {
  perPerson: number;
  total: number;
  travelers: number;
  startDate: string;
  byCategory: { category: string; total: number }[];
  serviceFee: number;
  at: number;
}

const cache = new Map<string, StartingPrice>();

export async function startingPrice(t: TripTemplate): Promise<StartingPrice> {
  const hit = cache.get(t.slug);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
  let plan = defaultPlan(t);
  const first = await runAvailability(t, plan, { scenario: "all-available" });
  for (const issue of first.issues) {
    const cheapest = issue.alternatives?.slice().sort((a, b) => (a.priceDelta ?? 0) - (b.priceDelta ?? 0))[0];
    if (cheapest) plan = applyPatch(plan, cheapest.patch);
  }
  const q = await runAvailability(t, plan, { scenario: "all-available", withAlternatives: false });
  const value: StartingPrice = {
    perPerson: q.pricing.perPerson,
    total: q.pricing.total,
    travelers: plan.travelers,
    startDate: plan.startDate,
    byCategory: q.pricing.byCategory.map((c) => ({ category: c.category, total: c.total })),
    serviceFee: q.pricing.serviceFee,
    at: Date.now(),
  };
  cache.set(t.slug, value);
  return value;
}
