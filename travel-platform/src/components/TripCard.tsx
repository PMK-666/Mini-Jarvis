"use client";
import Link from "next/link";
import { useSaved } from "@/lib/client/hooks";
import { nok } from "@/lib/format";
import type { TripSummary } from "@/lib/summary";
import { IconHeart } from "./icons";
import { TripImage } from "./TripImage";

export function TripCard({ trip, priority }: { trip: TripSummary; priority?: boolean }) {
  const { saved, toggle } = useSaved();
  const isSaved = saved.includes(trip.slug);
  return (
    <article className="group relative animate-rise">
      <Link href={`/trips/${trip.slug}`} className="block focus-visible:outline-none" data-testid={`trip-${trip.slug}`}>
        <TripImage
          scene={trip.scene}
          photoUrl={trip.photoUrl}
          alt={`${trip.destination} — ${trip.category}`}
          priority={priority}
          className="aspect-[4/5] rounded-[22px] transition-transform duration-500 group-hover:scale-[1.01] sm:aspect-[4/4.4]"
        />
        <div className="mt-3 px-0.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-[22px] font-semibold leading-tight">{trip.destination}</h3>
            {trip.reviewCount > 0 && trip.rating ? (
              <span className="mt-1 text-sm">★ {trip.rating.toFixed(1)}</span>
            ) : (
              <span className="mt-1.5 text-[13px] text-ink-mute">No reviews yet</span>
            )}
          </div>
          <p className="text-[15px] text-ink-soft">{trip.category}</p>
          <p className="mt-1 text-[14px] text-ink-mute">
            {trip.nights} nights · {trip.destinations.length} destination{trip.destinations.length > 1 ? "s" : ""} · {trip.travelStyle}
          </p>
          {trip.fromPerPerson !== undefined && (
            <p className="mt-1.5 text-[15px]">
              <span className="font-semibold">From {nok(trip.fromPerPerson)}</span>
              <span className="text-ink-mute"> per person · illustrative</span>
            </p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggle(trip.slug)}
        aria-pressed={isSaved}
        aria-label={isSaved ? `Remove ${trip.destination} from saved` : `Save ${trip.destination}`}
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-paper/85 text-ink shadow-float backdrop-blur transition hover:scale-105"
      >
        <IconHeart size={20} filled={isSaved} className={isSaved ? "text-accent" : ""} />
      </button>
    </article>
  );
}
