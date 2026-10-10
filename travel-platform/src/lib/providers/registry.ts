/**
 * Chooses supplier adapters. Phase 1 ships mock adapters only.
 * Phase 2: set PROVIDER_MODE=live and register real adapters per kind (e.g. Duffel for flights,
 * a hotel API for stays) — see providers/live/README.md.
 */
import {
  createMockActivityProvider,
  createMockFlightProvider,
  createMockStayProvider,
  createMockTransferProvider,
} from "./mock/adapters";
import type { ProviderRegistry } from "./types";

const g = globalThis as unknown as { __itineraProviders?: ProviderRegistry };

export function getProviders(): ProviderRegistry {
  const mode = process.env.PROVIDER_MODE ?? "mock";
  if (mode !== "mock") {
    throw new Error(
      `PROVIDER_MODE=${mode} is not available yet. Live adapters are a Phase 2 deliverable (see providers/live/README.md).`,
    );
  }
  if (!g.__itineraProviders) {
    g.__itineraProviders = {
      flights: createMockFlightProvider(),
      stays: createMockStayProvider(),
      transfers: createMockTransferProvider(),
      activities: createMockActivityProvider(),
    };
  }
  return g.__itineraProviders;
}

/** Fresh registry (tests use this to avoid shared idempotency state). */
export function createMockProviders(): ProviderRegistry {
  return {
    flights: createMockFlightProvider(),
    stays: createMockStayProvider(),
    transfers: createMockTransferProvider(),
    activities: createMockActivityProvider(),
  };
}
