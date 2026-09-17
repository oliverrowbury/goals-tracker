"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./actions";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status = "unsupported" | "unsubscribed" | "subscribed" | "denied";

function initialStatus(): Status {
  if (typeof window === "undefined") return "unsubscribed"; // SSR — resolved properly on mount below
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "unsubscribed";
}

export function NotificationsForm() {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [unavailable, setUnavailable] = useState(false);
  // The permission prompt → service worker register → subscribe chain can
  // take a noticeable moment (or sit waiting on the user to answer the
  // permission dialog) — without this the button just looks inert the
  // whole time, and a double-tap could fire the flow twice.
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    });
  }, []);

  async function enable() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setUnavailable(true);
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
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {status === "unsupported" && (
        <p className="text-sm text-ink-muted">Your browser doesn&apos;t support push notifications.</p>
      )}
      {status === "denied" && (
        <p className="text-sm text-ink-muted">
          Notifications are blocked for this site — allow them in your browser&apos;s site settings to enable reminders.
        </p>
      )}
      {(status === "unsubscribed" || status === "subscribed") && (
        <div className="flex items-center gap-3">
          <button
            onClick={status === "subscribed" ? disable : enable}
            disabled={pending}
            className={
              status === "subscribed"
                ? "rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent disabled:opacity-50"
                : "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            }
          >
            {pending
              ? status === "subscribed"
                ? "Disabling…"
                : "Enabling…"
              : status === "subscribed"
                ? "Disable on this device"
                : "Enable notifications on this device"}
          </button>
          {status === "subscribed" && !pending && <span className="text-sm text-ink-muted">Enabled here ✓</span>}
        </div>
      )}
      {unavailable && <p className="text-sm text-ink-muted">Push notifications aren&apos;t available yet — check back soon.</p>}

      <p className="border-t border-line pt-4 text-sm text-ink-muted">
        Reminders are set per goal now, since different goals need different days — turn one on from that goal’s{" "}
        <span className="font-medium text-ink">Edit</span> page. You still need to enable notifications on each
        device you want reminded on.
      </p>
    </div>
  );
}
