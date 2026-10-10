import { SavedTrips } from "@/components/SavedTrips";
import { listTrips } from "@/lib/data/trips";
import { startingPrice } from "@/lib/pricing-preview";
import { summarize } from "@/lib/summary";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const trips = await Promise.all(listTrips().map(async (t) => summarize(t, await startingPrice(t))));
  return <SavedTrips trips={trips} />;
}
