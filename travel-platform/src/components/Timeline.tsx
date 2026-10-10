"use client";
import { activityProduct, property, transferProduct } from "@/lib/catalog";
import { addDays, daysBetween } from "@/lib/domain/dates";
import type { ComponentResult, OpenSegment, ResolvedComponent, ResolvedItinerary } from "@/lib/domain/types";
import { fmtDay, hm, nok, plural } from "@/lib/format";
import { IconBed, IconBoat, IconCar, IconPlane, IconQuestion, IconSparkle, IconTrain } from "./icons";
import { Badge, ProvenanceBadge } from "./ui";

export function componentIcon(c: ResolvedComponent, size = 18) {
  if (c.kind === "flight") return <IconPlane size={size} />;
  if (c.kind === "stay") return <IconBed size={size} />;
  if (c.kind === "activity") return <IconSparkle size={size} />;
  const mode = transferProduct(c.productId)?.mode ?? "";
  if (/boat|Seaplane/i.test(mode)) return <IconBoat size={size} />;
  if (/Train/.test(mode)) return <IconTrain size={size} />;
  return <IconCar size={size} />;
}

export function componentSubtitle(c: ResolvedComponent, result?: ComponentResult): string {
  const o = result?.offer;
  switch (c.kind) {
    case "flight":
      if (o?.segments) return o.segments.map((s) => `${s.flightNo} ${hm(s.depLocal)}–${hm(s.arrLocal)}`).join(" · ");
      return c.legs.map((l) => `${l.from}–${l.to}${l.chosenFlightNo ? ` ${l.chosenFlightNo}` : ""}`).join(" · ");
    case "stay": {
      const p = property(c.propertyId);
      if (!p) return "Hotel not chosen yet";
      const room = p.rooms.find((r) => r.id === (c.roomId ?? String(o?.meta?.roomId ?? "")));
      return `${p.name}${room ? ` · ${room.name}` : ""} · ${plural(c.nights, "night")}`;
    }
    case "transfer": {
      const t = transferProduct(c.productId);
      return `${t?.mode ?? "Transfer"}${o?.startLocal ? ` · ${hm(o.startLocal)}` : ""}${t ? ` · ${t.durationMin} min` : ""}`;
    }
    case "activity": {
      const a = activityProduct(c.productId);
      return a ? `${a.name} · ${a.start}` : "";
    }
  }
}

type Row =
  | { type: "component"; c: ResolvedComponent }
  | { type: "open"; o: OpenSegment };

export interface TimelineProps {
  itinerary: ResolvedItinerary;
  results?: ComponentResult[];
  /** Hide components that aren't included (e.g. optional activities switched off). */
  hideExcluded?: boolean;
  renderActions?: (c: ResolvedComponent) => React.ReactNode;
  renderOpen?: (o: OpenSegment) => React.ReactNode;
  showNotes?: boolean;
}

export function Timeline({ itinerary, results, hideExcluded, renderActions, renderOpen, showNotes = true }: TimelineProps) {
  const rows: (Row & { date: string })[] = [
    ...itinerary.components.filter((c) => !hideExcluded || c.included).map((c) => ({ type: "component" as const, c, date: c.date })),
    ...itinerary.openSegments.map((o) => ({ type: "open" as const, o, date: o.date })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type === "open" ? -1 : 0));

  const days = [...new Set(rows.map((r) => r.date))];
  const byResult = new Map((results ?? []).map((r) => [r.componentId, r]));

  return (
    <ol className="relative">
      {days.map((day) => {
        const dayIndex = daysBetween(itinerary.startDate, day);
        return (
          <li key={day} className="relative pb-6 pl-8">
            <span className="absolute left-[7px] top-2 h-full w-px bg-line" aria-hidden="true" />
            <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-ink bg-canvas" aria-hidden="true" />
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-mute">
              Day {dayIndex + 1} · {fmtDay(day)}
            </p>
            <ul className="mt-2 space-y-2">
              {rows
                .filter((r) => r.date === day)
                .map((r) =>
                  r.type === "open" ? (
                    <li key={r.o.choiceId} className="rounded-2xl border border-dashed border-warn/50 bg-warn-soft/40 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-warn"><IconQuestion size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{r.o.title}</p>
                            <ProvenanceBadge p={r.o.provenance} />
                          </div>
                          <p className="text-[14px] text-ink-soft">
                            {fmtDay(r.o.date)} – {fmtDay(addDays(r.o.date, r.o.nights))} ·{" "}
                            {r.o.selectedOptionId ? r.o.options.find((x) => x.id === r.o.selectedOptionId)?.title : "Not decided yet"}
                          </p>
                          {showNotes && r.o.note && !r.o.selectedOptionId && <p className="mt-1 text-[13px] text-ink-mute">{r.o.note}</p>}
                          {renderOpen?.(r.o)}
                        </div>
                      </div>
                    </li>
                  ) : (
                    <TimelineItem key={r.c.id} c={r.c} result={byResult.get(r.c.id)} actions={renderActions?.(r.c)} showNotes={showNotes} />
                  ),
                )}
            </ul>
          </li>
        );
      })}
      <li className="relative pl-8">
        <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full bg-ink" aria-hidden="true" />
        <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-mute">
          Home · {fmtDay(itinerary.endDate)}
        </p>
      </li>
    </ol>
  );
}

function TimelineItem({ c, result, actions, showNotes }: { c: ResolvedComponent; result?: ComponentResult; actions?: React.ReactNode; showNotes: boolean }) {
  const muted = !c.included;
  return (
    <li className={`rounded-2xl bg-paper p-4 ring-1 ring-line ${muted ? "opacity-60" : ""}`} data-testid={`tl-${c.id}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-ink-soft">{componentIcon(c)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium">{c.title}</p>
            {c.provenance !== "booked" && <ProvenanceBadge p={c.provenance} />}
            {!c.required && <Badge>{c.included ? "Optional · included" : "Optional"}</Badge>}
          </div>
          <p className="text-[14px] text-ink-soft">{componentSubtitle(c, result)}</p>
          {result?.offer && c.included && <p className="mt-0.5 text-[13px] text-ink-mute">{nok(result.offer.price.total)}</p>}
          {showNotes && c.note && <p className="mt-1 text-[13px] text-ink-mute">{c.note}</p>}
          {actions}
        </div>
      </div>
    </li>
  );
}
