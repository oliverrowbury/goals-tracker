"use client";

import { useTransition, useState } from "react";
import { ClockIcon, TrashIcon } from "@/components/Icons";
import { formatMinutes } from "@/lib/study";
import { ShareButton } from "@/components/ShareButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useCountUp } from "@/lib/time";
import { setStudySessionVisibility, setStudySessionNote, deleteStudySession } from "./actions";
import { CaptionField } from "@/components/CaptionField";
import type { ActivityVisibility } from "@/generated/prisma/enums";

export type JustFinishedSession = {
  id: string;
  subjectName: string;
  durationMinutes: number;
};

function VisibilityPicker({ sessionId }: { sessionId: string }) {
  const [visibility, setVisibility] = useState<ActivityVisibility>("FRIENDS");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-paper p-1">
      {(["FRIENDS", "PRIVATE"] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={isPending}
          onClick={() => {
            setVisibility(v);
            startTransition(() => setStudySessionVisibility(sessionId, v));
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            visibility === v ? "bg-study text-white" : "text-ink-muted hover:text-study"
          }`}
        >
          {v === "FRIENDS" ? "Share with friends" : "Keep to myself"}
        </button>
      ))}
    </div>
  );
}

// The study-timer equivalent of WorkoutSummary — same "who sees this" +
// delete pattern, without photos/splits (those are workout-specific).
export function StudySummary({ session, onDone }: { session: JustFinishedSession; onDone: () => void }) {
  // Counts up from 0 rather than just appearing — same beat as
  // WorkoutSummary's hero number.
  const animatedMinutes = useCountUp(session.durationMinutes);

  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-sm sm:p-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-study-soft text-study">
        <ClockIcon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-medium text-ink-muted">Session complete</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">{session.subjectName}</h2>
      <p className="mt-4 font-serif text-5xl font-semibold tabular-nums text-ink">{formatMinutes(animatedMinutes)}</p>

      <div className="mt-5 border-t border-line pt-5 text-left">
        <CaptionField initialValue="" onSave={(value) => setStudySessionNote(session.id, value)} focusClassName="focus:border-study" />
      </div>

      <div className="mt-4">
        <VisibilityPicker sessionId={session.id} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <ShareButton
          accentVar="--study"
          fileName="study-session.png"
          shareTitle="My study session"
          shareText={`${session.subjectName}: ${formatMinutes(session.durationMinutes)} — via Proudly`}
          data={{
            eyebrow: "Study session",
            heading: session.subjectName,
            stats: [{ label: "Time", value: formatMinutes(session.durationMinutes) }],
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:border-study hover:text-study"
        />
        <button type="button" onClick={onDone} className="rounded-lg bg-ink-solid px-5 py-2 text-sm font-medium text-white hover:opacity-90">
          Done
        </button>
      </div>

      <ConfirmButton
        triggerClassName="mx-auto mt-4 flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:opacity-50"
        title="Delete this session?"
        message="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteStudySession(session.id);
          onDone();
        }}
      >
        <TrashIcon className="h-3.5 w-3.5" />
        Delete this session
      </ConfirmButton>
    </div>
  );
}
