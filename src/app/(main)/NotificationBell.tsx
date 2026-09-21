"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BellIcon, HeartIcon, MessageIcon } from "@/components/Icons";
import { shortTimeAgo } from "@/lib/dates";
import { getNotifications, type FollowRequestNotification, type ActivityNotification } from "./actions";
import { acceptFollowRequest, removeFollow } from "./friends/actions";

// Instagram-style — a bell with a count badge that opens a dropdown of
// individual notifications rather than just the aggregate counts the
// Friends/Messages nav badges already show (those stay as they are; this
// is an additional, more detailed view of the same underlying events).
// Data is fetched lazily on open (see getNotifications), not on every page
// load, since most page loads never open it. Purely self-positioning
// (relative, for its own dropdown to anchor to) — where it sits on screen
// is the caller's job (see Sidebar's mobile top bar slot and layout.tsx's
// desktop toolbar row), deliberately not a `fixed` viewport overlay, which
// used to sit on top of whatever a page had in its own top-right corner
// (most pages' own "← back" link included).
export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState<{ followRequests: FollowRequestNotification[]; activity: ActivityNotification[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actedOn, setActedOn] = useState<Set<string>>(new Set());

  function handleOpen() {
    setOpen(true);
    setCount(0); // opening is what clears the badge — matches likesSeenAt's existing convention elsewhere
    startTransition(async () => {
      const result = await getNotifications();
      setLoaded(result);
    });
  }

  function handleAccept(followId: string) {
    setActedOn((prev) => new Set(prev).add(followId));
    startTransition(() => acceptFollowRequest(followId));
  }

  function handleDecline(followId: string) {
    setActedOn((prev) => new Set(prev).add(followId));
    startTransition(() => removeFollow(followId));
  }

  const pendingRequests = (loaded?.followRequests ?? []).filter((r) => !actedOn.has(r.followId));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink-muted shadow-sm hover:text-ink"
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-card p-2 shadow-lg">
            <p className="px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">Notifications</p>

            {!loaded && isPending && <p className="px-2.5 py-4 text-center text-sm text-ink-muted">Loading…</p>}

            {loaded && pendingRequests.length === 0 && loaded.activity.length === 0 && (
              <p className="px-2.5 py-4 text-center text-sm text-ink-muted">Nothing yet.</p>
            )}

            {pendingRequests.length > 0 && (
              <div className="mb-1">
                {pendingRequests.map((r) => (
                  <div key={r.followId} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-line/40">
                    <Link href={`/friends/add/${r.person.username}`} onClick={() => setOpen(false)} className="shrink-0">
                      <Avatar name={r.person.name} avatarUrl={r.person.avatarUrl} size={36} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/friends/add/${r.person.username}`} onClick={() => setOpen(false)} className="text-sm text-ink hover:underline">
                        <span className="font-medium">{r.person.name}</span> wants to follow you
                      </Link>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAccept(r.followId)}
                          className="rounded-full bg-calm px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDecline(r.followId)}
                          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {loaded && loaded.activity.length > 0 && (
              <div className={pendingRequests.length > 0 ? "border-t border-line pt-1" : ""}>
                {loaded.activity.map((item) => (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={`/friends/post/${item.activityKind}/${item.activityId}${item.kind === "comment" ? "#comments" : ""}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-line/40"
                  >
                    <Avatar name={item.person.name} avatarUrl={item.person.avatarUrl} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{item.person.name}</span>{" "}
                        {item.kind === "like" ? (
                          <>liked your {item.title}</>
                        ) : (
                          <>
                            commented on {item.title}: <span className="text-ink-muted">&ldquo;{item.body}&rdquo;</span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{shortTimeAgo(item.createdAt)}</p>
                    </div>
                    <span className="mt-0.5 shrink-0 text-ink-muted">
                      {item.kind === "like" ? <HeartIcon className="h-3.5 w-3.5" filled /> : <MessageIcon className="h-3.5 w-3.5" />}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
