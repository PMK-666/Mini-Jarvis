/**
 * The booking engine: template → plan → live search → validation → alternatives → price.
 *
 * `runAvailability` is what "Check availability" calls. It streams progress events so the
 * customer can watch each component resolve, and returns a Quote that the checkout uses.
 */
import { addDays, daysBetween, localTime, todayIso } from "../domain/dates";
import type {
  Alternative,
  ComponentResult,
  Issue,
  Offer,
  PlanPatch,
  Quote,
  ResolvedItinerary,
  ResolvedStay,
  ResolvedTransfer,
  ScenarioId,
  TripPlan,
  TripTemplate,
} from "../domain/types";
import { PROPERTIES, findProperty, findTransfer } from "../providers/mock/inventory";
import { createMockProviders } from "../providers/registry";
import type { ProviderContext, ProviderRegistry, RoomAvailability } from "../providers/types";
import { applyPatch } from "./patch";
import { priceItinerary } from "./pricing";
import { resolveItinerary } from "./resolve";
import { searchItinerary, transferTiming, type SearchEvent, type SearchOutput } from "./search";
import { validateItinerary, windowProblem } from "./validate";

export type EngineEvent =
  | { type: "plan"; itinerary: ResolvedItinerary }
  | SearchEvent
  | { type: "phase"; phase: "validating" | "alternatives" | "pricing" }
  | { type: "quote"; quote: Quote }
  | { type: "error"; message: string };

export interface EngineOptions {
  scenario: ScenarioId;
  providers?: ProviderRegistry;
  now?: number;
  simulateLatency?: boolean;
  withAlternatives?: boolean;
  onEvent?: (e: EngineEvent) => void;
}

export const QUOTE_TTL_MS = 30 * 60_000;

interface Evaluation {
  itinerary: ResolvedItinerary;
  search: SearchOutput;
  issues: Issue[];
}

async function evaluate(t: TripTemplate, plan: TripPlan, providers: ProviderRegistry, ctx: ProviderContext, onEvent?: (e: EngineEvent) => void): Promise<Evaluation> {
  const itinerary = resolveItinerary(t, plan);
  onEvent?.({ type: "plan", itinerary });
  const search = await searchItinerary(itinerary, providers, ctx, onEvent);
  onEvent?.({ type: "phase", phase: "validating" });
  const issues = validateItinerary(itinerary, search);
  return { itinerary, search, issues };
}

export function validatePlanInput(t: TripTemplate, plan: TripPlan, now = Date.now()): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate)) return "Choose a valid departure date.";
  if (plan.startDate <= todayIso(now)) return "Departure must be in the future.";
  if (daysBetween(todayIso(now), plan.startDate) > 730) return "Departure must be within two years.";
  if (!Number.isInteger(plan.travelers) || plan.travelers < 1 || plan.travelers > 9) return "Between 1 and 9 travellers can book together.";
  if (plan.slug !== t.slug) return "Plan does not match trip.";
  return undefined;
}

export async function runAvailability(t: TripTemplate, plan: TripPlan, opts: EngineOptions): Promise<Quote> {
  const started = Date.now();
  const now = opts.now ?? Date.now();
  const providers = opts.providers ?? createMockProviders();
  const ctx: ProviderContext = { scenario: opts.scenario, now, simulateLatency: !!opts.simulateLatency };
  const ev = await evaluate(t, plan, providers, ctx, opts.onEvent);

  if (opts.withAlternatives !== false) {
    opts.onEvent?.({ type: "phase", phase: "alternatives" });
    await attachAlternatives(t, plan, ev, providers, { ...ctx, simulateLatency: false });
  }
  opts.onEvent?.({ type: "phase", phase: "pricing" });
  const pricing = priceItinerary(ev.itinerary, ev.search.results);
  const results = [...ev.search.results.values()];
  const quote: Quote = {
    id: `q_${Math.random().toString(36).slice(2, 10)}`,
    slug: t.slug,
    plan,
    scenario: opts.scenario,
    itinerary: ev.itinerary,
    results: ev.itinerary.components.map((c) => results.find((r) => r.componentId === c.id)!).filter(Boolean),
    issues: ev.issues,
    pricing,
    bookable: !ev.issues.some((i) => i.severity === "blocker") && pricing.unpriced.length === 0,
    createdAt: now,
    expiresAt: now + QUOTE_TTL_MS,
    elapsedMs: Date.now() - started,
  };
  opts.onEvent?.({ type: "quote", quote });
  return quote;
}

