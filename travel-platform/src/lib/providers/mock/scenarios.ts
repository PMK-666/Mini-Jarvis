/**
 * Demo scenarios. They change how the mock suppliers behave so every customer-facing
 * success and failure path can be exercised on purpose. Scenarios exist only in demo mode.
 */
import type { NOK, Offer, ScenarioId } from "../../domain/types";

export interface ScenarioInfo {
  id: ScenarioId;
  title: string;
  description: string;
}

export const SCENARIOS: ScenarioInfo[] = [
  {
    id: "all-available",
    title: "Everything available",
    description: "Every supplier confirms at the expected price.",
  },
  {
    id: "cauayan-room-unavailable",
    title: "Resort room sold out",
    description:
      "Philippines: the Beach Villa at Cauayan Island Resort is sold out on 23–24 December. You'll get alternatives to choose from.",
  },
  {
    id: "late-flight-transfer",
    title: "Flight retimed, transfer impossible",
    description:
      "Philippines: the Coron → El Nido flight lands after the last boat to Cauayan. The engine refuses to confirm a resort you can't reach.",
  },
  {
    id: "booking-partial-failure",
    title: "Supplier fails during booking",
    description:
      "Search succeeds, but at booking one transfer times out once (retried automatically) and one accommodation declines. You decide what happens next.",
  },
  {
    id: "price-change",
    title: "Price changes before payment",
    description: "The long-haul fare goes up between search and payment. You must accept the new price to continue.",
  },
];

export const DEFAULT_SCENARIO: ScenarioId = "cauayan-room-unavailable";

export function isScenario(id: unknown): id is ScenarioId {
  return typeof id === "string" && SCENARIOS.some((s) => s.id === id);
}

/** Retimed flights for a scenario. */
export function flightOverride(
  scenario: ScenarioId,
  flightNo: string,
): { dep: string; arr: string; arrDayOffset: number } | undefined {
  if (scenario === "late-flight-transfer" && flightNo === "T6402") {
    return { dep: "17:40", arr: "18:40", arrDayOffset: 0 };
  }
  return undefined;
}

/** Sold-out room nights for a scenario. `night` is the ISO date of the night. */
export function roomSoldOut(scenario: ScenarioId, propertyId: string, roomId: string, night: string): boolean {
  if (scenario === "cauayan-room-unavailable" && propertyId === "cauayan" && roomId === "beach-villa") {
    const md = night.slice(5);
    return md === "12-23" || md === "12-24";
  }
  return false;
}

/** Accommodations that decline at booking time in the partial-failure scenario (one per sample trip). */
const DECLINE_ON_BOOK = new Set([
  "paolyn-houseboats",
  "kyoto-machiya",
  "villa-cora",
  "railay-garden-view",
  "lyngen-lodge",
  "soneva-jani",
  "hipotels-cala-millor",
  "cervo-zermatt",
]);

/** Transfers that time out on the first booking attempt in the partial-failure scenario. */
const TIMEOUT_ONCE = new Set(["usu-houseboat", "tokyo-kyoto-train", "venice-florence-train", "pmi-coach", "mle-seaplane", "zrh-zermatt", "tos-car", "bkk-airport-city-budget"]);

export function bookingOutcome(scenario: ScenarioId, offer: Offer, attempt: number): "ok" | "transient" | "fatal" {
  if (scenario !== "booking-partial-failure") return "ok";
  const propertyId = offer.meta?.propertyId;
  const productId = offer.meta?.productId;
  if (typeof propertyId === "string" && DECLINE_ON_BOOK.has(propertyId)) return "fatal";
  if (typeof productId === "string" && TIMEOUT_ONCE.has(productId) && attempt === 1) return "transient";
  return "ok";
}

/** Price movement (per passenger, NOK) applied at revalidation. */
export function revalidationIncrease(scenario: ScenarioId, offer: Offer): NOK {
  if (scenario !== "price-change" || !offer.segments) return 0;
  const longHaul = offer.segments.some((s) => ["TG955", "AY61", "QR176", "LX1219", "DY1872", "6B841", "DY360"].includes(s.flightNo));
  return longHaul ? 620 : 0;
}
