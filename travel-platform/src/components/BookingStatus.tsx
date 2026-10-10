"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useMyBookings } from "@/lib/client/hooks";
import type { Booking, NOK, Offer, Quote, Reservation } from "@/lib/domain/types";
import { fmtRange, nok, plural, signedNok } from "@/lib/format";
import { IconAlert, IconBed, IconBoat, IconCheck, IconDownload, IconPlane, IconSparkle, IconX } from "./icons";
import { Timeline } from "./Timeline";
import { Badge, Button, ButtonLink, Section, Sheet } from "./ui";

const ACTIVE: Booking["status"][] = ["revalidating", "payment_authorizing", "booking_components", "cancelling"];

const kindIcon = (k: Reservation["kind"]) =>
  k === "flight" ? <IconPlane size={16} /> : k === "stay" ? <IconBed size={16} /> : k === "transfer" ? <IconBoat size={16} /> : <IconSparkle size={16} />;

function ReservationBadge({ r }: { r: Reservation }) {
  switch (r.status) {
    case "confirmed":
      return <Badge t="ok"><IconCheck size={13} /> Confirmed</Badge>;
    case "failed":
      return <Badge t="bad">Not confirmed</Badge>;
    case "retrying":
      return <Badge t="warn">Retrying · attempt {r.attempts}</Badge>;
    case "requested":
      return <Badge><span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulseDot" /> Requesting</Badge>;
    case "cancelling":
      return <Badge>Cancelling</Badge>;
    case "cancelled":
      return <Badge>Cancelled</Badge>;
    default:
      return <Badge>Waiting</Badge>;
  }
}

