import Link from "next/link";
import { Checkout } from "@/components/Checkout";
import { getTrip } from "@/lib/data/trips";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function CheckoutPage({ params }: { params: { quoteId: string } }) {
  const quote = getStore().quotes.get(params.quoteId);
  const t = quote && getTrip(quote.slug);
  if (!quote || !t) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">This quote has expired</h1>
        <p className="mt-3 text-ink-soft">Quotes are held for 30 minutes (and in demo mode, until the server restarts). Check availability again for fresh prices.</p>
        <Link href="/" className="mt-6 inline-block font-medium underline underline-offset-4">Back to Discover</Link>
      </div>
    );
  }
  return <Checkout quote={quote} template={t} />;
}
