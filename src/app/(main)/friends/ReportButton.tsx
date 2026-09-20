"use client";

import { useState, useTransition } from "react";
import { submitReport } from "./actions";

export function ReportButton({
  targetType,
  targetUserId,
  targetId = null,
  label = "Report",
  className = "text-xs font-medium text-ink-muted hover:text-accent",
}: {
  targetType: "USER" | "COMMENT" | "WORKOUT" | "STUDY_SESSION" | "MESSAGE";
  targetUserId: string;
  targetId?: string | null;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ error?: string; success?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result?.success) {
    return <p className="text-xs text-ink-muted">{result.success}</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        autoFocus
        placeholder="What's wrong with this?"
        className="w-full resize-none rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
      />
      {result?.error && <p className="mt-1 text-xs text-accent-strong">{result.error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await submitReport(targetType, targetUserId, targetId, reason);
              setResult(res);
            })
          }
          className="rounded-md bg-ink-solid px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Submit report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
