"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyIcon, TrashIcon } from "@/components/Icons";
import { sendMessage, deleteMessage, setTyping, getNewMessages, type MessageDTO } from "./actions";

const POLL_MS = 2500;
const isOptimistic = (id: string) => id.startsWith("optimistic-");
// Consecutive messages from the same person within this window are grouped
// into one visual cluster (no repeated avatar/gap) — the same "burst of
// texts" convention iMessage/WhatsApp use, rather than every single message
// getting its own fully-spaced bubble regardless of how it was actually sent.
const GROUP_WINDOW_MS = 3 * 60_000;
// How long after the last keystroke to tell the other side "not typing
// anymore" — matches TYPING_STALE_MS server-side, which is what actually
// expires a stuck flag if this client-side clear never fires (tab closed
// mid-message).
const TYPING_STOP_MS = 3000;
// Re-sending the same "I'm typing" signal on literally every keystroke
// would be one write per character — throttled to roughly this often
// instead, while still typing.
const TYPING_RESEND_MS = 2000;
const LONG_PRESS_MS = 450;

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

// Touch long-press (hold to open the menu, like iMessage) plus a desktop
// right-click as the equivalent — one gesture, two ways to trigger it,
// rather than needing a separate always-visible "..." button per bubble.
function useLongPress(onTrigger: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onTouchStart: () => {
      timer.current = setTimeout(onTrigger, LONG_PRESS_MS);
    },
    onTouchEnd: clear,
    onTouchMove: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onTrigger();
    },
  };
}

type Row =
  | { kind: "date"; key: string; label: string }
  | { kind: "message"; key: string; message: MessageDTO; mine: boolean; showAvatar: boolean; showTail: boolean; isLastMine: boolean };

function buildRows(messages: MessageDTO[], currentUserId: string): Row[] {
  const rows: Row[] = [];
  let lastDateKey = "";
  const lastMineIndex = messages.map((m) => m.senderId === currentUserId).lastIndexOf(true);
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
    rows.push({ kind: "message", key: m.id, message: m, mine, showAvatar: !mine && isLastOfRun, showTail: isLastOfRun, isLastMine: mine && i === lastMineIndex });
  }
  return rows;
}

// "Sending…" while the optimistic bubble hasn't been confirmed yet, then
// "Delivered" once it's a real saved row, then "Seen" once the other
// person's read it — only ever shown under your own most recent message,
// same as iMessage/WhatsApp (every bubble carrying its own status would be
// far too noisy for a whole thread).
function StatusLabel({ optimistic, readAt }: { optimistic: boolean; readAt: string | null }) {
  const text = optimistic ? "Sending…" : readAt ? "Seen" : "Delivered";
  return <p className="mt-1 text-right text-[11px] text-ink-muted">{text}</p>;
}

