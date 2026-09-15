"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { uploadAvatar, removeAvatar } from "./actions";

export function AvatarUpload({ name, initialAvatarUrl }: { name: string; initialAvatarUrl: string | null }) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setAvatarUrl(URL.createObjectURL(file));
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} avatarUrl={avatarUrl} size={56} />
      <div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {isPending ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setAvatarUrl(null);
                startTransition(() => {
                  removeAvatar();
                });
              }}
              className="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
