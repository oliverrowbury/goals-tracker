import { HeaderSkeleton, CardSkeleton, ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <CardSkeleton className="h-48" />
      <ListSkeleton rows={3} />
    </div>
  );
}
