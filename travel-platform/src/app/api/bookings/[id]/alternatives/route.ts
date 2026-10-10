import { getOrchestrator } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const componentId = new URL(req.url).searchParams.get("componentId") ?? "";
  return Response.json(await getOrchestrator().alternativesFor(params.id, componentId));
}
