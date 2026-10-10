/**
 * Core domain model.
 *
 * A TripTemplate is the reusable, published itinerary ("what the creator did").
 * A TripPlan is one customer's customization of a template ("what I want").
 * A Quote is the engine's priced, validated answer for a plan at a point in time.
 * A Booking is the customer's purchase, tracked per supplier reservation.
 *
 * Templates never store absolute dates for components. They store day offsets
 * from the trip's departure day, so the same trip can be re-run for any date.
 */

export type NOK = number; // whole Norwegian kroner

export type ComponentKind = "flight" | "stay" | "transfer" | "activity" | "choice";

/**
 * Where a component's information comes from, relative to the creator's original trip.
 * - booked:     the creator actually booked this component.
 * - incomplete: the original itinerary is missing this detail. Shown as incomplete, never invented.
 * - assumed:    Itinera filled in a reasonable assumption so the trip can be searched (labelled in the UI).
 * - suggested:  optional extra suggested by Itinera, not part of the creator's trip.
 */
export type Provenance = "booked" | "incomplete" | "assumed" | "suggested";

export interface Place {
  code?: string; // IATA code for airports
  name: string;
  city: string;
  tz: string; // IANA time zone
  country: string; // ISO-3166 alpha-2
}

interface BaseComponent {
  id: string;
  kind: ComponentKind;
  title: string;
  /** Day offset from trip departure day (0 = departure day). */
  startDay: number;
  provenance: Provenance;
  /** Human note about what is known/unknown in the original. */
  note?: string;
  /** If false, the customer may leave it out. */
  required: boolean;
  /** Other components that must be resolved first (e.g. a transfer depends on the inbound flight). */
  dependsOn?: string[];
}

export interface FlightLegTemplate {
  from: string; // airport code
  to: string;
  /** Flight number if known in the original. Undefined = not recorded; the engine picks an equivalent and says so. */
  flightNo?: string;
  /** Day offset of this leg's departure relative to the component's startDay. */
  dayOffset: number;
  /** Preferred local departure window when flightNo is unknown. */
  preferredAfter?: string; // "HH:MM"
}

export type Cabin = "economy" | "premium" | "business";

export interface FlightComponent extends BaseComponent {
  kind: "flight";
  legs: FlightLegTemplate[];
  /** All legs on one ticket → protected connection, standard minimum connection time applies. */
  singleTicket: boolean;
}

export interface StayComponent extends BaseComponent {
  kind: "stay";
  nights: number;
  city: string;
  /** Undefined when the creator has not decided (provenance "incomplete"). */
  propertyId?: string;
  roomId?: string;
  /** Properties the customer can switch to when customizing. */
  optionPropertyIds: string[];
}

export interface TransferComponent extends BaseComponent {
  kind: "transfer";
  productId: string;
  /** Flight whose arrival this transfer meets. */
  after?: string;
  /** Flight this transfer must reach in time (start is computed backwards from departure). */
  before?: string;
  /** Fixed local time if not tied to a flight. */
  time?: string;
  /** For optional transfers (required: false): included unless the customer removes it. */
  includedByDefault?: boolean;
}

export interface ActivityComponent extends BaseComponent {
  kind: "activity";
  productId: string;
  includedByDefault: boolean;
}

export interface ChoiceOption {
  id: string;
  title: string;
  description: string;
  /** Components for this option; startDay offsets are relative to the choice's startDay. */
  components: TemplateComponent[];
  /** Customer arranges this part themselves. Nothing is booked; the engine warns about it. */
  selfArranged?: boolean;
}

/** An unfinished part of a trip offered as a set of explicit options. */
export interface ChoiceComponent extends BaseComponent {
  kind: "choice";
  nights: number;
  options: ChoiceOption[];
}

export type TemplateComponent =
  | FlightComponent
  | StayComponent
  | TransferComponent
  | ActivityComponent
  | ChoiceComponent;

export type CreatorStatus = "completed" | "planned";

export interface Creator {
  name: string;
  status: CreatorStatus;
  statusNote: string;
  bio: string;
}

