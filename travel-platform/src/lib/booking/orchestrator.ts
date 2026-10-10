/**
 * Booking Service — reservation orchestration.
 *
 * Suppliers confirm independently, so one trip = many reservations, each with its own state.
 *
 *   revalidating → payment_authorizing → booking_components → confirmed
 *                                     ↘ failed (payment declined; nothing booked)
 *                                                          ↘ action_required (some confirmed, some failed;
 *                                                             payment stays authorised, not captured)
 *                                                               → confirmed (replacement booked)
 *                                                               → cancelling → cancelled (refund / void)
 *
 * Guarantees:
 * - Same idempotency key → same booking (double-clicks and network retries are safe).
 * - Each supplier call carries its own idempotency key, so retries never double-book.
 * - Retryable supplier errors are retried with backoff; non-retryable ones stop immediately.
 * - Payment is captured only when every required reservation is confirmed.
 * - A trip is never shown as confirmed while any required reservation is not.
 */
import type {
  Booking,
  BookingEvent,
  NOK,
  Offer,
  Quote,
  Reservation,
  ResolvedStay,
  Traveler,
} from "../domain/types";
import { getTrip } from "../data/trips";
import { priceItinerary } from "../engine/pricing";
import { findProperty, PROPERTIES } from "../providers/mock/inventory";
import { SupplierError, type BookingOps, type ProviderContext, type ProviderRegistry } from "../providers/types";
import type { PaymentProvider } from "../payments";
import type { Store } from "../store";

export interface OrchestratorDeps {
  providers: ProviderRegistry;
  payments: PaymentProvider;
  store: Store;
  simulateLatency: boolean;
  now?: () => number;
  maxAttempts?: number;
  retryBaseMs?: number;
}

export interface StartInput {
  quoteId: string;
  travelers: Traveler[];
  contact: { email: string; phone: string };
  paymentToken: string;
  idempotencyKey: string;
  /** Total the customer accepted after a price change. */
  acceptedTotal?: NOK;
}

export type StartResult =
  | { kind: "booking"; booking: Booking; replay: boolean }
  | {
      kind: "price_changed";
      oldTotal: NOK;
      newTotal: NOK;
      changes: { componentId: string; title: string; oldTotal: NOK; newTotal: NOK }[];
    }
  | { kind: "error"; code: "quote_not_found" | "quote_expired" | "not_bookable" | "invalid" | "unavailable"; message: string };

const KIND_ORDER: Reservation["kind"][] = ["flight", "stay", "transfer", "activity"];

