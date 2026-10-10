/**
 * Itinerary Orchestrator, step 1: apply a customer's plan to a template.
 *
 * Produces absolute dates for every component while preserving the template's sequence.
 * Changing the number of nights at one stay shifts everything after it, so the trip keeps
 * its shape when customised.
 */
import { addDays } from "../domain/dates";
import type {
  OpenSegment,
  ResolvedComponent,
  ResolvedItinerary,
  StayComponent,
  TemplateComponent,
  TripPlan,
  TripTemplate,
} from "../domain/types";
import { templateNights } from "../data/trips";

interface Flat {
  c: Exclude<TemplateComponent, { kind: "choice" }>;
  startDay: number;
  fromChoice?: { choiceId: string; optionId: string };
}

export function nightsFor(stay: StayComponent, plan: TripPlan): number {
  return Math.max(1, stay.nights + (plan.stays[stay.id]?.nightsDelta ?? 0));
}

/** Flatten choices into concrete components (selected option only) with template day offsets. */
function flatten(t: TripTemplate, plan: TripPlan): { flat: Flat[]; open: OpenSegment[] } {
  const flat: Flat[] = [];
  const open: OpenSegment[] = [];
  for (const c of t.components) {
    if (c.kind !== "choice") {
      flat.push({ c, startDay: c.startDay });
      continue;
    }
    const selected = c.options.find((o) => o.id === plan.choices[c.id]);
    open.push({
      choiceId: c.id,
      title: c.title,
      date: "", // filled after shifting
      nights: c.nights,
      selectedOptionId: selected?.id,
      options: c.options.map((o) => ({ id: o.id, title: o.title, description: o.description, selfArranged: o.selfArranged })),
      provenance: c.provenance,
      note: c.note,
    });
    if (selected) {
      for (const oc of selected.components) {
        if (oc.kind === "choice") continue; // nested choices are not supported
        flat.push({ c: oc, startDay: c.startDay + oc.startDay, fromChoice: { choiceId: c.id, optionId: selected.id } });
      }
    }
  }
  return { flat, open };
}

export function resolveItinerary(t: TripTemplate, plan: TripPlan): ResolvedItinerary {
  const { flat, open } = flatten(t, plan);

  // Night changes: each stay whose original end is on/before a component's start shifts it.
  const deltas = flat
    .filter((f): f is Flat & { c: StayComponent } => f.c.kind === "stay")
    .map((f) => ({ id: f.c.id, start: f.startDay, origEnd: f.startDay + f.c.nights, nights: nightsFor(f.c, plan), delta: nightsFor(f.c, plan) - f.c.nights }));
  const shiftFor = (day: number, selfId?: string) =>
    deltas.filter((d) => d.id !== selfId && d.delta !== 0 && d.origEnd <= day).reduce((s, d) => s + d.delta, 0);
  const totalDelta = deltas.reduce((s, d) => s + d.delta, 0);
  const totalNights = templateNights(t) + totalDelta;

  const at = (day: number) => addDays(plan.startDate, day);
  const components: ResolvedComponent[] = [];

  for (const { c, startDay, fromChoice } of flat) {
    let day = startDay + shiftFor(startDay, c.id);
    const includedByDefault = (c as { includedByDefault?: boolean }).includedByDefault;
    const included = c.required || (plan.activities[c.id] ?? includedByDefault ?? c.kind !== "activity");
    const base = {
      id: c.id,
      title: c.title,
      provenance: c.provenance,
      note: c.note,
      required: c.required,
      included,
      dependsOn: c.dependsOn ?? [],
      fromChoice,
    };
    switch (c.kind) {
      case "flight":
        components.push({
          ...base,
          kind: "flight",
          date: at(day),
          singleTicket: c.singleTicket,
          cabin: plan.cabin,
          legs: c.legs.map((l, i) => ({
            ...l,
            date: at(day + l.dayOffset),
            chosenFlightNo: plan.flights[`${c.id}:${i}`] ?? l.flightNo,
          })),
        });
        break;
      case "stay": {
        const nights = nightsFor(c, plan);
        const override = plan.stays[c.id];
        const propertyId = override?.propertyId ?? c.propertyId;
        const roomId = override?.propertyId && override.propertyId !== c.propertyId ? override.roomId : (override?.roomId ?? c.roomId);
        components.push({
          ...base,
          kind: "stay",
          date: at(day),
          checkIn: at(day),
          checkOut: at(day + nights),
          nights,
          city: c.city,
          propertyId,
          roomId,
          optionPropertyIds: c.optionPropertyIds,
          rooms: Math.ceil(plan.travelers / 2),
        });
        break;
      }
      case "transfer":
        components.push({ ...base, kind: "transfer", date: at(day), productId: c.productId, after: c.after, before: c.before, time: c.time });
        break;
      case "activity": {
        // Keep activities inside a shortened stay.
        const host = deltas.find((d) => d.start <= startDay && startDay < d.origEnd);
        if (host && startDay >= host.start + host.nights) day = host.start + host.nights - 1 + shiftFor(host.start, host.id);
        components.push({ ...base, kind: "activity", date: at(day), productId: c.productId });
        break;
      }
    }
  }

  for (const o of open) {
    const choice = t.components.find((c) => c.id === o.choiceId)!;
    o.date = at(choice.startDay + shiftFor(choice.startDay));
  }

  components.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    slug: t.slug,
    startDate: plan.startDate,
    endDate: at(totalNights),
    totalNights,
    travelers: plan.travelers,
    components,
    openSegments: open,
  };
}
