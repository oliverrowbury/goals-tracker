"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { addComment, deleteComment, type ActivityKind, type CommentDTO } from "./actions";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function CommentSection({
  kind,
  activityId,
  currentUserId,
  postOwnerId,
  initialComments,
}: {
  kind: ActivityKind;
  activityId: string;
  currentUserId: string;
  postOwnerId: string;
  initialComments: CommentDTO[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: CommentDTO = {
      id: optimisticId,
      authorId: currentUserId,
      authorName: "You",
      authorUsername: "",
      authorAvatarUrl: null,
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setBody("");

    const fd = new FormData();
    fd.set("body", trimmed);
    startTransition(async () => {
      const result = await addComment(kind, activityId, fd);
      if (result.error) {
        setError(result.error);
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      }
      // The real row (with its real id and author info) arrives via the
      // page's own revalidation — no need to reconcile by hand here.
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comments"}
      </p>

      {comments.length > 0 && (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => {
            const mine = c.authorId === currentUserId;
            const canDelete = mine || postOwnerId === currentUserId;
            const optimistic = c.id.startsWith("optimistic-");
            return (
              <li key={c.id} className={`flex items-start gap-2.5 ${optimistic ? "opacity-60" : ""}`}>
                <Avatar name={c.authorName} avatarUrl={c.authorAvatarUrl} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{c.authorName}</span> <span className="whitespace-pre-wrap break-words">{c.body}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                    <span>{timeLabel(c.createdAt)}</span>
                    {canDelete && !optimistic && (
                      <button
                        type="button"
                        onClick={() => startTransition(() => deleteComment(c.id))}
                        className="hover:text-accent"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder="Add a comment…"
          className="flex-1 rounded-full border border-line bg-paper px-3.5 py-2 text-sm focus:border-calm focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="rounded-full bg-calm px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Post
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-accent-strong">{error}</p>}
    </div>
  );
}
