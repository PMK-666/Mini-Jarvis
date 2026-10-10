"use client";
import { useCallback } from "react";
import type { ScenarioId, TripPlan } from "../domain/types";
import { DEFAULT_SCENARIO } from "../providers/mock/scenarios";
import { useStored } from "./storage";

export function usePlan(defaults: TripPlan) {
  const [plan, setPlan, ready] = useStored<TripPlan>(`itinera.plan.${defaults.slug}`, defaults);
  // Guard against stale stored plans (e.g. a departure date that has since passed).
  const today = new Date().toISOString().slice(0, 10);
  const safe = ready && plan.slug === defaults.slug && plan.startDate > today ? plan : defaults;
  const reset = useCallback(() => setPlan(defaults), [defaults, setPlan]);
  return { plan: safe, setPlan, ready, reset };
}

export function useScenario() {
  const [scenario, setScenario, ready] = useStored<ScenarioId>("itinera.scenario", DEFAULT_SCENARIO);
  return { scenario, setScenario, ready };
}

export function useSaved() {
  const [saved, setSaved, ready] = useStored<string[]>("itinera.saved", []);
  const toggle = useCallback(
    (slug: string) => setSaved((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [slug, ...s])),
    [setSaved],
  );
  return { saved, toggle, ready };
}

export interface MyBooking {
  id: string;
  reference?: string;
  slug: string;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: number;
}

export function useMyBookings() {
  const [bookings, setBookings, ready] = useStored<MyBooking[]>("itinera.bookings", []);
  const add = useCallback(
    (b: MyBooking) => setBookings((list) => [b, ...list.filter((x) => x.id !== b.id)]),
    [setBookings],
  );
  return { bookings, add, ready };
}
