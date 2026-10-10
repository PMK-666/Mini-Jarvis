import { notFound } from "next/navigation";
import { Customize } from "@/components/Customize";
import { defaultPlan, getTrip } from "@/lib/data/trips";

export default function CustomizePage({ params }: { params: { slug: string } }) {
  const t = getTrip(params.slug);
  if (!t) notFound();
  return <Customize template={t} defaults={defaultPlan(t)} />;
}