export function createOrchestrator(deps: OrchestratorDeps) {
  const now = deps.now ?? Date.now;
  const maxAttempts = deps.maxAttempts ?? 3;
  const retryBaseMs = deps.retryBaseMs ?? 500;
  const sleep = (ms: number) => (deps.simulateLatency && ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  const opsFor = (kind: Reservation["kind"]): BookingOps =>
    kind === "flight" ? deps.providers.flights : kind === "stay" ? deps.providers.stays : kind === "transfer" ? deps.providers.transfers : deps.providers.activities;

  const ctxFor = (b: Booking): ProviderContext => ({ scenario: b.scenario, now: now(), simulateLatency: deps.simulateLatency });

  const log = (b: Booking, message: string, level: BookingEvent["level"] = "info") => {
    b.events.push({ at: now(), message, level });
  };

  function validateInput(input: StartInput, quote: Quote): string | undefined {
    if (input.travelers.length !== quote.plan.travelers) return `Enter details for all ${quote.plan.travelers} travellers.`;
    for (const t of input.travelers) {
      if (!t.firstName.trim() || !t.lastName.trim()) return "Every traveller needs a first and last name as in their passport.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.dateOfBirth)) return "Every traveller needs a date of birth.";
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.contact.email)) return "Enter a valid email address.";
    if (input.contact.phone.replace(/\D/g, "").length < 6) return "Enter a phone number we can reach you on while travelling.";
    if (!input.paymentToken) return "Payment details are missing.";
    if (!input.idempotencyKey || input.idempotencyKey.length < 8) return "Missing idempotency key.";
    return undefined;
  }

  async function start(input: StartInput): Promise<StartResult> {
    const existingId = deps.store.idempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = deps.store.bookings.get(existingId);
      if (existing) return { kind: "booking", booking: existing, replay: true };
    }
    const quote = deps.store.quotes.get(input.quoteId);
    if (!quote) return { kind: "error", code: "quote_not_found", message: "This quote no longer exists. Check availability again." };
    if (quote.expiresAt < now()) return { kind: "error", code: "quote_expired", message: "Prices are held for 30 minutes. Check availability again for a fresh quote." };
    if (!quote.bookable) return { kind: "error", code: "not_bookable", message: "This itinerary still has unresolved issues." };
    const invalid = validateInput(input, quote);
    if (invalid) return { kind: "error", code: "invalid", message: invalid };

    // Price & availability revalidation immediately before payment.
    const ctx: ProviderContext = { scenario: quote.scenario, now: now(), simulateLatency: deps.simulateLatency };
    const included = quote.itinerary.components.filter((c) => c.included);
    const revalidated = await Promise.all(
      included.map(async (c) => {
        const r = quote.results.find((x) => x.componentId === c.id)!;
        const offer = r.offer!;
        const rv = await opsFor(c.kind).revalidate(offer, ctx);
        return { c, offer, rv };
      }),
    );
    const gone = revalidated.find((x) => !x.rv.available);
    if (gone) return { kind: "error", code: "unavailable", message: `${gone.c.title} is no longer available. Check availability again.` };

    const updatedResults = quote.results.map((r) => {
      const hit = revalidated.find((x) => x.c.id === r.componentId);
      return hit ? { ...r, offer: { ...hit.offer, price: hit.rv.price } } : r;
    });
    const newPricing = priceItinerary(quote.itinerary, updatedResults);
    const changes = revalidated
      .filter((x) => x.rv.price.total !== x.offer.price.total)
      .map((x) => ({ componentId: x.c.id, title: x.c.title, oldTotal: x.offer.price.total, newTotal: x.rv.price.total }));
    if (newPricing.total !== quote.pricing.total && input.acceptedTotal !== newPricing.total) {
      return { kind: "price_changed", oldTotal: quote.pricing.total, newTotal: newPricing.total, changes };
    }

    const id = `bk_${Math.random().toString(36).slice(2, 12)}`;
    const booking: Booking = {
      id,
      reference: `ITN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      quoteId: quote.id,
      slug: quote.slug,
      tripTitle: (() => {
        const t = getTrip(quote.slug);
        return t ? `${t.destination} · ${t.category}` : quote.slug;
      })(),
      startDate: quote.itinerary.startDate,
      endDate: quote.itinerary.endDate,
      scenario: quote.scenario,
      status: "payment_authorizing",
      travelers: input.travelers,
      contact: input.contact,
      reservations: included.map((c) => {
        const offer = updatedResults.find((r) => r.componentId === c.id)!.offer!;
        return {
          componentId: c.id,
          title: c.title,
          kind: c.kind,
          supplier: offer.supplier,
          offer,
          status: "pending",
          attempts: 0,
          idempotencyKey: `${id}:${c.id}`,
        };
      }),
      total: newPricing.total,
      payment: { provider: deps.payments.name, status: "none", amount: newPricing.total, refunded: 0 },
      events: [],
      createdAt: now(),
      demo: true,
    };
    log(booking, changes.length ? `Prices revalidated; you accepted the new total.` : "Prices and availability revalidated with every supplier.", "success");
    deps.store.bookings.set(id, booking);
    deps.store.idempotency.set(input.idempotencyKey, id);
    return { kind: "booking", booking, replay: false };
  }

  async function bookReservation(b: Booking, r: Reservation): Promise<void> {
    const ops = opsFor(r.kind);
    while (r.attempts < maxAttempts) {
      r.attempts++;
      r.status = r.attempts > 1 ? "retrying" : "requested";
      try {
        const { supplierRef } = await ops.book(
          r.offer,
          { travelers: b.travelers, contact: b.contact, idempotencyKey: r.idempotencyKey, attempt: r.attempts },
          ctxFor(b),
        );
        r.status = "confirmed";
        r.supplierRef = supplierRef;
        r.error = undefined;
        log(b, `${r.title}: confirmed by ${r.supplier} (${supplierRef}).`, "success");
        return;
      } catch (err) {
        const e = err instanceof SupplierError ? err : new SupplierError((err as Error).message, false, "UNKNOWN");
        r.error = e.message;
        if (e.retryable && r.attempts < maxAttempts) {
          log(b, `${r.title}: ${e.message} Retrying (attempt ${r.attempts + 1} of ${maxAttempts}).`, "warning");
          await sleep(retryBaseMs * 2 ** (r.attempts - 1));
          continue;
        }
        r.status = "failed";
        log(b, `${r.title}: ${e.message}`, "error");
        return;
      }
    }
  }

  async function finalize(b: Booking) {
    const failed = b.reservations.filter((r) => r.status === "failed");
    if (failed.length === 0 && b.reservations.every((r) => r.status === "confirmed")) {
      await deps.payments.capture(b.payment.intentId!, b.payment.amount);
      b.payment.status = "captured";
      b.status = "confirmed";
      log(b, `All ${b.reservations.length} reservations confirmed. Payment of NOK ${b.payment.amount.toLocaleString("en-US")} captured (simulated).`, "success");
    } else {
      b.status = "action_required";
      log(
        b,
        `${failed.length} reservation${failed.length > 1 ? "s" : ""} could not be confirmed. Your payment is authorised but not charged. Choose a replacement or cancel for a full release.`,
        "warning",
      );
    }
  }

  /** Runs after `start`; the API does not await this (Phase 3: a durable job queue). */
  async function process(bookingId: string, paymentToken: string): Promise<Booking> {
    const b = deps.store.bookings.get(bookingId);
    if (!b) throw new Error("Booking not found");
    if (b.status !== "payment_authorizing") return b;

    const auth = await deps.payments.authorize({ amount: b.total, token: paymentToken, idempotencyKey: `${b.id}:auth`, description: `Itinera ${b.reference}` });
    if (auth.status === "declined") {
      b.payment.status = "declined";
      b.payment.declineReason = auth.reason;
      b.status = "failed";
      log(b, `Payment declined: ${auth.reason} Nothing was booked.`, "error");
      return b;
    }
    b.payment.intentId = auth.intentId;
    b.payment.status = "authorized";
    log(b, `Payment of NOK ${b.total.toLocaleString("en-US")} authorised (not yet charged).`, "success");

    b.status = "booking_components";
    for (const kind of KIND_ORDER) {
      const group = b.reservations.filter((r) => r.kind === kind);
      await Promise.all(group.map((r) => bookReservation(b, r)));
    }
    await finalize(b);
    return b;
  }

  /** Replacement options for a failed accommodation reservation. */
  async function alternativesFor(bookingId: string, componentId: string): Promise<{ offer: Offer; delta: NOK; label: string }[]> {
    const b = deps.store.bookings.get(bookingId);
    const quote = b && deps.store.quotes.get(b.quoteId);
    const r = b?.reservations.find((x) => x.componentId === componentId);
    const comp = quote?.itinerary.components.find((c) => c.id === componentId);
    if (!b || !r || !comp || r.status !== "failed" || comp.kind !== "stay") return [];
    const stay = comp as ResolvedStay;
    const failedProperty = String(r.offer.meta?.propertyId ?? "");
    const group = findProperty(failedProperty)?.comparableGroup;
    const ids = [...new Set([...stay.optionPropertyIds, ...PROPERTIES.filter((p) => p.comparableGroup === group).map((p) => p.id)])].filter((id) => id !== failedProperty);
    const out: { offer: Offer; delta: NOK; label: string }[] = [];
    for (const pid of ids) {
      const rooms = await deps.providers.stays.searchStay(
        { componentId, propertyId: pid, checkIn: stay.checkIn, checkOut: stay.checkOut, rooms: stay.rooms, guests: b.travelers.length },
        ctxFor(b),
      );
      const best = rooms.filter((x) => x.available).sort((a, c) => a.offer.price.total - c.offer.price.total)[0];
      if (best) out.push({ offer: best.offer, delta: best.offer.price.total - r.offer.price.total, label: `${best.offer.productName} — ${best.name}` });
    }
    return out.sort((a, c) => a.delta - c.delta);
  }

  async function replaceReservation(bookingId: string, componentId: string, offerId: string): Promise<Booking> {
    const b = deps.store.bookings.get(bookingId);
    if (!b) throw new Error("Booking not found");
    if (b.status !== "action_required") throw new Error("Only bookings that need attention can be changed here.");
    const r = b.reservations.find((x) => x.componentId === componentId);
    if (!r || r.status !== "failed") throw new Error("That reservation doesn't need replacing.");
    const options = await alternativesFor(bookingId, componentId);
    const chosen = options.find((o) => o.offer.id === offerId);
    if (!chosen) throw new Error("That option is no longer available.");

    const oldTotal = r.offer.price.total;
    r.offer = chosen.offer;
    r.supplier = chosen.offer.supplier;
    r.attempts = 0;
    r.status = "pending";
    r.idempotencyKey = `${b.id}:${componentId}:${offerId}`;
    log(b, `You chose ${chosen.label} to replace the declined reservation.`, "info");
    b.status = "booking_components";
    await bookReservation(b, r);
    if ((r.status as Reservation["status"]) === "confirmed") {
      const delta = r.offer.price.total - oldTotal;
      const fee = Math.round(delta * 0.03);
      b.total += delta + fee;
      b.payment.amount = b.total;
      await deps.payments.updateAmount(b.payment.intentId!, b.total);
      log(b, `Authorised amount updated to NOK ${b.total.toLocaleString("en-US")} (${delta + fee >= 0 ? "+" : ""}${(delta + fee).toLocaleString("en-US")}).`, "info");
    }
    await finalize(b);
    return b;
  }

  async function cancel(bookingId: string): Promise<Booking> {
    const b = deps.store.bookings.get(bookingId);
    if (!b) throw new Error("Booking not found");
    if (b.status === "cancelled" || b.status === "cancelling") return b;
    if (!["confirmed", "action_required", "failed"].includes(b.status)) throw new Error("This booking is still being processed.");
    b.status = "cancelling";
    log(b, "Cancellation requested.", "info");
    let refundable = 0;
    for (const r of b.reservations.filter((x) => x.status === "confirmed")) {
      r.status = "cancelling";
      try {
        const { refund } = await opsFor(r.kind).cancel(r.offer, r.supplierRef!, ctxFor(b));
        r.status = "cancelled";
        r.refundAmount = refund;
        refundable += refund;
        log(b, `${r.title}: cancelled with ${r.supplier}. Refund NOK ${refund.toLocaleString("en-US")}.`, "success");
      } catch (err) {
        r.status = "confirmed";
        log(b, `${r.title}: cancellation failed (${(err as Error).message}). Our team will follow up.`, "error");
      }
    }
    for (const r of b.reservations.filter((x) => x.status === "pending" || x.status === "failed")) r.status = "cancelled";

    if (b.payment.status === "authorized") {
      await deps.payments.void(b.payment.intentId!);
      b.payment.status = "voided";
      log(b, "Payment authorisation released — you were not charged.", "success");
    } else if (b.payment.status === "captured") {
      // Service fee refunded in full in the prototype; commercial terms decide this later.
      const fee = b.total - b.reservations.reduce((s, r) => s + r.offer.price.total, 0);
      const amount = refundable + (refundable > 0 ? fee : 0);
      await deps.payments.refund(b.payment.intentId!, amount);
      b.payment.refunded = amount;
      b.payment.status = amount >= b.payment.amount ? "refunded" : "partially_refunded";
      log(b, `Refund of NOK ${amount.toLocaleString("en-US")} issued (simulated).`, "success");
    }
    b.status = b.reservations.some((r) => r.status === "confirmed") ? "action_required" : "cancelled";
    return b;
  }

  return { start, process, alternativesFor, replaceReservation, cancel };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
