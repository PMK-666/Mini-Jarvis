import { getOrchestrator } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    return Response.json(await getOrchestrator().cancel(params.id));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 409 });
  }
}
