import { FOCUS_TAG_LABELS, type FocusTag } from "@/lib/constants";

export function FocusTagPills({ tags }: { tags: FocusTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-calm-soft px-2.5 py-0.5 text-xs font-medium text-calm">
          {FOCUS_TAG_LABELS[tag]}
        </span>
      ))}
    </div>
  );
}
