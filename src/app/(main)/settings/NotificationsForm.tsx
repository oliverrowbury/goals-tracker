"use client";

import { useEffect, useState, useTransition } from "react";
import { updateReminder, savePushSubscription, removePushSubscription } from "./actions";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status = "unsupported" | "unsubscribed" | "subscribed" | "denied";

export function NotificationsForm({
  reminderEnabled,
  reminderTime,
}: {
  reminderEnabled: boolean;
  reminderTime: string | null;
}) {
  const [status, setStatus] = useState<Status>("unsubscribed");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    });
  }, []);

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      alert("Push notifications aren't configured yet — missing VAPID key.");
      return;
    }

    await navigator.serviceWorker.register("/sw.js");
    // register() can resolve before the worker is actually active — wait
    // for `.ready`, which only resolves once one is, or subscribe() throws.
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
    setStatus("subscribed");
  }

  async function disable() {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("unsubscribed");
  }

  return (
    <div className="space-y-4">
      {status === "unsupported" && (
        <p className="text-sm text-ink-muted">Your browser doesn't support push notifications.</p>
      )}
      {status === "denied" && (
        <p className="text-sm text-ink-muted">
          Notifications are blocked for this site — allow them in your browser's site settings to enable reminders.
        </p>
      )}
      {(status === "unsubscribed" || status === "subscribed") && (
        <div className="flex items-center gap-3">
          <button
            onClick={status === "subscribed" ? disable : enable}
            className={
              status === "subscribed"
                ? "rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent"
                : "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
            }
          >
            {status === "subscribed" ? "Disable on this device" : "Enable notifications on this device"}
          </button>
          {status === "subscribed" && <span className="text-sm text-ink-muted">Enabled here ✓</span>}
        </div>
      )}

      <form
        action={(formData) => startTransition(() => updateReminder(formData))}
        className="flex flex-wrap items-center gap-3 border-t border-line pt-4"
      >
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="reminderEnabled"
            defaultChecked={reminderEnabled}
            className="h-4 w-4 rounded border-line accent-accent"
          />
          Daily reminder at
        </label>
        <input
          type="time"
          name="reminderTime"
          step={900}
          defaultValue={reminderTime ?? "18:00"}
          className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Save
        </button>
      </form>
      <p className="text-xs text-ink-muted">
        Reminder times are UK local time, snapped to 15-minute slots. You still need to enable notifications on each
        device you want reminded on.
      </p>
    </div>
  );
}
