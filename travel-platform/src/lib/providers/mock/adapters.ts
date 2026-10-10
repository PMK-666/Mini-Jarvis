/**
 * Mock supplier adapters. They implement the same interfaces a live integration would,
 * against the simulated inventory. Nothing here contacts a real supplier.
 */
import { addDays, daysBetween, utcToLocal, zonedToUtc } from "../../domain/dates";
import { place } from "../../domain/places";
import type { Cancellation, NOK, Offer, Price } from "../../domain/types";
import {
  ACTIVITIES,
  FLIGHTS,
  PROPERTIES,
  TRANSFERS,
  type ScheduledFlight,
} from "./inventory";
import { bookingOutcome, flightOverride, revalidationIncrease, roomSoldOut } from "./scenarios";
import {
  FLIGHT_SALES_WINDOW_DAYS,
  STAY_SALES_WINDOW_DAYS,
  hash,
  jitter,
  latency,
  roundNok,
  seasonFactor,
  sleep,
} from "./util";
import {
  SupplierError,
  type ActivityProvider,
  type BookRequest,
  type FlightProvider,
  type ProviderContext,
  type RoomAvailability,
  type StayProvider,
  type TransferProvider,
} from "../types";

const MOCK_CAPS = { search: true, revalidate: true, book: true, cancel: true, hold: false };

function daysAhead(ctx: ProviderContext, date: string): number {
  return daysBetween(new Date(ctx.now).toISOString().slice(0, 10), date);
}

function mkPrice(base: number, taxRate: number, source: Price["source"], basis: string): Price {
  const b = roundNok(base);
  const t = roundNok(base * taxRate);
  return { base: b, taxesAndFees: t, total: b + t, currency: "NOK", source, basis };
}

function cancellationFor(days: number | undefined, label: string): Cancellation {
  if (days === undefined) return { refundable: false, summary: `${label}: non-refundable.` };
  return {
    refundable: true,
    freeUntilDaysBefore: days,
    summary: `${label}: free cancellation until ${days} day${days === 1 ? "" : "s"} before; after that non-refundable.`,
  };
}

/** Shared booking behaviour for all mock suppliers. */
function mockBookingOps(prefix: string) {
  const confirmed = new Map<string, string>(); // idempotencyKey → supplierRef
  return {
    async revalidate(offer: Offer, ctx: ProviderContext) {
      await latency(ctx.simulateLatency, `rv:${offer.id}`, 150, 450);
      const pax = Number(offer.meta?.passengers ?? 1);
      const inc = revalidationIncrease(ctx.scenario, offer) * pax;
      if (!inc) return { available: true, price: offer.price };
      const base = offer.price.base + inc;
      const taxRate = offer.price.base ? offer.price.taxesAndFees / offer.price.base : 0;
      return { available: true, price: mkPrice(base, taxRate, offer.price.source, offer.price.basis) };
    },
    async book(offer: Offer, req: BookRequest, ctx: ProviderContext) {
      await latency(ctx.simulateLatency, `bk:${req.idempotencyKey}:${req.attempt}`, 500, 1300);
      const existing = confirmed.get(req.idempotencyKey);
      if (existing) return { supplierRef: existing }; // idempotent replay
      const outcome = bookingOutcome(ctx.scenario, offer, req.attempt);
      if (outcome === "transient") {
        if (ctx.simulateLatency) await sleep(600);
        throw new SupplierError("Supplier did not respond in time (timeout).", true, "TIMEOUT");
      }
      if (outcome === "fatal") {
        throw new SupplierError(
          `${offer.productName} declined the reservation: no longer able to accommodate these dates.`,
          false,
          "DECLINED",
        );
      }
      const ref = `${prefix}-${(hash(req.idempotencyKey) % 900_000 + 100_000).toString(36).toUpperCase()}`;
      confirmed.set(req.idempotencyKey, ref);
      return { supplierRef: ref };
    },
    async cancel(offer: Offer, _supplierRef: string, ctx: ProviderContext) {
      await latency(ctx.simulateLatency, `cx:${offer.id}`, 300, 700);
      // Demo: bookings are cancelled immediately after creation, so the free-cancellation
      // window always applies. A live adapter returns the supplier's actual refund.
      return { refund: offer.cancellation.refundable ? offer.price.total : 0 };
    },
  };
}

/* ------------------------------------------------------------------ flights */

function scheduleFor(f: ScheduledFlight, ctx: ProviderContext) {
  return flightOverride(ctx.scenario, f.flightNo) ?? { dep: f.dep, arr: f.arr, arrDayOffset: f.arrDayOffset };
}

