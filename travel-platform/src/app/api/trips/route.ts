import { NextResponse } from "next/server";
import { listTrips } from "@/lib/data/trips";

export function GET() {
  return NextResponse.json(
    listTrips().map((t) => ({
      slug: t.slug,
      destination: t.destination,
      category: t.category,
      categories: t.categories,
      tags: t.tags,
      travelStyle: t.travelStyle,
      originalStartDate: t.originalStartDate,
      originalEndDate: t.originalEndDate,
      creator: t.creator,
    })),
  );
}
