"use client";

import { useRef, useState, useTransition } from "react";
import { uploadEntryPhoto, removeEntryPhoto } from "./actions";

export function PhotoUpload({ dateISO, initialPhotoUrl }: { dateISO: string; initialPhotoUrl: string | null }) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      const result = await uploadEntryPhoto(dateISO, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setPhotoUrl(URL.createObjectURL(file));
      }
    });
  }

  if (photoUrl) {
    return (
      <div className="mb-6">
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Today's photo" className="max-h-72 rounded-2xl border border-line object-cover" />
          <button
            type="button"
            title="Remove photo"
            disabled={isPending}
            onClick={() => {
              setPhotoUrl(null);
              startTransition(() => {
                removeEntryPhoto(dateISO);
              });
            }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-dashed border-line px-4 py-2.5 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "+ Add a photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
