/**
 * Supplier adapter contracts.
 *
 * The engine and booking orchestrator only talk to these interfaces. A real supplier
 * (Duffel, Amadeus, Booking.com Demand API, Expedia Rapid, Viator, GetYourGuide, a local
 * transfer partner…) is added by implementing the interface for its kind and registering it
 * in `registry.ts`. Nothing else in the app needs to change.
 *
 * Not every supplier supports every operation. Capabilities are declared so the orchestrator
 * can refuse to sell a component it cannot actually book or cancel.
 */
import type { Cabin, NOK, Offer, Price, ScenarioId, Traveler } from "../domain/types";

export interface ProviderContext {
  scenario: ScenarioId;
  now: number;
  simulateLatency: boolean;
}

export interface ProviderCapabilities {
  search: boolean;
  /** Can re-price an offer right before payment. */
  revalidate: boolean;
  /** Can create a reservation via API (vs. manual/email confirmation). */
  book: boolean;
  cancel: boolean;
  /** Can hold inventory without payment for a short time. */
  hold: boolean;
}

export class SupplierError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SupplierError";
  }
}

export interface BookRequest {
  travelers: Traveler[];
  contact: { email: string; phone: string };
  /** Same key → same reservation. Suppliers must never double-book on retry. */
  idempotencyKey: string;
  attempt: number;
}

export interface BookingOps {
  revalidate(offer: Offer, ctx: ProviderContext): Promise<{ available: boolean; price: Price; reason?: string }>;
  book(offer: Offer, req: BookRequest, ctx: ProviderContext): Promise<{ supplierRef: string }>;
  cancel(offer: Offer, supplierRef: string, ctx: ProviderContext): Promise<{ refund: NOK }>;
}

export interface ProviderInfo {
  id: string;
  name: string;
  mode: "mock" | "live";
  capabilities: ProviderCapabilities;
}

export interface FlightSearchRequest {
  componentId: string;
  slices: { from: string; to: string; date: string }[];
  cabin: Cabin;
  passengers: number;
}

export interface FlightProvider extends BookingOps {
  info: ProviderInfo;
  /** Returns complete priced itineraries (one offer = all slices). */
  searchFlights(req: FlightSearchRequest, ctx: ProviderContext): Promise<Offer[]>;
}

export interface StaySearchRequest {
  componentId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
}

export interface RoomAvailability {
  roomId: string;
  name: string;
  available: boolean;
  reason?: string;
  /** Present even when unavailable, as the reference price for comparisons. */
  offer: Offer;
  /** Nights (ISO dates) that are sold out. */
  soldOutNights: string[];
}

export interface StayProvider extends BookingOps {
  info: ProviderInfo;
  searchStay(req: StaySearchRequest, ctx: ProviderContext): Promise<RoomAvailability[]>;
}

export interface ServiceQuoteRequest {
  componentId: string;
  productId: string;
  date: string;
  time: string; // local HH:MM
  passengers: number;
}

export interface ServiceQuote {
  available: boolean;
  reason?: string;
  offer?: Offer;
}

export interface TransferProvider extends BookingOps {
  info: ProviderInfo;
  quoteTransfer(req: ServiceQuoteRequest, ctx: ProviderContext): Promise<ServiceQuote>;
}

export interface ActivityProvider extends BookingOps {
  info: ProviderInfo;
  quoteActivity(req: Omit<ServiceQuoteRequest, "time">, ctx: ProviderContext): Promise<ServiceQuote>;
}

export interface ProviderRegistry {
  flights: FlightProvider;
  stays: StayProvider;
  transfers: TransferProvider;
  activities: ActivityProvider;
}
