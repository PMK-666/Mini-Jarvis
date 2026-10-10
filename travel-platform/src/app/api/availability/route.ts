/**
 * POST /api/availability — runs the booking engine and streams progress as NDJSON.
 * Body: { plan: TripPlan, scenario: ScenarioId }
 */
import { demoLatency } from "@/lib/booking";
import { getTrip } from "@/lib/data/trips";
import type { TripPlan } from "@/lib/domain/types";
import { runAvailability, validatePlanInput, type EngineEvent } from "@/lib/engine";
import { DEFAULT_SCENARIO, isScenario } from "@/lib/providers/mock/scenarios";
import { getProviders } from "@/lib/providers/registry";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { plan?: TripPlan; scenario?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const plan = body.plan;
  const t = plan && getTrip(plan.slug);
  if (!plan || !t) return Response.json({ error: "Unknown trip" }, { status: 404 });
  const normalized: TripPlan = {
    slug: plan.slug,
    startDate: String(plan.startDate),
    travelers: Number(plan.travelers),
    cabin: ["economy", "premium", "business"].includes(plan.cabin) ? plan.cabin : "economy",
    stays: plan.stays ?? {},
    activities: plan.activities ?? {},
    choices: plan.choices ?? {},
    flights: plan.flights ?? {},
  };
  const invalid = validatePlanInput(t, normalized);
  if (invalid) return Response.json({ error: invalid }, { status: 422 });
  const scenario = isScenario(body.scenario) ? body.scenario : DEFAULT_SCENARIO;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: EngineEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const quote = await runAvailability(t, normalized, {
          scenario,
          providers: getProviders(),
          simulateLatency: demoLatency(),
          onEvent: (e) => {
            if (e.type !== "quote") send(e);
          },
        });
        getStore().quotes.set(quote.id, quote);
        send({ type: "quote", quote });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
