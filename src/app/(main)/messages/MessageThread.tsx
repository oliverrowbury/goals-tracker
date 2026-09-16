"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage, getNewMessages, type MessageDTO } from "./actions";

const POLL_MS = 4000;
const isOptimistic = (id: string) => id.startsWith("optimistic-");

export function MessageThread({
  currentUserId,
  otherUserId,
  initialMessages,
}: {
  currentUserId: string;
  otherUserId: string;
  initialMessages: MessageDTO[];
}) {
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
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
      const lastReal = [...messagesRef.current].reverse().find((m) => !isOptimistic(m.id));
      const fresh = await getNewMessages(otherUserId, lastReal?.id ?? null);
      if (fresh.length > 0) mergeFresh(fresh);
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
    });
  }

  function timeLabel(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="flex h-[70vh] min-h-[400px] flex-col rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-ink-muted">Say hi to start the conversation.</p>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-calm text-white" : "bg-paper text-ink"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-ink-muted"}`}>{timeLabel(m.createdAt)}</p>
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
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
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
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-calm focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="rounded-lg bg-calm px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-accent-strong">{error}</p>}
      </form>
    </div>
  );
}
