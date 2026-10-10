/**
 * Trip Template Service (Phase 1: in-code repository).
 * Phase 2+ moves templates to PostgreSQL (see db/schema.sql); callers only use these functions.
 */
import { addDays, daysBetween, todayIso } from "../../domain/dates";
import type { TripPlan, TripTemplate } from "../../domain/types";
import { philippines } from "./philippines";
import { samples } from "./samples";

const TRIPS: TripTemplate[] = [philippines, ...samples];

export function listTrips(): TripTemplate[] {
  return TRIPS;
}

export function getTrip(slug: string): TripTemplate | undefined {
  return TRIPS.find((t) => t.slug === slug);
}

export function allCategories(): string[] {
  const seen = new Set<string>();
  for (const t of TRIPS) for (const c of t.categories) seen.add(c);
  return [...seen];
}

export function templateNights(t: TripTemplate): number {
  return daysBetween(t.originalStartDate, t.originalEndDate);
}

/** Original departure date, or the same calendar day in the next future year if it has passed. */
export function defaultStartDate(t: TripTemplate, now = Date.now()): string {
  const today = todayIso(now);
  let d = t.originalStartDate;
  while (d <= addDays(today, 6)) {
    const [y, rest] = [Number(d.slice(0, 4)), d.slice(4)];
    d = `${y + 1}${rest}`;
  }
  return d;
}

export function defaultPlan(t: TripTemplate, now = Date.now()): TripPlan {
  return {
    slug: t.slug,
    startDate: defaultStartDate(t, now),
    travelers: t.defaultTravelers,
    cabin: "economy",
    stays: {},
    activities: {},
    choices: {},
    flights: {},
  };
}
