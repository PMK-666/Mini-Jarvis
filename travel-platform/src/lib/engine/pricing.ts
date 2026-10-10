/**
 * Pricing & Availability, step 5: itemised total in NOK.
 * The platform service fee is an assumption for the prototype (3 %), to be set commercially.
 */
import type { ComponentResult, PriceLine, PriceSummary, ResolvedItinerary } from "../domain/types";

export const SERVICE_FEE_RATE = 0.03;

const CATEGORY: Record<string, PriceLine["category"]> = {
  flight: "Flights",
  stay: "Accommodation",
  transfer: "Transportation",
  activity: "Activities",
};

export function priceItinerary(
  it: ResolvedItinerary,
  results: Map<string, ComponentResult> | ComponentResult[],
  opts: { useReferencePrices?: boolean } = {},
): PriceSummary {
  const map = results instanceof Map ? results : new Map(results.map((r) => [r.componentId, r]));
  const lines: PriceLine[] = [];
  const unpriced: string[] = [];
  for (const c of it.components) {
    if (!c.included) continue;
    const r = map.get(c.id);
    const price = r?.offer?.price ?? (opts.useReferencePrices ? r?.referencePrice : undefined);
    if (!price) {
      unpriced.push(c.id);
      continue;
    }
    lines.push({
      componentId: c.id,
      label: r?.offer ? `${c.title} · ${r.offer.productName}` : c.title,
      category: CATEGORY[c.kind],
      price,
    });
  }
  const cats: PriceLine["category"][] = ["Flights", "Accommodation", "Transportation", "Activities"];
  const byCategory = cats
    .map((category) => {
      const ls = lines.filter((l) => l.category === category);
      return {
        category,
        base: ls.reduce((s, l) => s + l.price.base, 0),
        taxesAndFees: ls.reduce((s, l) => s + l.price.taxesAndFees, 0),
        total: ls.reduce((s, l) => s + l.price.total, 0),
      };
    })
    .filter((c) => c.total > 0 || lines.some((l) => l.category === c.category));
  const base = lines.reduce((s, l) => s + l.price.base, 0);
  const taxesAndFees = lines.reduce((s, l) => s + l.price.taxesAndFees, 0);
  const subtotal = base + taxesAndFees;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const total = subtotal + serviceFee;
  return {
    lines,
    byCategory,
    subtotal: base,
    taxesAndFees,
    serviceFee,
    serviceFeeRate: SERVICE_FEE_RATE,
    total,
    perPerson: Math.round(total / Math.max(1, it.travelers)),
    currency: "NOK",
    hasEstimates: lines.some((l) => l.price.source === "estimate"),
    unpriced,
  };
}
