/**
 * Pricing & Availability, step 2: search live (here: simulated) inventory for every component.
 *
 * Independent searches run concurrently. Components with dependencies (a transfer that must
 * meet a flight) start as soon as what they depend on has resolved.
 */
import { localDate, localTime, utcToLocal } from "../domain/dates";
import { isDomestic } from "../domain/places";
import type {
  ComponentResult,
  Offer,
  ResolvedComponent,
  ResolvedFlight,
  ResolvedItinerary,
  ResolvedStay,
  ResolvedTransfer,
} from "../domain/types";
import { findTransfer } from "../providers/mock/inventory";
import type { ProviderContext, ProviderRegistry, RoomAvailability } from "../providers/types";

export interface SearchOutput {
  results: Map<string, ComponentResult>;
  flightOffers: Map<string, Offer[]>;
  stayRooms: Map<string, RoomAvailability[]>;
  /** How each flight offer was chosen. */
  flightSelection: Map<string, "original" | "customer" | "engine">;
}

export type SearchEvent =
  | { type: "searching"; id: string }
  | { type: "result"; result: ComponentResult };

/** Minimum time at the airport before a flight, used to time transfers backwards. */
export function airportLeadMinutes(flight: Offer): number {
  const first = flight.segments![0];
  return isDomestic(first.from, first.to) ? 60 : 150;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Pick the best flight offer for a resolved flight component. */
export function chooseFlightOffer(
  flight: ResolvedFlight,
  offers: Offer[],
): { offer?: Offer; how: "original" | "customer" | "engine"; missing?: string[] } {
  const pinned = flight.legs.map((l) => l.chosenFlightNo);
  const anyPinned = pinned.some(Boolean);
  const how: "original" | "customer" | "engine" = flight.legs.every((l, i) => l.flightNo && l.flightNo === pinned[i])
    ? "original"
    : flight.legs.some((l, i) => pinned[i] && pinned[i] !== l.flightNo)
      ? "customer"
      : "engine";

  const matching = offers.filter((o) => o.segments!.every((s, i) => !pinned[i] || s.flightNo === pinned[i]));
  if (anyPinned && matching.length === 0) {
    return { how, missing: pinned.filter(Boolean) as string[] };
  }
  const score = (o: Offer) => {
    let s = 0;
    const segs = o.segments!;
    segs.forEach((seg, i) => {
      const leg = flight.legs[i];
      if (localDate(seg.depLocal) !== leg.date) s += 1e6;
      if (!pinned[i] && leg.preferredAfter) {
        const diff = toMin(localTime(seg.depLocal)) - toMin(leg.preferredAfter);
        s += diff >= 0 ? diff : 5000 - diff;
      }
      if (i > 0) {
        const gap = (seg.depUtc - segs[i - 1].arrUtc) / 60_000;
        if (gap < minConnectionMinutes(segs[i - 1].from, segs[i - 1].to, seg.to)) s += 1e7;
      }
    });
    return s;
  };
  const best = [...matching].sort((a, b) => score(a) - score(b))[0];
  return { offer: best, how };
}

/** Minimum connection time on one ticket. */
export function minConnectionMinutes(prevFrom: string, hub: string, nextTo: string): number {
  return isDomestic(prevFrom, hub) && isDomestic(hub, nextTo) ? 45 : 90;
}

/** Work out when a transfer runs from the flight it meets or must reach. */
export function transferTiming(
  t: ResolvedTransfer,
  flightOffer: Offer | undefined,
): { date: string; time: string } | { error: string } {
  const product = findTransfer(t.productId);
  if (!product) return { error: "Unknown transfer product." };
  if (t.after) {
    if (!flightOffer) return { error: "Waiting for the inbound flight to be confirmed before timing this transfer." };
    const last = flightOffer.segments![flightOffer.segments!.length - 1];
    const local = utcToLocal(last.arrUtc + product.arrivalBufferMin * 60_000, product.tz);
    return { date: localDate(local), time: localTime(local) };
  }
  if (t.before) {
    if (!flightOffer) return { error: "Waiting for the outbound flight to be confirmed before timing this transfer." };
    const first = flightOffer.segments![0];
    const startUtc = first.depUtc - (airportLeadMinutes(flightOffer) + product.durationMin) * 60_000;
    const local = utcToLocal(startUtc, product.tz);
    return { date: localDate(local), time: localTime(local) };
  }
  return { date: t.date, time: t.time ?? "10:00" };
}

export async function searchItinerary(
  it: ResolvedItinerary,
  providers: ProviderRegistry,
  ctx: ProviderContext,
  onEvent?: (e: SearchEvent) => void,
): Promise<SearchOutput> {
  const out: SearchOutput = {
    results: new Map(),
    flightOffers: new Map(),
    stayRooms: new Map(),
    flightSelection: new Map(),
  };
  const byId = new Map(it.components.map((c) => [c.id, c]));
  const running = new Map<string, Promise<ComponentResult>>();

  const run = (c: ResolvedComponent): Promise<ComponentResult> => {
    const existing = running.get(c.id);
    if (existing) return existing;
    const p = (async () => {
      // Wait for dependencies that are part of this itinerary.
      const deps = [c.kind === "transfer" ? (c.after ?? c.before) : undefined, ...c.dependsOn].filter(
        (d): d is string => !!d && byId.has(d),
      );
      await Promise.all([...new Set(deps)].map((d) => run(byId.get(d)!)));
      const t0 = Date.now();
      onEvent?.({ type: "searching", id: c.id });
      let result: ComponentResult;
      try {
        result = await searchOne(c);
      } catch (err) {
        result = { componentId: c.id, status: "error", message: (err as Error).message, durationMs: 0 };
      }
      result.durationMs = Date.now() - t0;
      out.results.set(c.id, result);
      onEvent?.({ type: "result", result });
      return result;
    })();
    running.set(c.id, p);
    return p;
  };

  async function searchOne(c: ResolvedComponent): Promise<ComponentResult> {
    if (!c.included) return { componentId: c.id, status: "not_included", durationMs: 0 };
    switch (c.kind) {
      case "flight": {
        const offers = await providers.flights.searchFlights(
          { componentId: c.id, slices: c.legs.map((l) => ({ from: l.from, to: l.to, date: l.date })), cabin: c.cabin, passengers: it.travelers },
          ctx,
        );
        out.flightOffers.set(c.id, offers);
        const { offer, how, missing } = chooseFlightOffer(c, offers);
        out.flightSelection.set(c.id, how);
        if (!offer) {
          return {
            componentId: c.id,
            status: "unavailable",
            message: missing?.length
              ? `${missing.join(" + ")} is not operating on these dates.`
              : "No flights found on this route and date.",
            durationMs: 0,
          };
        }
        return {
          componentId: c.id,
          status: "available",
          offer,
          message:
            how === "engine"
              ? "Original flight numbers weren't recorded — Itinera selected this connection."
              : how === "customer"
                ? "Your chosen flights."
                : "Same flights as the original trip.",
          durationMs: 0,
        };
      }
      case "stay":
        return searchStay(c);
      case "transfer": {
        const flightId = c.after ?? c.before;
        const flightRes = flightId ? out.results.get(flightId) : undefined;
        const timing = transferTiming(c, flightRes?.offer);
        if ("error" in timing) return { componentId: c.id, status: "error", message: timing.error, durationMs: 0 };
        const q = await providers.transfers.quoteTransfer(
          { componentId: c.id, productId: c.productId, date: timing.date, time: timing.time, passengers: it.travelers },
          ctx,
        );
        if (!q.available || !q.offer) return { componentId: c.id, status: "unavailable", message: q.reason, durationMs: 0 };
        return { componentId: c.id, status: "available", offer: q.offer, durationMs: 0 };
      }
      case "activity": {
        const q = await providers.activities.quoteActivity(
          { componentId: c.id, productId: c.productId, date: c.date, passengers: it.travelers },
          ctx,
        );
        if (!q.available || !q.offer) return { componentId: c.id, status: "unavailable", message: q.reason, durationMs: 0 };
        return { componentId: c.id, status: "available", offer: q.offer, durationMs: 0 };
      }
    }
  }

  async function searchStay(c: ResolvedStay): Promise<ComponentResult> {
    if (!c.propertyId) {
      return {
        componentId: c.id,
        status: "needs_selection",
        message: "The original itinerary doesn't include a hotel here yet. Choose one to continue.",
        durationMs: 0,
      };
    }
    const rooms = await providers.stays.searchStay(
      { componentId: c.id, propertyId: c.propertyId, checkIn: c.checkIn, checkOut: c.checkOut, rooms: c.rooms, guests: it.travelers },
      ctx,
    );
    out.stayRooms.set(c.id, rooms);
    if (!rooms.length) return { componentId: c.id, status: "error", message: "Property not found at supplier.", durationMs: 0 };
    const wanted = c.roomId
      ? rooms.find((r) => r.roomId === c.roomId)
      : [...rooms].filter((r) => r.available).sort((a, b) => a.offer.price.total - b.offer.price.total)[0];
    if (!wanted) {
      return { componentId: c.id, status: "unavailable", message: "No rooms available for these dates.", durationMs: 0 };
    }
    if (!wanted.available) {
      return {
        componentId: c.id,
        status: "unavailable",
        referencePrice: wanted.offer.price,
        message: `Your selected room at ${wanted.offer.productName} is unavailable for these dates. ${wanted.reason ?? ""}`.trim(),
        durationMs: 0,
      };
    }
    return { componentId: c.id, status: "available", offer: wanted.offer, durationMs: 0 };
  }

  await Promise.all(it.components.map((c) => run(c)));
  return out;
}
