import { getPayments } from "../payments";
import { getProviders } from "../providers/registry";
import { getStore } from "../store";
import { createOrchestrator, type Orchestrator } from "./orchestrator";

const g = globalThis as unknown as { __itineraOrchestrator?: Orchestrator };

export const demoLatency = () => process.env.DEMO_LATENCY !== "off";

export function getOrchestrator(): Orchestrator {
  if (!g.__itineraOrchestrator) {
    g.__itineraOrchestrator = createOrchestrator({
      providers: getProviders(),
      payments: getPayments(),
      store: getStore(),
      simulateLatency: demoLatency(),
    });
  }
  return g.__itineraOrchestrator;
}
