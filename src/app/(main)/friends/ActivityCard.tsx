import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ActivityIcon, ClockIcon, MessageIcon, EyeOffIcon, EyeIcon, TrophyIcon } from "@/components/Icons";
import { todayISO, relativeLabel } from "@/lib/dates";
import { formatWeight, type ExerciseBreakdown, type Stat } from "@/lib/workout";
import { LikeButton } from "./LikeButton";
import { setActivityArchived, type ActivityKind } from "./actions";

export type ActivityCardItem = {
  id: string;
  kind: ActivityKind;
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  when: Date;
  title: string;
  note?: string | null;
  photoUrl?: string | null;
  stats: Stat[];
  exercises?: ExerciseBreakdown[];
  weightUnit?: "KG" | "LB";
  // A study post's own subject color (already used everywhere else the
  // subject shows up — the timer, the weekly chart) rather than one flat
  // teal for every subject, so Chemistry and French don't look identical
  // in the feed. Undefined for workouts, which use the fixed workout accent.
  subjectColor?: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  archived: boolean;
};

// The one card shape shared by the friend feed, a profile's own activity
// list, and the post detail page — same stats grid + exercise breakdown
// that used to only exist on the detail page (see ActivityCardItem for
// what each context needs to supply). `showOwner` drops the who-posted-
// this header when the surrounding page already establishes whose post it
// is (a profile's own activity list); `linkToDetail` false is for the
// detail page itself, which is already that destination.
export function ActivityCard({
  item,
  currentUserId,
  showOwner = true,
  linkToDetail = true,
  children,
}: {
  item: ActivityCardItem;
  currentUserId: string;
  showOwner?: boolean;
  linkToDetail?: boolean;
  children?: React.ReactNode;
}) {
  const badgeClass = item.subjectColor ? "text-white" : item.kind === "workout" ? "bg-workout-soft text-workout" : "bg-study-soft text-study";
  const badgeStyle = item.subjectColor ? { backgroundColor: item.subjectColor } : undefined;
  const spineClass = item.subjectColor ? "border-l-4" : item.kind === "workout" ? "border-l-4 border-l-workout" : "border-l-4 border-l-study";
  const spineStyle = item.subjectColor ? { borderLeftColor: item.subjectColor } : undefined;
  const detailHref = `/friends/post/${item.kind}/${item.id}`;
  const isOwner = item.ownerId === currentUserId;
  const hasPR = item.stats.some((s) => s.isPR) || (item.exercises?.some((ex) => ex.isPR) ?? false);

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-lg font-semibold text-ink">{item.title}</h3>
        {hasPR && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">
            <TrophyIcon className="h-3 w-3" />
            New PR
          </span>
        )}
      </div>
      {item.note && <p className="mt-1 text-sm text-ink">{item.note}</p>}

      <div
        className={`mt-3 grid gap-3 border-t border-line pt-3 text-sm ${
          item.stats.length === 1 ? "grid-cols-1" : item.stats.length === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {item.stats.map((s) => (
          <div key={s.label}>
            <p className="flex items-center gap-1 font-serif text-base font-semibold text-ink">
              {s.value}
              {s.isPR && <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-accent" />}
            </p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {item.exercises && item.exercises.length > 0 && (
        <div className="mt-3 space-y-2.5 border-t border-line pt-3">
          {item.exercises.map((ex) => (
            <div key={ex.exerciseId}>
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                {ex.name}
                {ex.isPR && <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {ex.sets.map((s, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    {formatWeight(s.weight, item.weightUnit ?? "KG")}×{s.reps}
                    {s.isWarmup && "w"}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-card shadow-sm ${spineClass}`} style={spineStyle}>
      <div className="p-4">
        {showOwner && (
          <div className="mb-3 flex items-center gap-3">
            <Link href={`/friends/add/${item.ownerUsername}`} className="shrink-0">
              <Avatar name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size={32} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/friends/add/${item.ownerUsername}`} className="text-sm font-medium text-ink hover:underline">
                {item.ownerName}
              </Link>
              <p className="text-xs text-ink-muted">
                @{item.ownerUsername} · {relativeLabel(item.when, todayISO())}
              </p>
            </div>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${badgeClass}`} style={badgeStyle}>
              {item.kind === "workout" ? <ActivityIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
            </span>
          </div>
        )}
        {!showOwner && (
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">{relativeLabel(item.when, todayISO())}</p>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${badgeClass}`} style={badgeStyle}>
              {item.kind === "workout" ? <ActivityIcon className="h-3.5 w-3.5" /> : <ClockIcon className="h-3.5 w-3.5" />}
            </span>
          </div>
        )}

        {linkToDetail ? (
          <Link href={detailHref} className="block hover:opacity-90">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>

      {item.photoUrl && (
        linkToDetail ? (
          <Link href={detailHref} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.photoUrl} alt="" className="aspect-square w-full object-cover" />
          </Link>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt="" className="aspect-square w-full object-cover" />
        )
      )}

      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <LikeButton kind={item.kind} activityId={item.id} count={item.likeCount} likedByMe={item.likedByMe} />
        <Link
          href={`${linkToDetail ? detailHref : ""}#comments`}
          className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-calm hover:text-calm"
        >
          <MessageIcon className="h-4 w-4" />
          {item.commentCount > 0 && <span className="tabular-nums">{item.commentCount}</span>}
        </Link>

        {isOwner && (
          <form action={setActivityArchived.bind(null, item.kind, item.id, !item.archived)} className="ml-auto">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-accent"
              title={item.archived ? "Show this on your profile activity list again" : "Hide this from your profile activity list"}
            >
              {item.archived ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
              {item.archived ? "Unarchive" : "Archive"}
            </button>
          </form>
        )}
      </div>

      {children && (
        <div id="comments" className="scroll-mt-6 px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
