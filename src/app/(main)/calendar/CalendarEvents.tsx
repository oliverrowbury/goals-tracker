"use client";

import { useEffect, useRef, useState, useActionState, useTransition } from "react";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "./actions";

export type CalendarEventItem = { id: string; title: string; time: string | null; notes: string | null };

const fieldClass = "rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-accent focus:outline-none";

function EventFields({ defaultValues }: { defaultValues?: { title: string; time: string | null; notes: string | null } }) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input
          name="title"
          required
          defaultValue={defaultValues?.title}
          placeholder="Event title"
          className={`min-w-[10rem] flex-1 ${fieldClass}`}
        />
        <input name="time" type="time" defaultValue={defaultValues?.time ?? ""} className={fieldClass} />
      </div>
      <textarea
        name="notes"
        defaultValue={defaultValues?.notes ?? ""}
        placeholder="Notes (optional)"
        rows={2}
        className={`mt-2 w-full ${fieldClass}`}
      />
    </>
  );
}

function AddEventForm({ dateISO, onDone }: { dateISO: string; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(createCalendarEvent, null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) onDone();
    wasPending.current = isPending;
  }, [isPending, state, onDone]);

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-card p-3.5">
      <input type="hidden" name="date" value={dateISO} />
      <EventFields />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add event"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-ink-muted hover:text-ink">
          Cancel
        </button>
        {state?.error && <p className="text-xs text-workout">{state.error}</p>}
      </div>
    </form>
  );
}

function EditEventForm({ dateISO, event, onDone }: { dateISO: string; event: CalendarEventItem; onDone: () => void }) {
  const boundUpdate = updateCalendarEvent.bind(null, event.id);
  const [state, formAction, isPending] = useActionState(boundUpdate, null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) onDone();
    wasPending.current = isPending;
  }, [isPending, state, onDone]);

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="date" value={dateISO} />
      <EventFields defaultValues={event} />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-ink-muted hover:text-ink">
          Cancel
        </button>
        {state?.error && <p className="text-xs text-workout">{state.error}</p>}
      </div>
    </form>
  );
}

export function CalendarEvents({ dateISO, events }: { dateISO: string; events: CalendarEventItem[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-muted">Events</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-medium text-accent hover:underline">
            + Add event
          </button>
        )}
      </div>

      {events.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-2xl border border-line bg-card">
          {events.map((event) => (
            <li key={event.id} className="px-3.5 py-2.5 text-sm text-ink">
              {editingId === event.id ? (
                <EditEventForm dateISO={dateISO} event={event} onDone={() => setEditingId(null)} />
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-ink-muted" />
                  <div className="flex-1">
                    <span>{event.title}</span>
                    {event.time && <span className="ml-1.5 text-ink-muted">· {event.time}</span>}
                    {event.notes && <p className="mt-0.5 text-xs text-ink-muted">{event.notes}</p>}
                  </div>
                  <button type="button" onClick={() => setEditingId(event.id)} className="text-xs text-ink-muted hover:text-accent">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteCalendarEvent(event.id, dateISO))}
                    className="text-xs text-ink-muted hover:text-workout disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && <AddEventForm dateISO={dateISO} onDone={() => setAdding(false)} />}
    </div>
  );
}
