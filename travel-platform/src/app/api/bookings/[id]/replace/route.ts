import { getOrchestrator } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { componentId, offerId } = (await req.json()) as { componentId: string; offerId: string };
    return Response.json(await getOrchestrator().replaceReservation(params.id, componentId, offerId));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 409 });
  }
}
