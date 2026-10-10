/**
 * POST /api/bookings — revalidate, authorise payment and start supplier bookings.
 * Requires an `Idempotency-Key` header. Returns immediately; poll GET /api/bookings/:id.
 */
import { getOrchestrator } from "@/lib/booking";
import type { Traveler } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key = req.headers.get("idempotency-key") ?? "";
  let body: {
    quoteId?: string;
    travelers?: Traveler[];
    contact?: { email: string; phone: string };
    paymentToken?: string;
    acceptedTotal?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.paymentToken === "string" && /\d{12,}/.test(body.paymentToken)) {
    // Defence in depth: raw card numbers must never reach this server.
    return Response.json({ error: "Card numbers must not be sent to this endpoint." }, { status: 400 });
  }
  const orchestrator = getOrchestrator();
  const result = await orchestrator.start({
    quoteId: String(body.quoteId ?? ""),
    travelers: Array.isArray(body.travelers) ? body.travelers : [],
    contact: body.contact ?? { email: "", phone: "" },
    paymentToken: String(body.paymentToken ?? ""),
    idempotencyKey: key,
    acceptedTotal: typeof body.acceptedTotal === "number" ? body.acceptedTotal : undefined,
  });
  if (result.kind === "error") {
    const status = result.code === "quote_not_found" ? 404 : result.code === "invalid" ? 422 : 409;
    return Response.json({ error: result.message, code: result.code }, { status });
  }
  if (result.kind === "price_changed") return Response.json(result, { status: 409 });
  if (!result.replay) {
    void orchestrator.process(result.booking.id, String(body.paymentToken)).catch((err) => {
      console.error("Booking processing failed", err);
    });
  }
  return Response.json({ kind: "booking", bookingId: result.booking.id, replay: result.replay }, { status: result.replay ? 200 : 201 });
}
