"use client";
import Link from "next/link";
import { useMyBookings } from "@/lib/client/hooks";
import { fmtRange } from "@/lib/format";
import { IconChevron } from "./icons";
import { ButtonLink } from "./ui";

export function MyTrips() {
  const { bookings, ready } = useMyBookings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-[34px] font-semibold">Trips</h1>
      <p className="mt-1 text-ink-soft">Demo bookings made in this browser.</p>
      {ready && bookings.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-ink-soft">No trips booked yet.</p>
          <ButtonLink href="/trips/philippines-honeymoon" className="mt-5">Explore the Philippines honeymoon</ButtonLink>
        </div>
      )}
      <ul className="mt-6 divide-y divide-line rounded-2xl bg-paper ring-1 ring-line">
        {bookings.map((b) => (
          <li key={b.id}>
            <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-sand">
              <div>
                <p className="font-medium">{b.title}</p>
                <p className="text-sm text-ink-mute">
                  {fmtRange(b.startDate, b.endDate)}
                  {b.reference ? ` · ${b.reference}` : ""}
                </p>
              </div>
              <IconChevron size={18} className="text-ink-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
