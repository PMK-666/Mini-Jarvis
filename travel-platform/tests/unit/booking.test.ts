import { describe, expect, it } from "vitest";
import { createOrchestrator } from "@/lib/booking/orchestrator";
import type { ScenarioId, Traveler } from "@/lib/domain/types";
import { applyPatch } from "@/lib/engine";
import { createSimulatedPayments, DEMO_TOKENS } from "@/lib/payments";
import { createMockProviders } from "@/lib/providers/registry";
import { createStore } from "@/lib/store";
import { completePlan, NOW, run } from "./helpers";

const travelers: Traveler[] = [
  { firstName: "Ada", lastName: "Nordmann", dateOfBirth: "1990-01-01" },
  { firstName: "Kari", lastName: "Nordmann", dateOfBirth: "1991-02-02" },
];
const contact = { email: "a@example.com", phone: "+47 400 00 000" };

async function setup(scenario: ScenarioId) {
  const providers = createMockProviders();
  const store = createStore();
  const payments = createSimulatedPayments();
  let plan = completePlan();
  let quote = await run(plan, scenario, providers);
  // Resolve any blockers with the first alternative (needed for search-time scenarios).
  for (const i of quote.issues.filter((x) => x.severity === "blocker")) plan = applyPatch(plan, i.alternatives![0].patch);
  quote = await run(plan, scenario, providers);
  expect(quote.bookable).toBe(true);
  store.quotes.set(quote.id, quote);
  const orch = createOrchestrator({ providers, payments, store, simulateLatency: false, now: () => NOW + 1000 });
  return { orch, store, quote };
}

const input = (quoteId: string, key = "key-12345678", token: string = DEMO_TOKENS.success) => ({
  quoteId,
  travelers,
  contact,
  paymentToken: token,
  idempotencyKey: key,
});

describe("booking orchestration", () => {
  it("confirms every reservation, then captures payment", async () => {
    const { orch, quote } = await setup("all-available");
    const r = await orch.start(input(quote.id));
    expect(r.kind).toBe("booking");
    if (r.kind !== "booking") return;
    const b = await orch.process(r.booking.id, DEMO_TOKENS.success);
    expect(b.status).toBe("confirmed");
    expect(b.reservations.every((x) => x.status === "confirmed" && x.supplierRef)).toBe(true);
    expect(b.payment.status).toBe("captured");
    expect(b.total).toBe(quote.pricing.total);
  });

  it("is idempotent: the same key returns the same booking", async () => {
    const { orch, quote, store } = await setup("all-available");
    const a = await orch.start(input(quote.id));
    const b = await orch.start(input(quote.id));
    expect(a.kind === "booking" && b.kind === "booking" && a.booking.id === b.booking.id).toBe(true);
    expect(b.kind === "booking" && b.replay).toBe(true);
    expect(store.bookings.size).toBe(1);
  });

  it("books nothing when payment is declined", async () => {
    const { orch, quote } = await setup("all-available");
    const r = await orch.start(input(quote.id, "key-declined1", DEMO_TOKENS.declined));
    if (r.kind !== "booking") throw new Error("expected booking");
    const b = await orch.process(r.booking.id, DEMO_TOKENS.declined);
    expect(b.status).toBe("failed");
    expect(b.payment.status).toBe("declined");
    expect(b.reservations.every((x) => x.status === "pending" && x.attempts === 0)).toBe(true);
  });

  it("asks the customer to accept a changed price before payment", async () => {
    const { orch, quote } = await setup("price-change");
    const r = await orch.start(input(quote.id));
    expect(r.kind).toBe("price_changed");
    if (r.kind !== "price_changed") return;
    expect(r.newTotal).toBeGreaterThan(r.oldTotal);
    expect(r.changes.map((c) => c.componentId)).toContain("flight-osl-bkk");
    const accepted = await orch.start({ ...input(quote.id), acceptedTotal: r.newTotal });
    expect(accepted.kind).toBe("booking");
    if (accepted.kind === "booking") expect(accepted.booking.total).toBe(r.newTotal);
  });

  it("retries transient failures and never marks a partial trip as confirmed", async () => {
    const { orch, quote } = await setup("booking-partial-failure");
    const r = await orch.start(input(quote.id));
    if (r.kind !== "booking") throw new Error("expected booking");
    const b = await orch.process(r.booking.id, DEMO_TOKENS.success);
    const transfer = b.reservations.find((x) => x.componentId === "transfer-usu-houseboat")!;
    expect(transfer.status).toBe("confirmed");
    expect(transfer.attempts).toBe(2);
    const houseboat = b.reservations.find((x) => x.componentId === "stay-houseboat")!;
    expect(houseboat.status).toBe("failed");
    expect(houseboat.attempts).toBe(1); // non-retryable: not hammered
    expect(b.status).toBe("action_required");
    expect(b.payment.status).toBe("authorized"); // not captured
  });

  it("recovers a partial booking with a replacement", async () => {
    const { orch, quote } = await setup("booking-partial-failure");
    const r = await orch.start(input(quote.id));
    if (r.kind !== "booking") throw new Error("expected booking");
    await orch.process(r.booking.id, DEMO_TOKENS.success);
    const options = await orch.alternativesFor(r.booking.id, "stay-houseboat");
    expect(options.length).toBeGreaterThan(0);
    const b = await orch.replaceReservation(r.booking.id, "stay-houseboat", options[0].offer.id);
    expect(b.status).toBe("confirmed");
    expect(b.payment.status).toBe("captured");
    expect(b.payment.amount).toBe(b.total);
  });

  it("cancels a partial booking and releases the payment", async () => {
    const { orch, quote } = await setup("booking-partial-failure");
    const r = await orch.start(input(quote.id));
    if (r.kind !== "booking") throw new Error("expected booking");
    await orch.process(r.booking.id, DEMO_TOKENS.success);
    const b = await orch.cancel(r.booking.id);
    expect(b.status).toBe("cancelled");
    expect(b.payment.status).toBe("voided");
    expect(b.reservations.every((x) => x.status === "cancelled")).toBe(true);
  });

  it("rejects invalid traveller details and expired quotes", async () => {
    const { orch, quote, store } = await setup("all-available");
    const bad = await orch.start({ ...input(quote.id), travelers: [travelers[0]] });
    expect(bad).toMatchObject({ kind: "error", code: "invalid" });
    store.quotes.set(quote.id, { ...quote, expiresAt: NOW });
    const expired = await orch.start(input(quote.id, "key-other123"));
    expect(expired).toMatchObject({ kind: "error", code: "quote_expired" });
  });
});
