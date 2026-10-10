/**
 * Itinerary Orchestrator, step 3: validate the whole trip as one connected journey.
 *
 * A trip is only bookable when there are no blockers. Warnings are shown but don't block.
 */
import { addDays, localDate, localTime, minutesToHm } from "../domain/dates";
import { place } from "../domain/places";
import type {
  ComponentResult,
  Issue,
  Offer,
  ResolvedFlight,
  ResolvedItinerary,
  ResolvedStay,
  ResolvedTransfer,
} from "../domain/types";
import { findProperty, findTransfer } from "../providers/mock/inventory";
import { minConnectionMinutes, type SearchOutput } from "./search";

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Separate-ticket connections: below this is blocked, below the recommended is a warning. */
export const SELF_TRANSFER_MIN = 90;
export const SELF_TRANSFER_RECOMMENDED = 180;

export function windowProblem(t: ResolvedTransfer, offer: Offer | undefined): string | undefined {
  const product = findTransfer(t.productId);
  if (!product?.window || !offer?.startLocal || !offer.endLocal) return undefined;
  const start = localTime(offer.startLocal);
  const end = localTime(offer.endLocal);
  const sameDay = localDate(offer.startLocal) === localDate(offer.endLocal);
  if (start < product.window.start) {
    return `${product.mode} transfers run from ${product.window.start}, but this one would have to leave at ${start}.`;
  }
  if (!sameDay || end > product.window.end) {
    return `${product.mode} transfers stop at ${product.window.end} (no crossings after dark). This one would arrive at ${end}.`;
  }
  return undefined;
}