export function createMockFlightProvider(): FlightProvider {
  return {
    info: { id: "mock-flights", name: "Simulated flight supplier", mode: "mock", capabilities: MOCK_CAPS },
    ...mockBookingOps("FLT"),
    async searchFlights(req, ctx) {
      await latency(ctx.simulateLatency, `fs:${req.componentId}:${req.slices.map((s) => s.date).join()}`, 900, 1900);
      const perSlice = req.slices.map((slice) =>
        FLIGHTS.filter((f) => f.from === slice.from && f.to === slice.to).map((f) => {
          const s = scheduleFor(f, ctx);
          const depUtc = zonedToUtc(slice.date, s.dep, place(f.from).tz);
          const arrUtc = zonedToUtc(addDays(slice.date, s.arrDayOffset), s.arr, place(f.to).tz);
          return {
            f,
            seg: {
              flightNo: f.flightNo,
              carrier: f.carrier,
              from: f.from,
              to: f.to,
              depLocal: utcToLocal(depUtc, place(f.from).tz),
              arrLocal: utcToLocal(arrUtc, place(f.to).tz),
              depUtc,
              arrUtc,
            },
            date: slice.date,
          };
        }),
      );
      // Cartesian product of slice options (small for our routes).
      let combos: (typeof perSlice)[number][] = [[]];
      for (const options of perSlice) {
        const next: (typeof perSlice)[number][] = [];
        for (const c of combos) for (const o of options) next.push([...c, o]);
        combos = next;
      }
      return combos
        .filter((c) => c.length === req.slices.length && c.length > 0)
        .map((c) => {
          const estimate = c.some((x) => daysAhead(ctx, x.date) > FLIGHT_SALES_WINDOW_DAYS);
          const base = c.reduce(
            (sum, x) => sum + x.f.fares[req.cabin] * seasonFactor(x.date) * jitter(`${x.f.flightNo}:${x.date}`),
            0,
          ) * req.passengers;
          const refundable = c.every((x) => x.f.refundable);
          const flightNos = c.map((x) => x.f.flightNo).join("+");
          const offer: Offer = {
            id: `off_f_${hash(`${req.componentId}:${flightNos}:${c[0].date}:${req.cabin}:${req.passengers}`).toString(36)}`,
            componentId: req.componentId,
            supplier: "Simulated flight supplier",
            productName: c.map((x) => `${x.f.carrier} ${x.f.flightNo}`).join(" · "),
            detail: `${req.cabin[0].toUpperCase()}${req.cabin.slice(1)} · ${req.passengers} traveller${req.passengers > 1 ? "s" : ""}`,
            price: mkPrice(base, 0.14, estimate ? "estimate" : "simulated", `${req.passengers} × ${c.length} flight${c.length > 1 ? "s" : ""}`),
            cancellation: refundable
              ? cancellationFor(7, "Fare")
              : { refundable: false, summary: "Fare: non-refundable; date change for a fee (illustrative)." },
            segments: c.map((x) => x.seg),
            startUtc: c[0].seg.depUtc,
            endUtc: c[c.length - 1].seg.arrUtc,
            meta: {
              passengers: req.passengers,
              cabin: req.cabin,
              assumedSchedule: c.some((x) => !!x.f.assumedSchedule),
              notOnSale: estimate,
            },
          };
          return offer;
        });
    },
  };
}

/* ------------------------------------------------------------------- stays */

export function createMockStayProvider(): StayProvider {
  return {
    info: { id: "mock-stays", name: "Simulated accommodation supplier", mode: "mock", capabilities: MOCK_CAPS },
    ...mockBookingOps("HTL"),
    async searchStay(req, ctx) {
      await latency(ctx.simulateLatency, `ss:${req.componentId}:${req.propertyId}:${req.checkIn}`, 600, 1500);
      const p = PROPERTIES.find((x) => x.id === req.propertyId);
      if (!p) return [];
      const nights = daysBetween(req.checkIn, req.checkOut);
      const estimate = daysAhead(ctx, req.checkIn) > STAY_SALES_WINDOW_DAYS;
      return p.rooms.map((r): RoomAvailability => {
        let base = 0;
        const soldOutNights: string[] = [];
        for (let i = 0; i < nights; i++) {
          const night = addDays(req.checkIn, i);
          base += r.rate * seasonFactor(night) * jitter(`${p.id}:${r.id}:${night}`);
          if (roomSoldOut(ctx.scenario, p.id, r.id, night)) soldOutNights.push(night);
        }
        const roomsNeeded = Math.ceil(req.guests / r.sleeps);
        base *= roomsNeeded;
        const overCapacity = roomsNeeded > r.inventory;
        const available = soldOutNights.length === 0 && !overCapacity && nights > 0;
        const reason = soldOutNights.length
          ? `Sold out on ${soldOutNights.length} of ${nights} nights`
          : overCapacity
            ? `Only ${r.inventory} ${r.name.toLowerCase()}${r.inventory > 1 ? "s" : ""} available; ${roomsNeeded} needed`
            : undefined;
        return {
          roomId: r.id,
          name: r.name,
          available,
          reason,
          soldOutNights,
          offer: {
            id: `off_s_${hash(`${req.componentId}:${p.id}:${r.id}:${req.checkIn}:${nights}:${roomsNeeded}`).toString(36)}`,
            componentId: req.componentId,
            supplier: "Simulated accommodation supplier",
            productName: p.name,
            detail: `${r.name} · ${r.board} · ${roomsNeeded} room${roomsNeeded > 1 ? "s" : ""}`,
            price: mkPrice(base, p.taxRate, estimate ? "estimate" : "simulated", `${nights} night${nights > 1 ? "s" : ""} × ${roomsNeeded} room${roomsNeeded > 1 ? "s" : ""}`),
            cancellation: cancellationFor(r.freeCancelDays, "Room"),
            meta: { propertyId: p.id, roomId: r.id, roomName: r.name, board: r.board, rooms: roomsNeeded, checkIn: req.checkIn, checkOut: req.checkOut, nights, checkInTime: p.checkIn, checkOutTime: p.checkOut, passengers: req.guests },
          },
        };
      });
    },
  };
}