function TypingBubble({ otherName, otherAvatarUrl }: { otherName: string; otherAvatarUrl: string | null }) {
  return (
    <div className="mb-0.5 flex items-end gap-2 justify-start animate-[fade-up_0.22s_ease-out_both]">
      <div className="w-6 shrink-0">
        <Avatar name={otherName} avatarUrl={otherAvatarUrl} size={24} />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-paper px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ink-muted [animation:typing-bounce_1.1s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// One bubble, its hover timestamp, and its long-press/right-click menu —
// pulled out of the row-building loop below because useLongPress calls
// useRef internally: a hook can't be called from inside a .map(), only
// from a component's own top level, and this is what makes each bubble
// its own component instance so that's allowed.
function MessageBubble({
  message: m,
  mine,
  showAvatar,
  showTail,
  otherName,
  otherAvatarUrl,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onCopy,
  onDelete,
}: {
  message: MessageDTO;
  mine: boolean;
  showAvatar: boolean;
  showTail: boolean;
  otherName: string;
  otherAvatarUrl: string | null;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const optimistic = isOptimistic(m.id);
  const longPress = useLongPress(onOpenMenu);

  return (
    // relative z-50 only while its own menu is open — otherwise the menu
    // (absolutely positioned, scoped to this row's own stacking context)
    // gets painted UNDER whichever row happens to come after it in the
    // list, since z-index on the dropdown itself only wins against
    // siblings within the SAME stacking context, not unrelated rows
    // further down the thread that establish their own.
    <div
      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${showTail ? "mb-2.5" : "mb-0.5"} animate-[fade-up_0.22s_ease-out_both] ${menuOpen ? "relative z-50" : ""}`}
    >
      {!mine && <div className="w-6 shrink-0">{showAvatar && <Avatar name={otherName} avatarUrl={otherAvatarUrl} size={24} />}</div>}
      <div className={`group relative max-w-[75%] ${mine ? "order-1" : ""}`}>
        <div
          {...longPress}
          className={`select-none px-3.5 py-2 text-[15px] leading-snug ${optimistic ? "opacity-60" : "cursor-pointer"} ${
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

        {menuOpen && (
          <>
            <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={onCloseMenu} />
            <div
              className={`absolute top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg ${
                mine ? "right-0" : "left-0"
              }`}
            >
              <button
                type="button"
                onClick={() => onCopy(m.body)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-line/50"
              >
                <CopyIcon className="h-4 w-4 text-ink-muted" />
                Copy
              </button>
              {mine && !optimistic && (
                <ConfirmButton
                  triggerClassName="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-accent hover:bg-accent-soft"
                  title="Delete this message?"
                  message="This deletes it for both of you — it can't be undone."
                  confirmLabel="Delete"
                  onConfirm={() => onDelete(m.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </ConfirmButton>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
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
  const [otherTyping, setOtherTyping] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useAutoGrow(body);
  // Mirrors `messages` for the polling loop and send handler, both of which
  // read the latest value from inside a setInterval/async callback where a
  // captured `messages` from render time would otherwise go stale.
  const messagesRef = useRef(messages);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAt = useRef(0);
  const isTypingRef = useRef(false);

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
  // backgrounded tab doesn't keep hitting the server every couple seconds
  // for nothing. Also carries the typing bubble and read-receipt refresh —
  // see getNewMessages itself for why those ride along on this same call.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lastReal = [...messagesRef.current].reverse().find((m) => !isOptimistic(m.id));
        const result = await getNewMessages(otherUserId, lastReal?.id ?? null);
        if (result.messages.length > 0) mergeFresh(result.messages);
        setOtherTyping(result.otherTyping);
        if (result.myLastMessage) {
          const { id, readAt } = result.myLastMessage;
          setMessages((prev) => (prev.some((m) => m.id === id && m.readAt !== readAt) ? prev.map((m) => (m.id === id ? { ...m, readAt } : m)) : prev));
        }
      } catch (err) {
        // A failed poll shouldn't spam the console every tick or take the
        // thread down — initialMessages already rendered, and the next
        // tick just tries again.
        console.error("Failed to poll for new messages:", err);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [otherUserId]);

  // Fire-and-forget by design (nothing in the UI waits on this succeeding)
  // — .catch just keeps a network blip from surfacing as an unhandled
  // rejection in the console.
  function fireTyping(typing: boolean) {
    setTyping(otherUserId, typing).catch(() => {});
  }

  // Clears the typing flag server-side if this tab/thread goes away while
  // it was still set — otherwise the other person would see a stuck typing
  // bubble until TYPING_STALE_MS expires it server-side anyway, but no
  // reason to wait for that when unmounting already tells us it's over.
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        fireTyping(false);
      }
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    };
    // fireTyping is intentionally excluded — it's a new function every
    // render, and this cleanup only needs to run on unmount/otherUserId
    // change, not chase a reference that's never actually stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  function handleBodyChange(value: string) {
    setBody(value);
    if (!value.trim()) return;

    const now = Date.now();
    if (now - lastTypingSentAt.current > TYPING_RESEND_MS) {
      lastTypingSentAt.current = now;
      isTypingRef.current = true;
      fireTyping(true);
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      lastTypingSentAt.current = 0;
      fireTyping(false);
    }, TYPING_STOP_MS);
  }

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    setBody("");

    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    isTypingRef.current = false;
    lastTypingSentAt.current = 0;

    const lastReal = [...messagesRef.current].reverse().find((m) => !isOptimistic(m.id));
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, senderId: currentUserId, body: trimmed, createdAt: new Date().toISOString(), readAt: null },
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
        mergeFresh(fresh.messages);
      } catch (err) {
        console.error("Failed to send message:", err);
        setError("Something went wrong sending that — try again.");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    });
  }

  function handleDelete(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    startTransition(async () => {
      await deleteMessage(messageId);
    });
  }

  function handleCopy(text: string) {
    setOpenMenuId(null);
    navigator.clipboard?.writeText(text).catch(() => {
      // Clipboard access denied — nothing worth building a fallback for.
    });
  }

  const rows = buildRows(messages, currentUserId);

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm sm:h-[75vh]">
      <div className="flex-1 space-y-0.5 overflow-y-auto p-4">
        {messages.length === 0 && !otherTyping && (
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
          const { message: m, mine, showAvatar, showTail, isLastMine } = row;
          return (
            <div key={row.key}>
              <MessageBubble
                message={m}
                mine={mine}
                showAvatar={showAvatar}
                showTail={showTail}
                otherName={otherName}
                otherAvatarUrl={otherAvatarUrl}
                menuOpen={openMenuId === m.id}
                onOpenMenu={() => setOpenMenuId(m.id)}
                onCloseMenu={() => setOpenMenuId(null)}
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
              {isLastMine && <StatusLabel optimistic={isOptimistic(m.id)} readAt={m.readAt} />}
            </div>
          );
        })}
        {otherTyping && <TypingBubble otherName={otherName} otherAvatarUrl={otherAvatarUrl} />}
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
            onChange={(e) => handleBodyChange(e.target.value)}
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
