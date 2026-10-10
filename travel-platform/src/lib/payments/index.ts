/**
 * Payments Service.
 *
 * The app never sees card numbers. The browser exchanges card details for a single-use
 * token with the payment provider (Stripe Payment Element / Adyen Drop-in in production);
 * only that token reaches our server. We authorise first and capture only when every
 * required supplier has confirmed — so a failed trip never leaves the customer charged.
 */
import type { NOK } from "../domain/types";

export type AuthorizeResult =
  | { status: "authorized"; intentId: string }
  | { status: "declined"; reason: string };

export interface PaymentProvider {
  name: string;
  mode: "simulated" | "test" | "live";
  authorize(req: { amount: NOK; token: string; idempotencyKey: string; description: string }): Promise<AuthorizeResult>;
  /** Adjust an authorisation (e.g. a replacement component costs more or less). */
  updateAmount(intentId: string, amount: NOK): Promise<void>;
  capture(intentId: string, amount: NOK): Promise<void>;
  void(intentId: string): Promise<void>;
  refund(intentId: string, amount: NOK): Promise<void>;
}

/** Tokens issued by the demo "hosted card field" in the browser. */
export const DEMO_TOKENS = {
  success: "tok_demo_visa",
  declined: "tok_demo_card_declined",
  insufficient: "tok_demo_insufficient_funds",
} as const;

export function createSimulatedPayments(): PaymentProvider {
  const intents = new Map<string, { amount: NOK; status: string }>();
  const byKey = new Map<string, AuthorizeResult>();
  return {
    name: "Simulated payments (no money moves)",
    mode: "simulated",
    async authorize({ amount, token, idempotencyKey }) {
      const prior = byKey.get(idempotencyKey);
      if (prior) return prior;
      let result: AuthorizeResult;
      if (token === DEMO_TOKENS.declined) result = { status: "declined", reason: "Your card was declined by the issuer." };
      else if (token === DEMO_TOKENS.insufficient) result = { status: "declined", reason: "Insufficient funds." };
      else if (!token.startsWith("tok_")) result = { status: "declined", reason: "Invalid payment token." };
      else {
        const intentId = `pi_demo_${Math.random().toString(36).slice(2, 12)}`;
        intents.set(intentId, { amount, status: "authorized" });
        result = { status: "authorized", intentId };
      }
      byKey.set(idempotencyKey, result);
      return result;
    },
    async updateAmount(intentId, amount) {
      const i = intents.get(intentId);
      if (i) i.amount = amount;
    },
    async capture(intentId) {
      const i = intents.get(intentId);
      if (i) i.status = "captured";
    },
    async void(intentId) {
      const i = intents.get(intentId);
      if (i) i.status = "voided";
    },
    async refund(intentId) {
      const i = intents.get(intentId);
      if (i) i.status = "refunded";
    },
  };
}

const g = globalThis as unknown as { __itineraPayments?: PaymentProvider };
export function getPayments(): PaymentProvider {
  if (!g.__itineraPayments) g.__itineraPayments = createSimulatedPayments();
  return g.__itineraPayments;
}
