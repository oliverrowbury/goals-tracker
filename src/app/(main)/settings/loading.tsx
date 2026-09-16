import { HeaderSkeleton, CardSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <CardSkeleton className="h-40" />
      <CardSkeleton className="h-56" />
      <CardSkeleton className="h-32" />
    </div>
  );
}
