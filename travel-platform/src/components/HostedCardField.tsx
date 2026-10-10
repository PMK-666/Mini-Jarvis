"use client";
/**
 * SIMULATED hosted payment field.
 *
 * In production this is the payment provider's own iframe (e.g. Stripe Payment Element),
 * so card data goes straight to the provider and never touches Itinera's servers or state.
 * Here we imitate that contract: card details stay inside this component and only an
 * opaque token is handed to the checkout.
 */
import { useState } from "react";
import { IconShield } from "./icons";

export type Tokenize = () => { token?: string; error?: string };

function luhn(num: string) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return num.length >= 12 && sum % 10 === 0;
}

export function HostedCardField({ register }: { register: (fn: Tokenize) => void }) {
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  register(() => {
    const digits = number.replace(/\D/g, "");
    if (!luhn(digits)) return { error: "Check the card number." };
    const m = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { error: "Enter the expiry as MM/YY." };
    const expEnd = new Date(Date.UTC(2000 + Number(m[2]), Number(m[1]), 1));
    if (expEnd.getTime() < Date.now()) return { error: "This card has expired." };
    if (!/^\d{3,4}$/.test(cvc)) return { error: "Enter the 3-digit security code." };
    if (digits === "4000000000000002") return { token: "tok_demo_card_declined" };
    if (digits === "4000000000009995") return { token: "tok_demo_insufficient_funds" };
    return { token: "tok_demo_visa" };
  });

  const input = "h-12 w-full bg-transparent px-4 text-[16px] outline-none placeholder:text-ink-mute";
  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-paper ring-1 ring-line focus-within:ring-ink">
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="Card number"
          aria-label="Card number"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, "").slice(0, 23))}
          className={`${input} border-b border-line`}
          data-testid="card-number"
        />
        <div className="flex">
          <input
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            aria-label="Expiry date"
            value={exp}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            className={`${input} border-r border-line`}
            data-testid="card-exp"
          />
          <input
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC"
            aria-label="Security code"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={input}
            data-testid="card-cvc"
          />
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-mute">
        <IconShield size={14} /> Simulated hosted field — card details never leave this box. Test: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (declined).
      </p>
    </div>
  );
}
