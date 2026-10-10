import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <Link href="/" className="mt-6 inline-block font-medium underline underline-offset-4">Back to Discover</Link>
    </div>
  );
}
