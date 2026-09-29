"use client";

import { useState, useTransition } from "react";
import { updateStudySessionDetails, setStudySessionVisibility, setStudySessionArchived, deleteStudySession } from "./actions";
import { formatMinutes } from "@/lib/study";
import { todayISO, shiftISO, weekdayShortDayMonth } from "@/lib/dates";
import { ClockIcon, MoreVerticalIcon, PencilIcon, ArchiveIcon, EyeIcon, EyeOffIcon, TrashIcon } from "@/components/Icons";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import type { ActivityVisibility } from "@/generated/prisma/enums";

type Subject = { id: string; name: string; color: string };

export type HistorySession = {
  id: string;
  subjectId: string;
  dateISO: string;
  durationMinutes: number | null;
  note: string | null;
  visibility: ActivityVisibility;
  archived: boolean;
};

function dayLabel(dateISO: string): string {
  const today = todayISO();
  if (dateISO === today) return "Today";
  if (dateISO === shiftISO(today, -1)) return "Yesterday";
  return weekdayShortDayMonth(dateISO);
}

function SessionCardMenu({
  sessionId,
  visibility,
  archived,
  onEdit,
}: {
  sessionId: string;
  visibility: ActivityVisibility;
  archived: boolean;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        className="rounded-lg p-1.5 -m-1 text-ink-muted hover:text-ink"
      >
        <MoreVerticalIcon className="h-4.5 w-4.5" />
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-line/50"
            >
              <PencilIcon className="h-4 w-4 text-ink-muted" />
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                startTransition(() => setStudySessionVisibility(sessionId, visibility === "FRIENDS" ? "PRIVATE" : "FRIENDS"));
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-line/50 disabled:opacity-50"
            >
              {visibility === "FRIENDS" ? (
                <EyeOffIcon className="h-4 w-4 text-ink-muted" />
              ) : (
                <EyeIcon className="h-4 w-4 text-ink-muted" />
              )}
              {visibility === "FRIENDS" ? "Keep to myself" : "Share with friends"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                startTransition(() => setStudySessionArchived(sessionId, !archived));
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-line/50 disabled:opacity-50"
            >
              <ArchiveIcon className="h-4 w-4 text-ink-muted" />
              {archived ? "Unarchive" : "Archive"}
            </button>
            <div className="my-1 border-t border-line" />
            <ConfirmButton
              triggerClassName="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-accent hover:bg-accent-soft disabled:opacity-50"
              title="Delete this session?"
              message="This can't be undone."
              confirmLabel="Delete"
              onConfirm={() => deleteStudySession(sessionId)}
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </ConfirmButton>
          </div>
        </>
      )}
    </div>
  );
}

function SessionLogCard({ session, subjects }: { session: HistorySession; subjects: Subject[] }) {
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  const subject = subjects.find((s) => s.id === session.subjectId);

  return (
    <li className="p-4 text-sm">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 h-2 w-2 shrink-0 translate-y-1.5 rounded-full"
          style={{ backgroundColor: subject?.color ?? "#999" }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium text-ink">{subject?.name ?? "Unknown subject"}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              {session.visibility === "PRIVATE" && (
                <span title="Only visible to you">
                  <EyeOffIcon className="h-3.5 w-3.5 text-ink-muted" />
                </span>
              )}
              {session.archived && (
                <span className="rounded-full bg-line px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">Archived</span>
              )}
              <p className="text-xs text-ink-muted">{dayLabel(session.dateISO)}</p>
            </div>
          </div>
          <p className="mt-0.5 text-ink-muted">{formatMinutes(session.durationMinutes ?? 0)}</p>

          {!editing && session.note && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{session.note}</p>}

          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startSaving(async () => {
                  await updateStudySessionDetails(session.id, formData);
                  setEditing(false);
                });
              }}
              className="mt-3 space-y-2.5 border-t border-line pt-3"
            >
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Subject</label>
                <Select
                  name="subjectId"
                  defaultValue={session.subjectId}
                  className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Notes</label>
                <textarea
                  name="note"
                  defaultValue={session.note ?? ""}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Date</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={session.dateISO}
                    max={todayISO()}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Minutes</label>
                  <input
                    name="durationMinutes"
                    type="number"
                    min="1"
                    defaultValue={session.durationMinutes ?? ""}
                    className="w-20 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-study px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        <SessionCardMenu
          sessionId={session.id}
          visibility={session.visibility}
          archived={session.archived}
          onEdit={() => setEditing(true)}
        />
      </div>
    </li>
  );
}

export function StudySessionLog({ history, subjects }: { history: HistorySession[]; subjects: Subject[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-ink-muted">Log</h2>
      {history.length > 0 ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {history.map((session) => (
            <SessionLogCard key={session.id} session={session} subjects={subjects} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={ClockIcon} iconClassName="bg-study-soft text-study" message="No study sessions logged yet." />
      )}
    </div>
  );
}
