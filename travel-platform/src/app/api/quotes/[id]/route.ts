import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const q = getStore().quotes.get(params.id);
  if (!q) return Response.json({ error: "Quote not found" }, { status: 404 });
  return Response.json(q);
}
