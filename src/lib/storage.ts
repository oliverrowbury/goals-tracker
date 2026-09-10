import { createClient } from "@supabase/supabase-js";

const BUCKET = "journal-photos";

// Server-only client. The key here is the anon/publishable key, but it's
// never sent to the browser — every call goes through an already
// session-authenticated server action, so our own login check is the real
// access control, not Supabase RLS (the storage policies just scope what
// this key can touch to the one journal-photos bucket).
function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set — photo uploads are disabled until they are.");
  }
  return createClient(url, key).storage.from(BUCKET);
}

export async function uploadJournalPhoto(userId: string, dateISO: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${dateISO}-${Date.now()}.${ext}`;

  const { error } = await storageClient().upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = storageClient().getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteJournalPhoto(photoUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const i = photoUrl.indexOf(marker);
  if (i === -1) return; // not one of ours — nothing to clean up
  const path = photoUrl.slice(i + marker.length);
  await storageClient().remove([path]);
}
