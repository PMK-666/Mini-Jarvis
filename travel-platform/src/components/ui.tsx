"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import type { PriceSource, Provenance } from "@/lib/domain/types";
import { IconMinus, IconPlus, IconX } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/90 disabled:bg-ink/30",
  secondary: "bg-paper text-ink ring-1 ring-inset ring-line hover:bg-sand disabled:text-ink-mute",
  ghost: "text-ink hover:bg-sand disabled:text-ink-mute",
  danger: "bg-paper text-bad ring-1 ring-inset ring-bad/30 hover:bg-bad-soft",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed";

const sizes = { md: "h-11 px-5 text-[15px]", lg: "h-[52px] px-6 text-base", sm: "h-9 px-4 text-sm" };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

const tone = {
  neutral: "bg-sand text-ink-soft",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ children, t = "neutral", className = "" }: { children: React.ReactNode; t?: keyof typeof tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${tone[t]} ${className}`}>
      {children}
    </span>
  );
}

const provenanceLabel: Record<Provenance, { text: string; t: keyof typeof tone }> = {
  booked: { text: "From the original trip", t: "neutral" },
  incomplete: { text: "Incomplete in original", t: "warn" },
  assumed: { text: "Assumed by Itinera", t: "neutral" },
  suggested: { text: "Suggested extra", t: "accent" },
};

export function ProvenanceBadge({ p }: { p: Provenance }) {
  const l = provenanceLabel[p];
  return <Badge t={l.t}>{l.text}</Badge>;
}

export function PriceSourceTag({ source }: { source: PriceSource }) {
  if (source === "live") return <Badge t="ok">Live quote</Badge>;
  if (source === "estimate") return <Badge t="warn">Estimate</Badge>;
  return <Badge>Illustrative</Badge>;
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-line transition hover:bg-sand disabled:opacity-30"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        <IconMinus size={16} />
      </button>
      <span className="w-6 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-line transition hover:bg-sand disabled:opacity-30"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
}

/** Bottom sheet on mobile, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-rise" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-[28px] bg-paper shadow-float outline-none animate-rise sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between px-6 pb-2 pt-4">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function Section({ title, children, aside, id }: { title: string; children: React.ReactNode; aside?: React.ReactNode; id?: string }) {
  return (
    <section className="py-8" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={id ? `${id}-h` : undefined} className="text-[22px] font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Fixed action bar at the bottom of the screen (mobile) / bottom of the content column (desktop). */
export function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-28" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </div>
      </div>
    </>
  );
}
