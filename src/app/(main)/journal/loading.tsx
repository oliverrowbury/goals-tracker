import { HeaderSkeleton, CardSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <CardSkeleton className="h-28" />
      <CardSkeleton className="h-64" />
    </div>
  );
}