export interface TripTemplate {
  id: string;
  slug: string;
  destination: string; // primary title
  category: string; // secondary title
  categories: string[]; // filterable, a trip can be in many
  tags: string[]; // e.g. "Island Hopping", "Luxury"
  travelStyle: "Luxury" | "Comfort" | "Budget" | "Mixed";
  summary: string;
  scene: SceneKind;
  photoUrl?: string;
  /** The creator's original departure date (ISO). Used as the default. */
  originalStartDate: string;
  originalEndDate: string;
  homeAirport: string;
  defaultTravelers: number;
  creator: Creator;
  /** Genuine verified reviews only. Empty until real travellers review the trip. */
  reviews: { rating: number; text: string; author: string; verified: true }[];
  highlights: string[];
  components: TemplateComponent[];
}

export type SceneKind = "islands" | "mountains" | "coast" | "city" | "snow" | "lagoon" | "temple" | "fjord";

/* ----------------------------------------------------------------------------
 * Customer plan (customization of a template)
 * --------------------------------------------------------------------------*/

export interface TripPlan {
  slug: string;
  startDate: string; // ISO date the customer departs
  travelers: number; // adults; rooms = ceil(travelers / 2)
  cabin: Cabin;
  stays: Record<string, { propertyId?: string; roomId?: string; nightsDelta?: number }>;
  /** Optional components (activities, optional transfers) switched on/off. */
  activities: Record<string, boolean>;
  choices: Record<string, string>; // choiceId → optionId
  /** Explicit flight choice per leg: key `${componentId}:${legIndex}` → flight number. */
  flights: Record<string, string>;
}

/* ----------------------------------------------------------------------------
 * Resolved itinerary (plan applied to template, absolute dates)
 * --------------------------------------------------------------------------*/

export interface ResolvedBase {
  id: string;
  kind: Exclude<ComponentKind, "choice">;
  title: string;
  provenance: Provenance;
  note?: string;
  required: boolean;
  included: boolean;
  dependsOn: string[];
  date: string; // ISO date of start
  /** Parent choice id/option, when this component came from an open-segment choice. */
  fromChoice?: { choiceId: string; optionId: string };
}

export interface ResolvedFlight extends ResolvedBase {
  kind: "flight";
  legs: (FlightLegTemplate & { date: string; chosenFlightNo?: string })[];
  singleTicket: boolean;
  cabin: Cabin;
}

export interface ResolvedStay extends ResolvedBase {
  kind: "stay";
  checkIn: string;
  checkOut: string;
  nights: number;
  city: string;
  propertyId?: string;
  roomId?: string;
  optionPropertyIds: string[];
  rooms: number;
}

export interface ResolvedTransfer extends ResolvedBase {
  kind: "transfer";
  productId: string;
  after?: string;
  before?: string;
  time?: string;
}

export interface ResolvedActivity extends ResolvedBase {
  kind: "activity";
  productId: string;
}

export type ResolvedComponent = ResolvedFlight | ResolvedStay | ResolvedTransfer | ResolvedActivity;

export interface OpenSegment {
  choiceId: string;
  title: string;
  date: string;
  nights: number;
  selectedOptionId?: string;
  options: { id: string; title: string; description: string; selfArranged?: boolean }[];
  provenance: Provenance;
  note?: string;
}

export interface ResolvedItinerary {
  slug: string;
  startDate: string;
  endDate: string;
  totalNights: number;
  travelers: number;
  components: ResolvedComponent[];
  openSegments: OpenSegment[];
}

/* ----------------------------------------------------------------------------
 * Offers, results, issues, quotes
 * --------------------------------------------------------------------------*/

/**
 * simulated: produced by a mock supplier in demo mode (illustrative, not bookable for real).
 * live:      returned by a real supplier API as a bookable quote.
 * estimate:  not a quote — e.g. schedules not yet on sale. Must be re-quoted before payment.
 */
export type PriceSource = "simulated" | "live" | "estimate";

export interface Price {
  base: NOK;
  taxesAndFees: NOK;
  total: NOK;
  currency: "NOK";
  source: PriceSource;
  basis: string; // e.g. "2 travellers × 1 way" or "6 nights × 1 room"
}

export interface Cancellation {
  refundable: boolean;
  /** Days before start when free cancellation ends (undefined = non-refundable). */
  freeUntilDaysBefore?: number;
  summary: string;
}

export interface FlightSegmentOffer {
  flightNo: string;
  carrier: string;
  from: string;
  to: string;
  depLocal: string; // "YYYY-MM-DDTHH:MM"
  arrLocal: string;
  depUtc: number;
  arrUtc: number;
}

