import { notFound } from "next/navigation";
import { Availability } from "@/components/Availability";
import { defaultPlan, getTrip } from "@/lib/data/trips";

export default function AvailabilityPage({ params }: { params: { slug: string } }) {
  const t = getTrip(params.slug);
  if (!t) notFound();
  return <Availability template={t} defaults={defaultPlan(t)} />;
}
