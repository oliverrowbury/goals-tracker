"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { HeartIcon, MessageIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";
import { LikeButton } from "./LikeButton";
import { ReportButton } from "./ReportButton";
import { likeActivity, unlikeActivity, setActivityArchived, type ActivityKind } from "./actions";

const DOUBLE_TAP_WINDOW_MS = 300;

// The photo and the like button below it act on the same liked/count
// state (a double-tap on the photo has to move the heart-button count too),
// so both live in this one client component rather than each managing
// their own — see LikeButton's own comment for why it no longer does.
export function PostFooter({
  kind,
  activityId,
  photoUrl,
  detailHref,
  linkToDetail,
  initialLikeCount,
  initialLikedByMe,
  commentCount,
  isOwner,
  archived,
  ownerId,
}: {
  kind: ActivityKind;
  activityId: string;
  photoUrl?: string | null;
  detailHref: string;
  linkToDetail: boolean;
  initialLikeCount: number;
  initialLikedByMe: boolean;
  commentCount: number;
  isOwner: boolean;
  archived: boolean;
  ownerId: string;
}) {
  const [liked, setLiked] = useState(initialLikedByMe);
  const [count, setCount] = useState(initialLikeCount);
  const [burst, setBurst] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastTapRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function like() {
    if (liked) return;
    setLiked(true);
    setCount((c) => c + 1);
    startTransition(() => likeActivity(kind, activityId));
  }

  function toggle() {
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      startTransition(() => unlikeActivity(kind, activityId));
    } else {
      like();
    }
  }

  // Instagram's double-tap only ever likes, never unlikes — a second tap
  // on an already-liked photo just replays the heart burst. Only wired up
  // when the photo isn't itself a link to the detail page (the feed card's
  // photo already opens the post on a single tap — layering a "wait to see
  // if a second tap follows" delay on top of that would make every normal
  // tap-to-open feel laggy, so double-tap-to-like only lives on the detail
  // page's own photo, which isn't a navigation target).
  function handlePhotoTap() {
    if (linkToDetail) return;
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS;
    lastTapRef.current = now;
    if (!isDoubleTap) return;

    like();
    setBurst(false);
    // Force a re-mount of the burst element so a rapid-fire double-tap
    // (already mid-animation) restarts the animation instead of no-op'ing
    // because the class name never changed.
    requestAnimationFrame(() => setBurst(true));
    clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setBurst(false), 700);
  }

  const photo = photoUrl && (
    <div className={`relative select-none ${linkToDetail ? "" : "cursor-pointer"}`} onClick={handlePhotoTap}>
      {linkToDetail ? (
        <Link href={detailHref} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="aspect-square w-full object-cover" draggable={false} />
        </Link>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="aspect-square w-full object-cover" draggable={false} />
      )}
      {burst && (
        <HeartIcon
          filled
          className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg animate-[heart-burst_700ms_ease-out]"
        />
      )}
    </div>
  );

  return (
    <>
      {photo}

      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <LikeButton liked={liked} count={count} disabled={isPending} onToggle={toggle} />
        <Link
          href={`${linkToDetail ? detailHref : ""}#comments`}
          className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-calm hover:text-calm"
        >
          <MessageIcon className="h-4 w-4" />
          {commentCount > 0 && <span className="tabular-nums">{commentCount}</span>}
        </Link>

        {isOwner && (
          <form action={setActivityArchived.bind(null, kind, activityId, !archived)} className="ml-auto">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-accent"
              title={archived ? "Show this on your profile activity list again" : "Hide this from your profile activity list"}
            >
              {archived ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
              {archived ? "Unarchive" : "Archive"}
            </button>
          </form>
        )}
        {!isOwner && (
          <div className="ml-auto">
            <ReportButton targetType={kind === "workout" ? "WORKOUT" : "STUDY_SESSION"} targetUserId={ownerId} targetId={activityId} />
          </div>
        )}
      </div>
    </>
  );
}