export interface Offer {
  id: string;
  componentId: string;
  supplier: string;
  productName: string;
  detail: string;
  price: Price;
  cancellation: Cancellation;
  /** Present for flights. */
  segments?: FlightSegmentOffer[];
  /** Present for transfers/activities: local start/end. */
  startLocal?: string;
  endLocal?: string;
  startUtc?: number;
  endUtc?: number;
  meta?: Record<string, string | number | boolean>;
}

export type ResultStatus =
  | "available"
  | "unavailable"
  | "needs_selection"
  | "not_included"
  | "self_arranged"
  | "error";

export interface ComponentResult {
  componentId: string;
  status: ResultStatus;
  offer?: Offer;
  /** What the component would cost if available; used to show honest price differences. */
  referencePrice?: Price;
  message?: string;
  durationMs: number;
}

export type Severity = "blocker" | "warning" | "info";

export interface Alternative {
  id: string;
  label: string;
  explanation: string;
  /** Change to apply to the TripPlan. Selecting an alternative always re-runs the engine. */
  patch: PlanPatch;
  /** Difference in total trip price vs. the original choice, when computable. */
  priceDelta?: NOK;
  newTotal?: NOK;
}

export interface PlanPatch {
  startDate?: string;
  stays?: TripPlan["stays"];
  choices?: TripPlan["choices"];
  flights?: TripPlan["flights"];
  activities?: TripPlan["activities"];
}

export interface Issue {
  id: string;
  severity: Severity;
  rule: string;
  componentIds: string[];
  title: string;
  detail: string;
  alternatives?: Alternative[];
}

export interface PriceLine {
  componentId: string;
  label: string;
  category: "Flights" | "Accommodation" | "Transportation" | "Activities";
  price: Price;
}

export interface PriceSummary {
  lines: PriceLine[];
  byCategory: { category: PriceLine["category"]; base: NOK; taxesAndFees: NOK; total: NOK }[];
  subtotal: NOK;
  taxesAndFees: NOK;
  serviceFee: NOK;
  serviceFeeRate: number;
  total: NOK;
  perPerson: NOK;
  currency: "NOK";
  hasEstimates: boolean;
  /** Components that still have no price (unavailable / needs selection). */
  unpriced: string[];
}

export interface Quote {
  id: string;
  slug: string;
  plan: TripPlan;
  scenario: ScenarioId;
  itinerary: ResolvedItinerary;
  results: ComponentResult[];
  issues: Issue[];
  pricing: PriceSummary;
  bookable: boolean;
  createdAt: number;
  expiresAt: number;
  elapsedMs: number;
}

export type ScenarioId =
  | "all-available"
  | "cauayan-room-unavailable"
  | "late-flight-transfer"
  | "booking-partial-failure"
  | "price-change";

/* ----------------------------------------------------------------------------
 * Bookings
 * --------------------------------------------------------------------------*/

export type BookingStatus =
  | "revalidating"
  | "payment_authorizing"
  | "booking_components"
  | "confirmed"
  | "action_required"
  | "cancelling"
  | "cancelled"
  | "failed";

export type ReservationStatus =
  | "pending"
  | "requested"
  | "retrying"
  | "confirmed"
  | "failed"
  | "cancelling"
  | "cancelled";

export interface Reservation {
  componentId: string;
  title: string;
  kind: ResolvedComponent["kind"];
  supplier: string;
  offer: Offer;
  status: ReservationStatus;
  attempts: number;
  supplierRef?: string;
  idempotencyKey: string;
  error?: string;
  refundAmount?: NOK;
}

export interface Traveler {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface BookingEvent {
  at: number;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

export interface Booking {
  id: string;
  reference: string;
  quoteId: string;
  slug: string;
  tripTitle: string;
  startDate: string;
  endDate: string;
  scenario: ScenarioId;
  status: BookingStatus;
  travelers: Traveler[];
  contact: { email: string; phone: string };
  reservations: Reservation[];
  total: NOK;
  payment: {
    provider: string;
    intentId?: string;
    status: "none" | "authorized" | "captured" | "voided" | "declined" | "refunded" | "partially_refunded";
    amount: NOK;
    refunded: NOK;
    declineReason?: string;
  };
  events: BookingEvent[];
  createdAt: number;
  demo: true;
}
