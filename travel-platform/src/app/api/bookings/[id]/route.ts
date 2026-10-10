import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const b = getStore().bookings.get(params.id);
  if (!b) return Response.json({ error: "Booking not found" }, { status: 404 });
  return Response.json(b);
}