/* --------------------------------------------------------------- transfers */

export function createMockTransferProvider(): TransferProvider {
  return {
    info: { id: "mock-transfers", name: "Simulated ground & boat transfers", mode: "mock", capabilities: MOCK_CAPS },
    ...mockBookingOps("TRF"),
    async quoteTransfer(req, ctx) {
      await latency(ctx.simulateLatency, `tq:${req.componentId}:${req.date}:${req.time}`, 350, 900);
      const t = TRANSFERS.find((x) => x.id === req.productId);
      if (!t) return { available: false, reason: "Unknown transfer product" };
      const startUtc = zonedToUtc(req.date, req.time, t.tz);
      const endUtc = startUtc + t.durationMin * 60_000;
      const vehicles = t.perPerson ? req.passengers : Math.ceil(req.passengers / t.maxPerVehicle);
      const base = t.pricePerVehicle * vehicles * jitter(`${t.id}:${req.date}`);
      const offer: Offer = {
        id: `off_t_${hash(`${req.componentId}:${t.id}:${req.date}:${req.time}:${req.passengers}`).toString(36)}`,
        componentId: req.componentId,
        supplier: t.supplier,
        productName: t.name,
        detail: `${t.mode} · ${t.durationMin} min${t.perPerson ? ` · ${req.passengers} ticket${req.passengers > 1 ? "s" : ""}` : vehicles > 1 ? ` · ${vehicles} vehicles` : ""}`,
        price: mkPrice(base, 0.08, daysAhead(ctx, req.date) > STAY_SALES_WINDOW_DAYS ? "estimate" : "simulated", t.perPerson ? `${req.passengers} × ticket` : `${vehicles} vehicle${vehicles > 1 ? "s" : ""}`),
        cancellation: cancellationFor(2, "Transfer"),
        startLocal: utcToLocal(startUtc, t.tz),
        endLocal: utcToLocal(endUtc, t.tz),
        startUtc,
        endUtc,
        meta: {
          productId: t.id,
          mode: t.mode,
          windowStart: t.window?.start ?? "",
          windowEnd: t.window?.end ?? "",
          passengers: req.passengers,
        },
      };
      return { available: true, offer };
    },
  };
}

/* -------------------------------------------------------------- activities */

export function createMockActivityProvider(): ActivityProvider {
  return {
    info: { id: "mock-activities", name: "Simulated experiences supplier", mode: "mock", capabilities: MOCK_CAPS },
    ...mockBookingOps("ACT"),
    async quoteActivity(req, ctx) {
      await latency(ctx.simulateLatency, `aq:${req.componentId}:${req.date}`, 300, 800);
      const a = ACTIVITIES.find((x) => x.id === req.productId);
      if (!a) return { available: false, reason: "Unknown activity" };
      const startUtc = zonedToUtc(req.date, a.start, a.tz);
      const endUtc = startUtc + a.durationMin * 60_000;
      const base: NOK = a.pricePerPerson * req.passengers * jitter(`${a.id}:${req.date}`);
      return {
        available: true,
        offer: {
          id: `off_a_${hash(`${req.componentId}:${a.id}:${req.date}:${req.passengers}`).toString(36)}`,
          componentId: req.componentId,
          supplier: a.supplier,
          productName: a.name,
          detail: `${a.durationMin >= 60 ? `${Math.round(a.durationMin / 60)} h` : `${a.durationMin} min`} · ${req.passengers} guest${req.passengers > 1 ? "s" : ""}`,
          price: mkPrice(base, 0.07, daysAhead(ctx, req.date) > STAY_SALES_WINDOW_DAYS ? "estimate" : "simulated", `${req.passengers} × guest`),
          cancellation: cancellationFor(a.freeCancelDays, "Activity"),
          startLocal: utcToLocal(startUtc, a.tz),
          endLocal: utcToLocal(endUtc, a.tz),
          startUtc,
          endUtc,
          meta: { productId: a.id, passengers: req.passengers },
        },
      };
    },
  };
}
