"use client";
import { useSaved } from "@/lib/client/hooks";
import type { TripSummary } from "@/lib/summary";
import { TripCard } from "./TripCard";
import { ButtonLink } from "./ui";

export function SavedTrips({ trips }: { trips: TripSummary[] }) {
  const { saved, ready } = useSaved();
  const list = saved.map((s) => trips.find((t) => t.slug === s)).filter((t): t is TripSummary => !!t);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-[34px] font-semibold">Saved</h1>
      <p className="mt-1 text-ink-soft">Your collection. Saved on this device until accounts arrive.</p>
      {ready && list.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-ink-soft">Tap the heart on any trip to save it here.</p>
          <ButtonLink href="/" className="mt-5">Discover trips</ButtonLink>
        </div>
      )}
      <div className="grid gap-x-6 gap-y-10 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <TripCard key={t.slug} trip={t} />
        ))}
      </div>
    </div>
  );
}
