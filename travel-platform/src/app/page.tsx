import { Discover } from "@/components/Discover";
import { allCategories, listTrips } from "@/lib/data/trips";
import { startingPrice } from "@/lib/pricing-preview";
import { summarize } from "@/lib/summary";

export const dynamic = "force-dynamic";

export default async function Home() {
  const trips = await Promise.all(listTrips().map(async (t) => summarize(t, await startingPrice(t))));
  return <Discover trips={trips} categories={allCategories()} />;
}
