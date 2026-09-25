"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { sendMessage, getNewMessages, type MessageDTO } from "./actions";

const POLL_MS = 4000;
const isOptimistic = (id: string) => id.startsWith("optimistic-");
// Consecutive messages from the same person within this window are grouped
// into one visual cluster (no repeated avatar/gap) — the same "burst of
// texts" convention iMessage/WhatsApp use, rather than every single message
// getting its own fully-spaced bubble regardless of how it was actually sent.
const GROUP_WINDOW_MS = 3 * 60_000;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

// Auto-growing textarea — a single row that expands with content instead of
// a fixed multi-row box, the standard chat-input feel (iMessage/WhatsApp),
// capped so a long paste doesn't take over the screen.
function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);
  return ref;
}

type Row =
  | { kind: "date"; key: string; label: string }
  | { kind: "message"; key: string; message: MessageDTO; mine: boolean; showAvatar: boolean; showTail: boolean };

function buildRows(messages: MessageDTO[], currentUserId: string): Row[] {
  const rows: Row[] = [];
  let lastDateKey = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const dKey = new Date(m.createdAt).toDateString();
    if (dKey !== lastDateKey) {
      rows.push({ kind: "date", key: `date-${dKey}`, label: dateLabel(m.createdAt) });
      lastDateKey = dKey;
    }
    const next = messages[i + 1];
    const mine = m.senderId === currentUserId;
    // "Tail" (the little rounded corner pointing at the sender) and the
    // avatar both only render on the last bubble of a consecutive run from
    // the same person — a lone message is its own run of one.
    const isLastOfRun =
      !next || next.senderId !== m.senderId || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > GROUP_WINDOW_MS;
    rows.push({ kind: "message", key: m.id, message: m, mine, showAvatar: !mine && isLastOfRun, showTail: isLastOfRun });
  }
  return rows;
}

export function MessageThread({
  currentUserId,
  otherUserId,
  otherName,
  otherAvatarUrl,
  initialMessages,
}: {
  currentUserId: string;
  otherUserId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  initialMessages: MessageDTO[];
}) {
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useAutoGrow(body);
  // Mirrors `messages` for the polling loop and send handler, both of which
  // read the latest value from inside a setInterval/async callback where a
  // captured `messages` from render time would otherwise go stale.
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function mergeFresh(fresh: MessageDTO[]) {
    setMessages((prev) => {
      const withoutOptimistic = prev.filter((m) => !isOptimistic(m.id));
      const existingIds = new Set(withoutOptimistic.map((m) => m.id));
      const merged = [...withoutOptimistic, ...fresh.filter((m) => !existingIds.has(m.id))];
      merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return merged;
    });
  }

  // Only polling loop in this app — see actions.ts's getNewMessages comment
  // on why a chat view is a deliberate, narrow exception to the rest of the
  // app's request/response-only philosophy. Paused off-screen so a
  // backgrounded tab doesn't keep hitting the server every 4s for nothing.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lastReal = [...messagesRef.current].reverse().find((m) => !isOptimistic(m.id));
        const fresh = await getNewMessages(otherUserId, lastReal?.id ?? null);
        if (fresh.length > 0) mergeFresh(fresh);
      } catch (err) {
        // A failed poll shouldn't spam the console every 4s or take the
        // thread down — initialMessages already rendered, and the next
        // tick just tries again.
        console.error("Failed to poll for new messages:", err);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [otherUserId]);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    setBody("");

    const lastReal = [...messagesRef.current].reverse().find((m) => !isOptimistic(m.id));
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, senderId: currentUserId, body: trimmed, createdAt: new Date().toISOString() },
    ]);

    const fd = new FormData();
    fd.set("body", trimmed);
    startTransition(async () => {
      // A thrown error here (network blip, an unhandled server-side
      // exception) would otherwise vanish — a transition's async callback
      // isn't caught by the nearest error boundary the way a render throw
      // is, so without this the optimistic bubble would just sit there
      // forever with no explanation.
      try {
        const result = await sendMessage(otherUserId, fd);
        if (result?.error) {
          setError(result.error);
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          return;
        }
        // Replace the optimistic placeholder with the authoritative row (and
        // pick up anything the other person sent in the meantime too).
        const fresh = await getNewMessages(otherUserId, lastReal?.id ?? null);
        mergeFresh(fresh);
      } catch (err) {
        console.error("Failed to send message:", err);
        setError("Something went wrong sending that — try again.");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    });
  }

  const rows = buildRows(messages, currentUserId);

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm sm:h-[75vh]">
      <div className="flex-1 space-y-0.5 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
            <Avatar name={otherName} avatarUrl={otherAvatarUrl} size={56} />
            <div>
              <p className="font-medium text-ink">{otherName}</p>
              <p className="mt-0.5 text-sm text-ink-muted">Say hi to start the conversation.</p>
            </div>
          </div>
        )}
        {rows.map((row) => {
          if (row.kind === "date") {
            return (
              <div key={row.key} className="flex justify-center py-3 first:pt-0">
                <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-muted">{row.label}</span>
              </div>
            );
          }
          const { message: m, mine, showAvatar, showTail } = row;
          const optimistic = isOptimistic(m.id);
          return (
            <div
              key={row.key}
              className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${showTail ? "mb-2.5" : "mb-0.5"} animate-[fade-up_0.22s_ease-out_both]`}
            >
              {!mine && (
                <div className="w-6 shrink-0">{showAvatar && <Avatar name={otherName} avatarUrl={otherAvatarUrl} size={24} />}</div>
              )}
              <div className={`group relative max-w-[75%] ${mine ? "order-1" : ""}`}>
                <div
                  className={`px-3.5 py-2 text-[15px] leading-snug ${optimistic ? "opacity-60" : ""} ${
                    mine
                      ? `bg-calm text-white ${showTail ? "rounded-2xl rounded-br-md" : "rounded-2xl"}`
                      : `bg-paper text-ink ${showTail ? "rounded-2xl rounded-bl-md" : "rounded-2xl"}`
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <p
                  className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 whitespace-nowrap text-[10px] text-ink-muted group-hover:block ${
                    mine ? "right-full mr-2" : "left-full ml-2"
                  }`}
                >
                  {timeLabel(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-line bg-card p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Message…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm focus:border-calm focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-calm text-white transition-transform hover:opacity-90 active:scale-90 disabled:opacity-40 disabled:active:scale-100"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] -translate-x-px translate-y-px rotate-45">
              <path d="M4 12L20 4L12 20L10 13L4 12Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-accent-strong">{error}</p>}
      </form>
    </div>
  );
}