export function validateItinerary(it: ResolvedItinerary, search: SearchOutput): Issue[] {
  const issues: Issue[] = [];
  const res = (id: string): ComponentResult | undefined => search.results.get(id);
  const included = it.components.filter((c) => c.included);
  const stays = included.filter((c): c is ResolvedStay => c.kind === "stay");
  const flights = included.filter((c): c is ResolvedFlight => c.kind === "flight");
  const transfers = included.filter((c): c is ResolvedTransfer => c.kind === "transfer");

  // R1 — every included component needs a bookable result.
  for (const c of included) {
    const r = res(c.id);
    if (!r) continue;
    if (r.status === "needs_selection") {
      issues.push({
        id: `select:${c.id}`,
        severity: "blocker",
        rule: "needs-selection",
        componentIds: [c.id],
        title: `Choose where to stay in ${c.title}`,
        detail: r.message ?? "This part of the original itinerary is incomplete.",
      });
    } else if (r.status === "unavailable") {
      issues.push({
        id: `unavailable:${c.id}`,
        severity: "blocker",
        rule: "unavailable",
        componentIds: [c.id],
        title: c.kind === "stay" ? `${c.title}: your room is unavailable` : `${c.title} is unavailable`,
        detail: r.message ?? "The supplier has no availability for these dates.",
      });
    } else if (r.status === "error") {
      issues.push({
        id: `error:${c.id}`,
        severity: "blocker",
        rule: "dependency",
        componentIds: [c.id, ...c.dependsOn],
        title: `${c.title} can't be confirmed yet`,
        detail: r.message ?? "A component this depends on is not resolved.",
      });
    }
  }

  // R2 — open segments.
  for (const o of it.openSegments) {
    const opt = o.options.find((x) => x.id === o.selectedOptionId);
    const range = `${fmtDay(o.date)} – ${fmtDay(addDays(o.date, o.nights))}`;
    if (!opt) {
      issues.push({
        id: `open:${o.choiceId}`,
        severity: "blocker",
        rule: "open-segment",
        componentIds: [o.choiceId],
        title: `${o.nights} nights still open (${range})`,
        detail: o.note ?? "Decide how to spend these nights.",
      });
    } else if (opt.selfArranged) {
      issues.push({
        id: `self:${o.choiceId}`,
        severity: "warning",
        rule: "self-arranged",
        componentIds: [o.choiceId],
        title: `You're arranging ${range} yourself`,
        detail: "Nothing is booked for these nights and Itinera can't guarantee you reach your next flight. Leave enough time to get to the airport.",
      });
    }
  }

  // R3 — connections within a flight component (same ticket).
  for (const f of flights) {
    const o = res(f.id)?.offer;
    if (!o?.segments) continue;
    for (const s of o.segments) {
      if (s.arrUtc <= s.depUtc) {
        issues.push({
          id: `tz:${f.id}:${s.flightNo}`,
          severity: "blocker",
          rule: "time-consistency",
          componentIds: [f.id],
          title: `Schedule error on ${s.flightNo}`,
          detail: "Arrival is before departure after time-zone conversion. The supplier schedule must be corrected.",
        });
      }
    }
    for (let i = 1; i < o.segments.length; i++) {
      const a = o.segments[i - 1];
      const b = o.segments[i];
      const gap = Math.round((b.depUtc - a.arrUtc) / 60_000);
      const mct = minConnectionMinutes(a.from, a.to, b.to);
      if (a.to !== b.from) {
        issues.push({ id: `airport:${f.id}:${i}`, severity: "blocker", rule: "connection", componentIds: [f.id], title: "Airport change during connection", detail: `${a.flightNo} lands at ${a.to} but ${b.flightNo} leaves from ${b.from}.` });
      } else if (gap < mct) {
        issues.push({
          id: `mct:${f.id}:${i}`,
          severity: "blocker",
          rule: "connection",
          componentIds: [f.id],
          title: `Connection in ${place(a.to).city} is too short`,
          detail: `${minutesToHm(Math.max(gap, 0))} between ${a.flightNo} and ${b.flightNo}; at least ${minutesToHm(mct)} is required.`,
        });
      } else if (gap > 16 * 60) {
        issues.push({ id: `long:${f.id}:${i}`, severity: "warning", rule: "connection", componentIds: [f.id], title: `Long layover in ${place(a.to).city}`, detail: `${minutesToHm(gap)} between flights.` });
      }
    }
  }

  // R4 — separate-ticket connections between flight components.
  const flightOffers = flights
    .map((f) => ({ f, o: res(f.id)?.offer }))
    .filter((x): x is { f: ResolvedFlight; o: Offer } => !!x.o?.segments)
    .sort((a, b) => a.o.startUtc! - b.o.startUtc!);
  for (let i = 1; i < flightOffers.length; i++) {
    const prev = flightOffers[i - 1];
    const next = flightOffers[i];
    const last = prev.o.segments![prev.o.segments!.length - 1];
    const first = next.o.segments![0];
    if (last.to !== first.from) continue;
    const gap = Math.round((first.depUtc - last.arrUtc) / 60_000);
    if (gap > 24 * 60) continue;
    if (gap < SELF_TRANSFER_MIN) {
      issues.push({
        id: `selfx:${prev.f.id}:${next.f.id}`,
        severity: "blocker",
        rule: "self-transfer",
        componentIds: [prev.f.id, next.f.id],
        title: `Connection in ${place(last.to).city} is too tight`,
        detail: `Only ${minutesToHm(Math.max(gap, 0))} between separately booked flights. At least ${minutesToHm(SELF_TRANSFER_MIN)} is required.`,
      });
    } else if (gap < SELF_TRANSFER_RECOMMENDED) {
      issues.push({
        id: `selfx:${prev.f.id}:${next.f.id}`,
        severity: "warning",
        rule: "self-transfer",
        componentIds: [prev.f.id, next.f.id],
        title: `Short self-transfer in ${place(last.to).city}`,
        detail: `${minutesToHm(gap)} between separate tickets. If the first flight is late, the second airline isn't obliged to rebook you; 3 h or more is recommended.`,
      });
    }
  }

  // R5 — transfers must run inside their operating window, and actually reach the next stay.
  for (const t of transfers) {
    const r = res(t.id);
    const problem = windowProblem(t, r?.offer);
    if (!problem) continue;
    const flightId = t.after ?? t.before;
    const nextStay = t.after ? stays.find((s) => s.checkIn === localDate(r!.offer!.startLocal!) || s.checkIn === t.date) : undefined;
    const name = nextStay?.propertyId ? findProperty(nextStay.propertyId)?.name : undefined;
    issues.push({
      id: `reach:${t.id}`,
      severity: "blocker",
      rule: "transfer-feasibility",
      componentIds: [t.id, ...(flightId ? [flightId] : []), ...(nextStay ? [nextStay.id] : [])],
      title: t.after
        ? `You can't reach ${name ?? "your next stay"} on ${fmtDay(localDate(r!.offer!.startLocal!))}`
        : `No transfer early enough for your flight`,
      detail: problem,
    });
  }

  // R6 — every night covered exactly once (stay, overnight flight, or self-arranged).
  const selfArranged = it.openSegments.filter((o) => o.options.find((x) => x.id === o.selectedOptionId)?.selfArranged);
  const unselectedOpen = it.openSegments.filter((o) => !o.selectedOptionId);
  for (let n = 0; n < it.totalNights; n++) {
    const night = addDays(it.startDate, n);
    const covering = stays.filter((s) => s.checkIn <= night && night < s.checkOut);
    const inAir = flightOffers.some(({ o }) => localDate(o.segments![0].depLocal) <= night && night < localDate(o.segments![o.segments!.length - 1].arrLocal));
    const open = [...selfArranged, ...unselectedOpen].some((o) => o.date <= night && night < addDays(o.date, o.nights));
    if (covering.length > 1) {
      issues.push({
        id: `overlap:${night}`,
        severity: "blocker",
        rule: "nights",
        componentIds: covering.map((s) => s.id),
        title: `Two stays booked for the night of ${fmtDay(night)}`,
        detail: `${covering.map((s) => s.title).join(" and ")} overlap.`,
      });
    } else if (covering.length === 0 && !inAir && !open) {
      issues.push({
        id: `gap:${night}`,
        severity: "blocker",
        rule: "nights",
        componentIds: [],
        title: `No accommodation on the night of ${fmtDay(night)}`,
        detail: "Every night of the trip needs a stay, an overnight journey, or to be marked as self-arranged.",
      });
    }
  }

  // R7 — arrival vs. check-in.
  for (const { o } of flightOffers) {
    const last = o.segments![o.segments!.length - 1];
    const city = place(last.to).city;
    const arrDate = localDate(last.arrLocal);
    const stay = stays.find((s) => s.city === city && (s.checkIn === arrDate || s.checkIn === addDays(arrDate, -1)));
    if (!stay) continue;
    const prop = stay.propertyId ? findProperty(stay.propertyId) : undefined;
    if (arrDate > stay.checkIn) {
      issues.push({
        id: `latearr:${stay.id}`,
        severity: "warning",
        rule: "arrival",
        componentIds: [stay.id, o.componentId],
        title: `First night in ${stay.title} goes unused`,
        detail: `You land at ${localTime(last.arrLocal)} on ${fmtDay(arrDate)}, after your check-in date. Tell the hotel to avoid a no-show cancellation.`,
      });
    } else if (prop && localTime(last.arrLocal) < "11:00") {
      issues.push({
        id: `early:${stay.id}`,
        severity: "info",
        rule: "arrival",
        componentIds: [stay.id],
        title: `Early arrival in ${stay.title}`,
        detail: `You land at ${localTime(last.arrLocal)}; check-in at ${prop.name} is from ${prop.checkIn}. Ask for early check-in or add the night before.`,
      });
    }
  }

  // R8 — total duration.
  const lastFlight = flightOffers.at(-1);
  const lastArrival = lastFlight?.o.segments!.at(-1);
  if (lastFlight && lastArrival && localDate(lastArrival.arrLocal) !== it.endDate) {
    issues.push({
      id: "duration",
      severity: "warning",
      rule: "duration",
      componentIds: [lastFlight.f.id],
      title: "Trip length changed",
      detail: `You arrive home on ${fmtDay(localDate(lastArrival.arrLocal))}, not ${fmtDay(it.endDate)} as planned.`,
    });
  }

  // R9 — estimates are not bookable.
  const estimated = included.filter((c) => res(c.id)?.offer?.price.source === "estimate");
  if (estimated.length) {
    issues.push({
      id: "estimates",
      severity: "blocker",
      rule: "not-on-sale",
      componentIds: estimated.map((c) => c.id),
      title: "Some prices are estimates",
      detail: "Flights usually go on sale about 11 months before departure. Save the trip and check again later, or choose earlier dates.",
    });
  }

  // R10 — be explicit about what Itinera filled in.
  for (const f of flights) {
    const how = search.flightSelection.get(f.id);
    const o = res(f.id)?.offer;
    if (!o) continue;
    if (how === "engine") {
      issues.push({
        id: `filled:${f.id}`,
        severity: "info",
        rule: "provenance",
        componentIds: [f.id],
        title: `${f.title}: flights selected by Itinera`,
        detail: `${f.provenance === "incomplete" ? "These connections were never completed in the original itinerary." : "The original booking didn't record flight numbers."} Itinera chose ${o.productName}. Check the times before you book.`,
      });
    }
    if (o.meta?.assumedSchedule) {
      issues.push({
        id: `assumed:${f.id}`,
        severity: "info",
        rule: "provenance",
        componentIds: [f.id],
        title: `${f.title}: schedule times are assumed`,
        detail: "Exact times for this flight weren't available to the prototype. A live supplier search will replace them.",
      });
    }
  }

  const order = { blocker: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}