function toIcs(b: Booking): string {
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = (iso: string) => iso.replace(/-/g, "");
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`);
  const events: string[] = [];
  for (const r of b.reservations.filter((x) => x.status === "confirmed")) {
    const o = r.offer;
    const uid = `${b.id}-${r.componentId}@itinera.demo`;
    if (o.segments) {
      o.segments.forEach((s, i) =>
        events.push(["BEGIN:VEVENT", `UID:${uid}-${i}`, `DTSTAMP:${stamp(b.createdAt)}`, `DTSTART:${stamp(s.depUtc)}`, `DTEND:${stamp(s.arrUtc)}`, `SUMMARY:${esc(`${s.flightNo} ${s.from}→${s.to}`)}`, `DESCRIPTION:${esc(`${s.carrier} · ref ${r.supplierRef} · DEMO`)}`, "END:VEVENT"].join("\r\n")),
      );
    } else if (r.kind === "stay") {
      const nights = o.meta?.nights;
      const checkIn = String(o.meta?.checkIn ?? "");
      if (checkIn) {
        events.push(["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp(b.createdAt)}`, `DTSTART;VALUE=DATE:${day(checkIn)}`, `DTEND;VALUE=DATE:${day(String(o.meta?.checkOut))}`, `SUMMARY:${esc(`${o.productName} (${nights} nights)`)}`, `DESCRIPTION:${esc(`${o.detail} · ref ${r.supplierRef} · DEMO`)}`, "END:VEVENT"].join("\r\n"));
      }
    } else if (o.startUtc && o.endUtc) {
      events.push(["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp(b.createdAt)}`, `DTSTART:${stamp(o.startUtc)}`, `DTEND:${stamp(o.endUtc)}`, `SUMMARY:${esc(o.productName)}`, `DESCRIPTION:${esc(`${o.detail} · ref ${r.supplierRef} · DEMO`)}`, "END:VEVENT"].join("\r\n"));
    }
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Itinera//Demo//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function BookingStatus({ id }: { id: string }) {
  const router = useRouter();
  const { add } = useMyBookings();
  const [b, setB] = useState<Booking | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState<Reservation | null>(null);
  const [options, setOptions] = useState<{ offer: Offer; delta: NOK; label: string }[] | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings/${id}`, { cache: "no-store" });
    if (res.status === 404) return setMissing(true);
    const data = (await res.json()) as Booking;
    setB(data);
    return data;
  }, [id]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const data = await load().catch(() => undefined);
      if (!stop && (!data || ACTIVE.includes(data.status))) timer = setTimeout(tick, 700);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!b) return;
    add({ id: b.id, reference: b.reference, slug: b.slug, title: b.tripTitle, startDate: b.startDate, endDate: b.endDate, createdAt: b.createdAt });
    if (!quote) fetch(`/api/quotes/${b.quoteId}`).then((r) => (r.ok ? r.json() : null)).then((q) => q && setQuote(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.id, b?.reference]);

  const openReplace = async (r: Reservation) => {
    setReplacing(r);
    setOptions(null);
    const res = await fetch(`/api/bookings/${id}/alternatives?componentId=${encodeURIComponent(r.componentId)}`);
    setOptions(await res.json());
  };

  const replace = async (offerId: string) => {
    if (!replacing) return;
    setBusy(true);
    const res = await fetch(`/api/bookings/${id}/replace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ componentId: replacing.componentId, offerId }),
    });
    setBusy(false);
    setReplacing(null);
    if (res.ok) setB(await res.json());
    else await load();
  };

  const cancel = async () => {
    setBusy(true);
    setConfirmCancel(false);
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) setB(await res.json());
    else await load();
  };

  const downloadIcs = () => {
    if (!b) return;
    const blob = new Blob([toIcs(b)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itinera-${b.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">Booking not found</h1>
        <p className="mt-3 text-ink-soft">Demo bookings live in server memory and disappear when the server restarts.</p>
        <Link href="/trips" className="mt-6 inline-block font-medium underline underline-offset-4">Your trips</Link>
      </div>
    );
  }
  if (!b) return <div className="mx-auto max-w-3xl px-6 py-20 text-ink-mute">Loading booking…</div>;

  const confirmed = b.reservations.filter((r) => r.status === "confirmed").length;
  const failed = b.reservations.filter((r) => r.status === "failed");
  const active = ACTIVE.includes(b.status);
  const paymentDeclined = b.status === "failed" && b.payment.status === "declined";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <section className="pt-8" aria-live="polite">
        <p className="text-sm text-ink-mute">
          {b.tripTitle} · {fmtRange(b.startDate, b.endDate)} · {plural(b.travelers.length, "traveller")}
        </p>
        {active && (
          <>
            <h1 className="mt-1 font-display text-[32px] font-semibold leading-tight">{b.status === "cancelling" ? "Cancelling your trip" : "Securing your trip"}</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              {b.status === "payment_authorizing" ? "Authorising your payment…" : `${confirmed} of ${b.reservations.length} reservations confirmed. Suppliers confirm independently.`}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${Math.max(4, (confirmed / b.reservations.length) * 100)}%` }} />
            </div>
          </>
        )}
        {b.status === "confirmed" && (
          <div data-testid="booking-confirmed">
            <span className="mt-4 grid h-12 w-12 place-items-center rounded-full bg-ok text-white"><IconCheck size={26} /></span>
            <h1 className="mt-4 font-display text-[32px] font-semibold leading-tight">Your trip is confirmed</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              Booking reference <strong className="font-semibold text-ink">{b.reference}</strong>. All {b.reservations.length} reservations are confirmed by their suppliers. A confirmation would be sent to {b.contact.email} (simulated).
            </p>
          </div>
        )}
        {b.status === "action_required" && (
          <div data-testid="booking-action-required">
            <span className="mt-4 grid h-12 w-12 place-items-center rounded-full bg-warn text-white"><IconAlert size={24} /></span>
            <h1 className="mt-4 font-display text-[30px] font-semibold leading-tight">Part of your trip couldn&apos;t be confirmed</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              {confirmed} of {b.reservations.length} reservations are confirmed. Your trip is <strong className="font-medium text-ink">not</strong> confirmed yet, and your payment is only authorised, not charged. Choose a replacement or cancel everything.
            </p>
          </div>
        )}
        {paymentDeclined && (
          <div data-testid="booking-declined">
            <span className="mt-4 grid h-12 w-12 place-items-center rounded-full bg-bad text-white"><IconX size={24} /></span>
            <h1 className="mt-4 font-display text-[30px] font-semibold leading-tight">Payment declined</h1>
            <p className="mt-2 text-[15px] text-ink-soft">{b.payment.declineReason} Nothing was booked and nothing was charged.</p>
            <Button
              className="mt-4"
              onClick={() => {
                try {
                  sessionStorage.removeItem(`itinera.idem.${b.quoteId}`);
                } catch {}
                router.push(`/checkout/${b.quoteId}`);
              }}
              data-testid="try-again"
            >
              Try another card
            </Button>
          </div>
        )}
        {b.status === "cancelled" && (
          <div data-testid="booking-cancelled">
            <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight">Trip cancelled</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              {b.payment.status === "voided"
                ? "Your payment authorisation was released. You were not charged."
                : b.payment.refunded
                  ? `${nok(b.payment.refunded)} refunded to your card (simulated).`
                  : "No payment was taken."}
            </p>
          </div>
        )}
      </section>

      {failed.length > 0 && b.status === "action_required" && (
        <Section title="Needs your decision">
          {failed.map((r) => (
            <article key={r.componentId} className="rounded-2xl bg-paper p-5 ring-1 ring-line">
              <p className="font-semibold">{r.title} · {r.offer.productName}</p>
              <p className="mt-1 text-[15px] text-bad">{r.error}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.kind === "stay" && (
                  <Button onClick={() => openReplace(r)} disabled={busy} data-testid="see-replacements">
                    See replacements
                  </Button>
                )}
                <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={busy} data-testid="cancel-all">
                  Cancel whole trip
                </Button>
              </div>
            </article>
          ))}
        </Section>
      )}

      <Section title="Reservations">
        <ul className="divide-y divide-line rounded-2xl bg-paper ring-1 ring-line">
          {b.reservations.map((r) => (
            <li key={r.componentId} className="flex items-start gap-3 p-4" data-testid={`res-${r.componentId}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-ink-soft">{kindIcon(r.kind)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <ReservationBadge r={r} />
                </div>
                <p className="text-[14px] text-ink-soft">{r.offer.productName}</p>
                <p className="text-[13px] text-ink-mute">
                  {r.supplier}
                  {r.supplierRef ? ` · ref ${r.supplierRef}` : ""}
                  {r.refundAmount !== undefined ? ` · refund ${nok(r.refundAmount)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Payment">
        <div className="flex items-center justify-between rounded-2xl bg-paper p-5 ring-1 ring-line">
          <div>
            <p className="font-medium tabular-nums">{nok(b.payment.amount)}</p>
            <p className="text-[13px] text-ink-mute">{b.payment.provider}</p>
          </div>
          <Badge t={b.payment.status === "captured" ? "ok" : b.payment.status === "declined" ? "bad" : b.payment.status === "authorized" ? "warn" : "neutral"}>
            {{ none: "Not started", authorized: "Authorised, not charged", captured: "Charged", voided: "Released", declined: "Declined", refunded: "Refunded", partially_refunded: "Partly refunded" }[b.payment.status]}
          </Badge>
        </div>
      </Section>

      {b.status === "confirmed" && quote && (
        <Section title="Your itinerary" aside={<button type="button" onClick={downloadIcs} className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"><IconDownload size={16} /> Calendar</button>}>
          <Timeline itinerary={quote.itinerary} results={b.reservations.map((r) => ({ componentId: r.componentId, status: "available", offer: r.offer, durationMs: 0 }))} hideExcluded showNotes={false} />
        </Section>
      )}

      <Section title="Activity">
        <ol className="space-y-2 text-[14px]">
          {b.events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-16 shrink-0 tabular-nums text-ink-mute">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className={e.level === "error" ? "text-bad" : e.level === "warning" ? "text-warn" : e.level === "success" ? "text-ink" : "text-ink-soft"}>{e.message}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="flex flex-wrap gap-2 pt-2">
        {b.status === "confirmed" && (
          <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={busy} data-testid="cancel-booking">
            Cancel booking
          </Button>
        )}
        <ButtonLink href="/trips" variant="secondary">All trips</ButtonLink>
      </div>

      <Sheet open={!!replacing} onClose={() => setReplacing(null)} title="Choose a replacement">
        {!options && <p className="text-ink-mute">Searching comparable stays for the same dates…</p>}
        {options && options.length === 0 && <p className="text-ink-soft">No replacements available. You can cancel the trip for a full release of your payment.</p>}
        <ul className="space-y-2">
          {options?.map((o) => (
            <li key={o.offer.id}>
              <button type="button" disabled={busy} onClick={() => replace(o.offer.id)} className="w-full rounded-xl bg-sand p-4 text-left transition hover:bg-line disabled:opacity-60" data-testid="replacement-option">
                <span className="flex justify-between gap-3">
                  <span className="font-medium">{o.label}</span>
                  <span className="shrink-0 text-sm tabular-nums">{signedNok(o.delta)}</span>
                </span>
                <span className="mt-1 block text-[13px] text-ink-mute">{o.offer.detail} · {o.offer.cancellation.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this trip?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(false)}>Keep trip</Button>
            <Button variant="danger" className="flex-1" onClick={cancel} data-testid="confirm-cancel">Cancel trip</Button>
          </div>
        }
      >
        <p className="text-[15px] text-ink-soft">
          Every confirmed reservation is cancelled with its supplier under its cancellation conditions.
          {b.payment.status === "authorized" ? " Your payment authorisation is released — you won't be charged." : " Refundable amounts go back to your card."} In demo mode nothing real is cancelled.
        </p>
      </Sheet>
    </div>
  );
}
