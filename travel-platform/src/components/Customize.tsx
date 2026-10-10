"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { property } from "@/lib/catalog";
import { usePlan } from "@/lib/client/hooks";
import { addDays, isValidIsoDate } from "@/lib/domain/dates";
import type { Cabin, ResolvedStay, StayComponent, TripPlan, TripTemplate } from "@/lib/domain/types";
import { nightsFor, resolveItinerary } from "@/lib/engine/resolve";
import { fmtRange, nok, plural } from "@/lib/format";
import { IconBack } from "./icons";
import { Timeline } from "./Timeline";
import { Button, Section, Sheet, Stepper, StickyBar } from "./ui";

const CABINS: { id: Cabin; label: string }[] = [
  { id: "economy", label: "Economy" },
  { id: "premium", label: "Premium" },
  { id: "business", label: "Business" },
];

function findStayTemplate(t: TripTemplate, id: string): StayComponent | undefined {
  for (const c of t.components) {
    if (c.kind === "stay" && c.id === id) return c;
    if (c.kind === "choice") for (const o of c.options) for (const oc of o.components) if (oc.kind === "stay" && oc.id === id) return oc;
  }
  return undefined;
}

export function Customize({ template: t, defaults }: { template: TripTemplate; defaults: TripPlan }) {
  const router = useRouter();
  const { plan, setPlan, reset } = usePlan(defaults);
  const itinerary = useMemo(() => resolveItinerary(t, plan), [t, plan]);
  const [editing, setEditing] = useState<ResolvedStay | null>(null);
  const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
  const update = (p: Partial<TripPlan>) => setPlan({ ...plan, ...p });

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-4">
        <Link href={`/trips/${t.slug}`} aria-label="Back to trip" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
          <IconBack size={20} />
        </Link>
        <div>
          <p className="text-sm text-ink-mute">Customize</p>
          <h1 className="font-display text-[26px] font-semibold leading-tight">
            {t.destination} <span className="text-ink-mute">· {t.category}</span>
          </h1>
        </div>
      </div>

      <Section title="When & who">
        <div className="space-y-5 rounded-2xl bg-paper p-5 ring-1 ring-line">
          <label className="block">
            <span className="text-sm font-medium">Departure</span>
            <input
              type="date"
              value={plan.startDate}
              min={tomorrow}
              onChange={(e) => isValidIsoDate(e.target.value) && e.target.value >= tomorrow && update({ startDate: e.target.value })}
              className="mt-2 h-12 w-full rounded-xl bg-sand px-4 text-[16px] outline-none focus:ring-1 focus:ring-ink"
              data-testid="customize-date"
            />
            <span className="mt-2 block text-sm text-ink-soft">
              {fmtRange(itinerary.startDate, itinerary.endDate)} · {plural(itinerary.totalNights, "night")}
            </span>
          </label>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Travellers</p>
              <p className="text-sm text-ink-soft">{plural(Math.ceil(plan.travelers / 2), "room")} where rooms sleep two</p>
            </div>
            <Stepper value={plan.travelers} min={1} max={9} onChange={(v) => update({ travelers: v })} label="travellers" />
          </div>
          <div>
            <p className="text-sm font-medium">Flight cabin</p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-sand p-1" role="radiogroup" aria-label="Cabin">
              {CABINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={plan.cabin === c.id}
                  onClick={() => update({ cabin: c.id })}
                  className={`h-9 rounded-full text-sm transition ${plan.cabin === c.id ? "bg-paper font-medium shadow-float" : "text-ink-soft"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Your itinerary" aside={<button type="button" onClick={reset} className="text-sm text-ink-soft underline underline-offset-4">Reset to original</button>}>
        <Timeline
          itinerary={itinerary}
          renderActions={(c) => {
            if (c.kind === "stay") {
              return (
                <button type="button" onClick={() => setEditing(c)} className="mt-3 text-sm font-medium underline underline-offset-4" data-testid={`edit-${c.id}`}>
                  {c.propertyId ? "Change hotel, room or nights" : "Choose a hotel"}
                </button>
              );
            }
            if (!c.required) {
              return (
                <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={c.included}
                    onChange={(e) => update({ activities: { ...plan.activities, [c.id]: e.target.checked } })}
                    className="h-5 w-5 accent-ink"
                    data-testid={`toggle-${c.id}`}
                  />
                  Include in my trip
                </label>
              );
            }
            return null;
          }}
          renderOpen={(o) => (
            <div className="mt-3 space-y-2" role="radiogroup" aria-label={o.title}>
              {o.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={o.selectedOptionId === opt.id}
                  onClick={() => update({ choices: { ...plan.choices, [o.choiceId]: opt.id } })}
                  className={`w-full rounded-xl bg-paper p-3 text-left ring-1 transition ${o.selectedOptionId === opt.id ? "ring-2 ring-ink" : "ring-line hover:bg-sand"}`}
                  data-testid={`choice-${opt.id}`}
                >
                  <span className="block text-[15px] font-medium">{opt.title}</span>
                  <span className="block text-[13px] text-ink-soft">{opt.description}</span>
                </button>
              ))}
            </div>
          )}
        />
      </Section>

      <StickyBar>
        <p className="mr-auto text-sm text-ink-soft">
          {plural(plan.travelers, "traveller")} · {fmtRange(itinerary.startDate, itinerary.endDate)}
        </p>
        <Button onClick={() => router.push(`/trips/${t.slug}/availability`)} data-testid="customize-check">
          Check availability
        </Button>
      </StickyBar>

      {editing && (
        <StaySheet
          stay={editing}
          template={findStayTemplate(t, editing.id)!}
          plan={plan}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            update({ stays: { ...plan.stays, [editing.id]: v } });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StaySheet({
  stay,
  template,
  plan,
  onClose,
  onSave,
}: {
  stay: ResolvedStay;
  template: StayComponent;
  plan: TripPlan;
  onClose: () => void;
  onSave: (v: TripPlan["stays"][string]) => void;
}) {
  const [propertyId, setPropertyId] = useState(stay.propertyId);
  const [roomId, setRoomId] = useState(stay.roomId);
  const [nights, setNights] = useState(nightsFor(template, plan));
  const canSave = !!propertyId && !!roomId;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Stay in ${stay.title}`}
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={!canSave}
          onClick={() => onSave({ propertyId, roomId, nightsDelta: nights - template.nights })}
          data-testid="save-stay"
        >
          Save
        </Button>
      }
    >
      <div className="flex items-center justify-between rounded-2xl bg-sand p-4">
        <div>
          <p className="text-sm font-medium">Nights</p>
          <p className="text-[13px] text-ink-soft">Later parts of the trip move with this change.</p>
        </div>
        <Stepper value={nights} min={1} max={template.nights + 7} onChange={setNights} label="nights" />
      </div>
      <div className="mt-5 space-y-4" role="radiogroup" aria-label="Hotel and room">
        {template.optionPropertyIds.map((pid) => {
          const p = property(pid)!;
          return (
            <div key={pid} className={`rounded-2xl p-4 ring-1 ${propertyId === pid ? "ring-2 ring-ink" : "ring-line"}`}>
              <p className="font-medium">{p.name}</p>
              <p className="text-[13px] text-ink-soft">
                {p.tier} · {p.area}
                {pid === template.propertyId ? " · in the original trip" : ""}
              </p>
              <p className="mt-1 text-[13px] text-ink-mute">{p.description}</p>
              <div className="mt-3 space-y-1.5">
                {p.rooms.map((r) => {
                  const on = propertyId === pid && roomId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setPropertyId(pid);
                        setRoomId(r.id);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${on ? "bg-ink text-white" : "bg-sand hover:bg-line"}`}
                      data-testid={`room-${pid}-${r.id}`}
                    >
                      <span>
                        {r.name} <span className={on ? "text-white/70" : "text-ink-mute"}>· {r.board}</span>
                      </span>
                      <span className="tabular-nums">from {nok(r.rate)}/night</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] text-ink-mute">Room categories and rates are illustrative. Seasonal prices are calculated at the availability check.</p>
    </Sheet>
  );
}
