"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMyBookings } from "@/lib/client/hooks";
import type { Quote, Traveler, TripTemplate } from "@/lib/domain/types";
import { fmtRange, nok, plural, signedNok } from "@/lib/format";
import { PriceBreakdown } from "./Availability";
import { HostedCardField, type Tokenize } from "./HostedCardField";
import { IconAlert, IconBack } from "./icons";
import { componentIcon, componentSubtitle } from "./Timeline";
import { TripImage } from "./TripImage";
import { Button, Section, Sheet, StickyBar } from "./ui";

interface PriceChange {
  oldTotal: number;
  newTotal: number;
  changes: { componentId: string; title: string; oldTotal: number; newTotal: number }[];
}

const idemKey = (quoteId: string) => `itinera.idem.${quoteId}`;

function getIdempotencyKey(quoteId: string): string {
  try {
    const existing = sessionStorage.getItem(idemKey(quoteId));
    if (existing) return existing;
    const k = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(idemKey(quoteId), k);
    return k;
  } catch {
    return `${quoteId}-${Date.now()}`;
  }
}

export function Checkout({ quote, template: t }: { quote: Quote; template: TripTemplate }) {
  const router = useRouter();
  const { add } = useMyBookings();
  const n = quote.plan.travelers;
  const [travelers, setTravelers] = useState<Traveler[]>(() => Array.from({ length: n }, () => ({ firstName: "", lastName: "", dateOfBirth: "" })));
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"card" | "vipps">("card");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null);
  const [acceptedTotal, setAcceptedTotal] = useState<number | undefined>(undefined);
  const tokenize = useRef<Tokenize>(() => ({ error: "Payment form not ready." }));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const check = () => setExpired(Date.now() > quote.expiresAt);
    check();
    const i = setInterval(check, 15_000);
    return () => clearInterval(i);
  }, [quote.expiresAt]);

  const setT = (i: number, patch: Partial<Traveler>) => setTravelers((ts) => ts.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const fillDemo = () => {
    const names = [["Ada", "Nordmann"], ["Kari", "Nordmann"], ["Ola", "Nordmann"], ["Emma", "Hansen"], ["Jonas", "Hansen"], ["Sofie", "Berg"], ["Lars", "Berg"], ["Nora", "Lie"], ["Erik", "Lie"]];
    setTravelers((ts) => ts.map((_, i) => ({ firstName: names[i][0], lastName: names[i][1], dateOfBirth: `199${i}-0${(i % 9) + 1}-1${i}` })));
    setEmail("traveller@example.com");
    setPhone("+47 400 00 000");
  };

  const submit = async (accept?: number) => {
    setError(null);
    let token: string | undefined;
    if (method === "card") {
      const r = tokenize.current();
      if (r.error) return setError(r.error);
      token = r.token;
    } else {
      token = "tok_demo_visa"; // Simulated Vipps approval.
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": getIdempotencyKey(quote.id) },
        body: JSON.stringify({ quoteId: quote.id, travelers, contact: { email, phone }, paymentToken: token, acceptedTotal: accept ?? acceptedTotal }),
      });
      const body = await res.json();
      if (res.status === 409 && body.kind === "price_changed") {
        setPriceChange(body);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Booking failed.");
      add({ id: body.bookingId, slug: t.slug, title: `${t.destination} · ${t.category}`, startDate: quote.itinerary.startDate, endDate: quote.itinerary.endDate, createdAt: Date.now() });
      router.push(`/bookings/${body.bookingId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const total = acceptedTotal ?? quote.pricing.total;
  const included = quote.itinerary.components.filter((c) => c.included);
  const field = "h-12 w-full rounded-xl bg-paper px-4 text-[16px] ring-1 ring-line outline-none focus:ring-ink";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-4">
        <Link href={`/trips/${t.slug}/availability`} aria-label="Back to availability" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
          <IconBack size={20} />
        </Link>
        <h1 className="font-display text-[26px] font-semibold">Checkout</h1>
      </div>

      {expired && (
        <div className="mt-6 rounded-2xl bg-warn-soft p-4 text-warn" role="alert">
          Prices were held for 30 minutes and have expired. <Link href={`/trips/${t.slug}/availability`} className="font-medium underline underline-offset-4">Check availability again</Link>.
        </div>
      )}

      <section className="mt-6 flex gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
        <TripImage scene={t.scene} photoUrl={t.photoUrl} alt={t.destination} className="h-20 w-20 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">{t.destination}</p>
          <p className="text-[15px] text-ink-soft">{t.category}</p>
          <p className="mt-1 text-sm text-ink-mute">
            {fmtRange(quote.itinerary.startDate, quote.itinerary.endDate)} · {plural(quote.itinerary.totalNights, "night")} · {plural(n, "traveller")}
          </p>
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Section title="Travellers" aside={<button type="button" onClick={fillDemo} className="text-sm text-ink-soft underline underline-offset-4" data-testid="fill-demo">Fill demo details</button>}>
          <p className="-mt-2 mb-4 text-sm text-ink-soft">Names exactly as in passports. Airlines and hotels receive these details.</p>
          <div className="space-y-5">
            {travelers.map((tr, i) => (
              <fieldset key={i} className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Traveller {i + 1}{i === 0 ? " · lead" : ""}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input className={field} placeholder="First name" aria-label={`Traveller ${i + 1} first name`} autoComplete={i === 0 ? "given-name" : "off"} value={tr.firstName} onChange={(e) => setT(i, { firstName: e.target.value })} />
                  <input className={field} placeholder="Last name" aria-label={`Traveller ${i + 1} last name`} autoComplete={i === 0 ? "family-name" : "off"} value={tr.lastName} onChange={(e) => setT(i, { lastName: e.target.value })} />
                </div>
                <label className="block">
                  <span className="sr-only">Traveller {i + 1} date of birth</span>
                  <input type="date" className={field} value={tr.dateOfBirth} onChange={(e) => setT(i, { dateOfBirth: e.target.value })} aria-label={`Traveller ${i + 1} date of birth`} />
                </label>
              </fieldset>
            ))}
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Contact</legend>
              <input className={field} type="email" placeholder="Email" autoComplete="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={field} type="tel" placeholder="Mobile number" autoComplete="tel" aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </fieldset>
          </div>
        </Section>

        <Section title={`What you're booking (${included.length})`}>
          <ul className="divide-y divide-line rounded-2xl bg-paper ring-1 ring-line">
            {included.map((c) => {
              const r = quote.results.find((x) => x.componentId === c.id)!;
              return (
                <li key={c.id} className="flex gap-3 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-ink-soft">{componentIcon(c, 16)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium">{c.title}</p>
                      <p className="shrink-0 tabular-nums">{nok(r.offer!.price.total)}</p>
                    </div>
                    <p className="text-[14px] text-ink-soft">{componentSubtitle(c, r)}</p>
                    <p className="mt-1 text-[13px] text-ink-mute">{r.offer!.cancellation.summary} · {r.offer!.supplier}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13px] text-ink-mute">
            Each supplier confirms its part separately. Your trip is only marked confirmed once every part is confirmed; if any part fails, you choose a replacement or cancel and your payment is released.
          </p>
        </Section>

        <Section title="Price">
          <PriceBreakdown pricing={acceptedTotal ? { ...quote.pricing, total: acceptedTotal, perPerson: Math.round(acceptedTotal / n) } : quote.pricing} travelers={n} />
        </Section>

        <Section title="Payment">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-sand p-1" role="radiogroup" aria-label="Payment method">
            {(["card", "vipps"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={`h-9 rounded-full text-sm transition ${method === m ? "bg-paper font-medium shadow-float" : "text-ink-soft"}`}
              >
                {m === "card" ? "Card" : "Vipps (simulated)"}
              </button>
            ))}
          </div>
          {method === "card" ? (
            <HostedCardField register={(fn) => (tokenize.current = fn)} />
          ) : (
            <p className="rounded-xl bg-paper p-4 text-[15px] text-ink-soft ring-1 ring-line">In production you&apos;d approve the payment in the Vipps app. In demo mode it is approved automatically.</p>
          )}
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-[14px] text-ink-soft">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" data-testid="accept-terms" />
            <span>
              I accept the cancellation conditions above. I understand this is a <strong className="font-medium text-ink">demo</strong>: no reservation is made and no money is charged.
            </span>
          </label>
          <p className="mt-3 text-[13px] text-ink-mute">
            We authorise your payment first and only capture it after every supplier has confirmed.
          </p>
        </Section>

        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-bad-soft p-4 text-[15px] text-bad" role="alert" data-testid="checkout-error">
            <IconAlert size={18} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <StickyBar>
          <div className="mr-auto">
            <p className="text-[13px] text-ink-mute">Total</p>
            <p className="font-semibold tabular-nums">{nok(total)}</p>
          </div>
          <Button type="submit" disabled={!accepted || submitting || expired} data-testid="pay">
            {submitting ? "Securing your trip…" : `Pay ${nok(total)}`}
          </Button>
        </StickyBar>
      </form>

      <Sheet
        open={!!priceChange}
        onClose={() => setPriceChange(null)}
        title="The price has changed"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => router.push(`/trips/${t.slug}/availability`)}>
              Review trip
            </Button>
            <Button
              className="flex-1"
              data-testid="accept-price"
              onClick={() => {
                const nt = priceChange!.newTotal;
                setAcceptedTotal(nt);
                setPriceChange(null);
                void submit(nt);
              }}
            >
              Accept & pay
            </Button>
          </div>
        }
      >
        {priceChange && (
          <>
            <p className="text-[15px] text-ink-soft">
              Suppliers re-priced part of your trip after your search. Nothing has been charged. Accept the new total or go back and review.
            </p>
            <ul className="mt-4 space-y-2 text-[15px]">
              {priceChange.changes.map((c) => (
                <li key={c.componentId} className="flex justify-between gap-3">
                  <span>{c.title}</span>
                  <span className="tabular-nums">
                    {nok(c.oldTotal)} → <strong>{nok(c.newTotal)}</strong>
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
                <span>New total</span>
                <span className="tabular-nums">
                  {nok(priceChange.newTotal)} ({signedNok(priceChange.newTotal - priceChange.oldTotal)})
                </span>
              </li>
            </ul>
          </>
        )}
      </Sheet>
    </div>
  );
}
