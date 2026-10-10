import { BookingStatus } from "@/components/BookingStatus";

export default function BookingPage({ params }: { params: { id: string } }) {
  return <BookingStatus id={params.id} />;
}
