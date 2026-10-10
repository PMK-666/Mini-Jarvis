/**
 * In-memory persistence for the prototype (quotes, bookings, idempotency keys).
 * Survives hot reloads via globalThis, but not server restarts and not multiple instances.
 * Production: PostgreSQL tables `quotes`, `bookings`, `reservations`, `idempotency_keys`
 * (see db/schema.sql).
 */
import type { Booking, Quote } from "./domain/types";

interface Store {
  quotes: Map<string, Quote>;
  bookings: Map<string, Booking>;
  idempotency: Map<string, string>; // key → bookingId
}

const g = globalThis as unknown as { __itineraStore?: Store };

export function getStore(): Store {
  if (!g.__itineraStore) {
    g.__itineraStore = { quotes: new Map(), bookings: new Map(), idempotency: new Map() };
  }
  return g.__itineraStore;
}

export function createStore(): Store {
  return { quotes: new Map(), bookings: new Map(), idempotency: new Map() };
}

export type { Store };
