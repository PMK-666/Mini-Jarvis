import { notFound } from "next/navigation";
import { TripDetail } from "@/components/TripDetail";
import { defaultPlan, getTrip } from "@/lib/data/trips";
import { startingPrice } from "@/lib/pricing-preview";
import { summarize } from "@/lib/summary";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: { slug: string } }) {
  const t = getTrip(params.slug);
  if (!t) notFound();
  const from = await startingPrice(t);
  return <TripDetail template={t} summary={summarize(t, from)} from={from} defaults={defaultPlan(t)} />;
}
