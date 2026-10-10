"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays, isValidIsoDate } from "@/lib/domain/dates";
import type { TripPlan } from "@/lib/domain/types";
import { fmtLong, plural } from "@/lib/format";
import { Button, Sheet, Stepper } from "./ui";

/** Choose departure date and travellers, then run the booking engine. */
export function DatesSheet({
  open,
  onClose,
  plan,
  setPlan,
  nights,
}: {
  open: boolean;
  onClose: () => void;
  plan: TripPlan;
  setPlan: (p: TripPlan) => void;
  nights: number;
}) {
  const router = useRouter();
  const [date, setDate] = useState(plan.startDate);
  const [travelers, setTravelers] = useState(plan.travelers);
  useEffect(() => {
    if (open) {
      setDate(plan.startDate);
      setTravelers(plan.travelers);
    }
  }, [open, plan.startDate, plan.travelers]);
  const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
  const valid = isValidIsoDate(date) && date >= tomorrow;

  const go = () => {
    if (!valid) return;
    setPlan({ ...plan, startDate: date, travelers });
    router.push(`/trips/${plan.slug}/availability`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your dates"
      footer={
        <Button size="lg" className="w-full" onClick={go} disabled={!valid} data-testid="check-availability">
          Check availability
        </Button>
      }
    >
      <label className="block">
        <span className="text-sm font-medium">Departure</span>
        <input
          type="date"
          value={date}
          min={tomorrow}
          onChange={(e) => setDate(e.target.value)}
          className="mt-2 h-12 w-full rounded-xl bg-sand px-4 text-[16px] outline-none ring-1 ring-transparent focus:ring-ink"
          data-testid="start-date"
        />
      </label>
      <p className="mt-2 text-sm text-ink-soft">
        {valid ? (
          <>
            Home on <strong className="font-medium text-ink">{fmtLong(addDays(date, nights))}</strong> · {plural(nights, "night")}. Every date moves with yours; the route and order stay the same.
          </>
        ) : (
          "Choose a date from tomorrow onwards."
        )}
      </p>
      <div className="mt-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Travellers</p>
          <p className="text-sm text-ink-soft">Adults · rooms are allocated automatically</p>
        </div>
        <Stepper value={travelers} min={1} max={9} onChange={setTravelers} label="travellers" />
      </div>
    </Sheet>
  );
}