/* ------------------------------------------------------------- alternatives */

const fmtRange = (a: string, b: string) => {
  const f = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(a)} – ${f(b)}`;
};

async function cheapestAvailable(
  providers: ProviderRegistry,
  ctx: ProviderContext,
  stay: ResolvedStay,
  propertyId: string,
  travelers: number,
  checkIn = stay.checkIn,
  checkOut = stay.checkOut,
): Promise<RoomAvailability | undefined> {
  const rooms = await providers.stays.searchStay(
    { componentId: stay.id, propertyId, checkIn, checkOut, rooms: stay.rooms, guests: travelers },
    ctx,
  );
  return rooms.filter((r) => r.available).sort((a, b) => a.offer.price.total - b.offer.price.total)[0];
}

async function stayAlternatives(
  t: TripTemplate,
  plan: TripPlan,
  ev: Evaluation,
  stay: ResolvedStay,
  providers: ProviderRegistry,
  ctx: ProviderContext,
): Promise<Omit<Alternative, "priceDelta" | "newTotal">[]> {
  const alts: Omit<Alternative, "priceDelta" | "newTotal">[] = [];
  const rooms = ev.search.stayRooms.get(stay.id) ?? [];
  const current = stay.propertyId ? findProperty(stay.propertyId) : undefined;
  const wanted = rooms.find((r) => r.roomId === stay.roomId);
  const cur = plan.stays[stay.id] ?? {};

  // a) another room category
  for (const r of rooms.filter((x) => x.available && x.roomId !== stay.roomId)) {
    alts.push({
      id: `room:${stay.id}:${r.roomId}`,
      label: `${r.name} at ${current?.name}`,
      explanation: `Same resort and dates, different room category (${String(r.offer.meta?.board ?? "")}).`,
      patch: { stays: { [stay.id]: { ...cur, propertyId: stay.propertyId, roomId: r.roomId } } },
    });
  }

  // b) a comparable property
  const group = current?.comparableGroup;
  const candidates = [...new Set([...stay.optionPropertyIds, ...PROPERTIES.filter((p) => p.comparableGroup === group).map((p) => p.id)])].filter(
    (id) => id !== stay.propertyId,
  );
  for (const pid of candidates) {
    const best = await cheapestAvailable(providers, ctx, stay, pid, plan.travelers);
    const p = findProperty(pid)!;
    if (best) {
      alts.push({
        id: `property:${stay.id}:${pid}`,
        label: `${p.name} — ${best.name}`,
        explanation: `Comparable ${p.tier.toLowerCase()} stay in ${p.area}. Same dates; transfers are re-checked.`,
        patch: { stays: { [stay.id]: { ...cur, propertyId: pid, roomId: best.roomId } } },
      });
    }
  }

  // c) alternative dates for the whole trip (nearest earlier and later)
  if (stay.roomId && stay.propertyId) {
    const found: number[] = [];
    for (const shift of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7]) {
      if (found.some((s) => Math.sign(s) === Math.sign(shift))) continue;
      const newStart = addDays(plan.startDate, shift);
      if (newStart <= todayIso(ctx.now)) continue;
      const rs = await providers.stays.searchStay(
        { componentId: stay.id, propertyId: stay.propertyId, checkIn: addDays(stay.checkIn, shift), checkOut: addDays(stay.checkOut, shift), rooms: stay.rooms, guests: plan.travelers },
        ctx,
      );
      if (rs.find((r) => r.roomId === stay.roomId)?.available) found.push(shift);
      if (found.length === 2) break;
    }
    for (const shift of found) {
      const newStart = addDays(plan.startDate, shift);
      alts.push({
        id: `dates:${shift}`,
        label: `Travel ${fmtRange(newStart, addDays(ev.itinerary.endDate, shift))}`,
        explanation: `Moves the whole trip ${Math.abs(shift)} day${Math.abs(shift) > 1 ? "s" : ""} ${shift > 0 ? "later" : "earlier"} so you keep ${wanted?.name ?? "your room"}. Same order and length; every component is re-checked.`,
        patch: { startDate: newStart },
      });
    }
  }

  // d) re-allocate nights with the neighbouring stay
  if (wanted && wanted.soldOutNights.length && wanted.soldOutNights.length < stay.nights) {
    const stays = ev.itinerary.components.filter((c): c is ResolvedStay => c.kind === "stay" && c.included);
    const sold = new Set(wanted.soldOutNights);
    let lead = 0;
    while (lead < stay.nights && sold.has(addDays(stay.checkIn, lead))) lead++;
    let trail = 0;
    while (trail < stay.nights && sold.has(addDays(stay.checkOut, -(trail + 1)))) trail++;
    const prev = stays.find((s) => s.checkOut === stay.checkIn);
    const next = stays.find((s) => s.checkIn === stay.checkOut);
    if (lead > 0 && lead === wanted.soldOutNights.length && prev?.propertyId && prev.roomId) {
      const rs = await providers.stays.searchStay(
        { componentId: prev.id, propertyId: prev.propertyId, checkIn: prev.checkIn, checkOut: addDays(prev.checkOut, lead), rooms: prev.rooms, guests: plan.travelers },
        ctx,
      );
      if (rs.find((r) => r.roomId === prev.roomId)?.available) {
        const pp = plan.stays[prev.id] ?? {};
        alts.push({
          id: `realloc:${prev.id}:${stay.id}`,
          label: `${prev.nights + lead} nights in ${prev.title}, ${stay.nights - lead} in ${stay.title}`,
          explanation: `Keeps your room at ${current?.name} and the total trip length. You stay ${lead} night${lead > 1 ? "s" : ""} longer at ${findProperty(prev.propertyId)?.name}; the flight and transfers between them move ${lead} day${lead > 1 ? "s" : ""} later.`,
          patch: {
            stays: {
              [prev.id]: { ...pp, nightsDelta: (pp.nightsDelta ?? 0) + lead },
              [stay.id]: { ...cur, nightsDelta: (cur.nightsDelta ?? 0) - lead },
            },
          },
        });
      }
    } else if (trail > 0 && trail === wanted.soldOutNights.length && next?.propertyId && next.roomId) {
      const rs = await providers.stays.searchStay(
        { componentId: next.id, propertyId: next.propertyId, checkIn: addDays(next.checkIn, -trail), checkOut: next.checkOut, rooms: next.rooms, guests: plan.travelers },
        ctx,
      );
      if (rs.find((r) => r.roomId === next.roomId)?.available) {
        const np = plan.stays[next.id] ?? {};
        alts.push({
          id: `realloc:${stay.id}:${next.id}`,
          label: `${stay.nights - trail} nights in ${stay.title}, ${next.nights + trail} in ${next.title}`,
          explanation: `Keeps your room and the total trip length; you move on ${trail} day${trail > 1 ? "s" : ""} earlier.`,
          patch: {
            stays: {
              [stay.id]: { ...cur, nightsDelta: (cur.nightsDelta ?? 0) - trail },
              [next.id]: { ...np, nightsDelta: (np.nightsDelta ?? 0) + trail },
            },
          },
        });
      }
    }
  }
  void t;
  return alts;
}

function flightPatch(flightId: string, offer: Offer): PlanPatch {
  return { flights: Object.fromEntries(offer.segments!.map((s, i) => [`${flightId}:${i}`, s.flightNo])) };
}

async function attachAlternatives(t: TripTemplate, plan: TripPlan, ev: Evaluation, providers: ProviderRegistry, ctx: ProviderContext) {
  const baseline = priceItinerary(ev.itinerary, ev.search.results, { useReferencePrices: true });
  const byId = new Map(ev.itinerary.components.map((c) => [c.id, c]));

  for (const issue of ev.issues) {
    if (issue.severity !== "blocker") continue;
    let raw: Omit<Alternative, "priceDelta" | "newTotal">[] = [];
    const c = byId.get(issue.componentIds[0]);

    if ((issue.rule === "unavailable" || issue.rule === "needs-selection") && c?.kind === "stay") {
      if (issue.rule === "needs-selection") {
        for (const pid of c.optionPropertyIds) {
          const best = await cheapestAvailable(providers, ctx, c, pid, plan.travelers);
          const p = findProperty(pid)!;
          if (best) {
            raw.push({
              id: `select:${c.id}:${pid}`,
              label: `${p.name} — ${best.name}`,
              explanation: `${p.tier} · ${p.area}. ${p.description}`,
              patch: { stays: { [c.id]: { ...plan.stays[c.id], propertyId: pid, roomId: best.roomId } } },
            });
          }
        }
      } else {
        raw = await stayAlternatives(t, plan, ev, c, providers, ctx);
      }
    } else if (issue.rule === "unavailable" && c?.kind === "flight") {
      for (const o of ev.search.flightOffers.get(c.id) ?? []) {
        raw.push({ id: `flight:${c.id}:${o.id}`, label: o.productName, explanation: "Different flights on the same day.", patch: flightPatch(c.id, o) });
      }
    } else if (issue.rule === "open-segment") {
      const open = ev.itinerary.openSegments.find((o) => o.choiceId === issue.componentIds[0]);
      for (const o of open?.options ?? []) {
        raw.push({ id: `choice:${open!.choiceId}:${o.id}`, label: o.title, explanation: o.description, patch: { choices: { [open!.choiceId]: o.id } } });
      }
    } else if (issue.rule === "transfer-feasibility" && c?.kind === "transfer") {
      const tr = c as ResolvedTransfer;
      const flightId = tr.after ?? tr.before!;
      const current = ev.search.results.get(flightId)?.offer;
      const product = findTransfer(tr.productId)!;
      for (const o of ev.search.flightOffers.get(flightId) ?? []) {
        if (o.id === current?.id) continue;
        const timing = transferTiming(tr, o);
        if ("error" in timing) continue;
        const startLocal = `${timing.date}T${timing.time}`;
        const endMin = Number(timing.time.slice(0, 2)) * 60 + Number(timing.time.slice(3)) + product.durationMin;
        const endLocal = `${timing.date}T${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
        if (endMin >= 24 * 60 || windowProblem(tr, { ...o, startLocal, endLocal })) continue;
        const seg = o.segments![0];
        const last = o.segments!.at(-1)!;
        raw.push({
          id: `flight:${flightId}:${o.id}`,
          label: `Take ${o.productName} instead`,
          explanation: `Departs ${localTime(seg.depLocal)}, lands ${localTime(last.arrLocal)} — in time for the ${product.mode.toLowerCase()} transfer (${product.window ? `runs until ${product.window.end}` : "no time limit"}).`,
          patch: flightPatch(flightId, o),
        });
      }
    }

    if (!raw.length) continue;
    const priced: Alternative[] = [];
    for (const alt of raw) {
      const patched = applyPatch(plan, alt.patch);
      const child = await evaluate(t, patched, providers, ctx);
      // Only offer alternatives that actually fix this problem.
      const stillBroken = child.issues.some((i) => i.id === issue.id && i.severity === "blocker");
      if (stillBroken) continue;
      const childPrice = priceItinerary(child.itinerary, child.search.results, { useReferencePrices: true });
      priced.push({ ...alt, newTotal: childPrice.total, priceDelta: childPrice.total - baseline.total });
    }
    issue.alternatives = issue.rule === "open-segment" ? priced : priced.sort((a, b) => (a.priceDelta ?? 0) - (b.priceDelta ?? 0));
  }
}

export { applyPatch };
export type { ComponentResult };
