import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// One bucket for every photo the app stores, split by a path prefix
// (journal/... vs workouts/...) rather than a bucket each — simpler than
// provisioning + RLS-configuring a new Supabase Storage bucket for every
// new place a photo can be attached.
const BUCKET = "journal-photos";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches next.config.ts's server action body cap
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 85;

// Every photo is re-encoded before it ever reaches storage, for three
// reasons at once: it strips all metadata (EXIF GPS coordinates included —
// a phone photo can otherwise carry the exact location it was taken
// straight through to its public URL), it caps dimensions so one huge
// original doesn't balloon storage forever, and — since sharp only
// succeeds on bytes that actually decode as an image — it's real content
// verification instead of trusting whatever Content-Type the browser
// claimed. Always output as JPEG so every stored photo is a known,
// predictable shape regardless of what was uploaded.
async function processPhoto(file: File): Promise<Buffer> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That photo is too large (max 10MB).");

  const input = Buffer.from(await file.arrayBuffer());
  try {
    return await sharp(input)
      .rotate() // bake in EXIF orientation before the rest of the metadata is dropped, so the photo doesn't end up sideways
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch {
    throw new Error("That doesn't look like a valid image file.");
  }
}

// Server-only client. The key here is the anon/publishable key, but it's
// never sent to the browser — every call goes through an already
// session-authenticated server action, so our own login check is the real
// access control, not Supabase RLS (the storage policies just scope what
// this key can touch to the one bucket).
function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set — photo uploads are disabled until they are.");
  }
  return createClient(url, key).storage.from(BUCKET);
}

async function uploadPhoto(path: string, file: File): Promise<string> {
  const buffer = await processPhoto(file);

  const { error } = await storageClient().upload(path, buffer, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = storageClient().getPublicUrl(path);
  return data.publicUrl;
}

async function deletePhoto(photoUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const i = photoUrl.indexOf(marker);
  if (i === -1) return; // not one of ours — nothing to clean up
  const path = photoUrl.slice(i + marker.length);
  await storageClient().remove([path]);
}

// Filenames always end .jpg now — every upload is re-encoded to JPEG by
// processPhoto regardless of what was uploaded, so the extension is no
// longer worth taking from the (untrusted, and now simply wrong) original
// filename.
export async function uploadJournalPhoto(userId: string, dateISO: string, file: File): Promise<string> {
  return uploadPhoto(`${userId}/${dateISO}-${Date.now()}.jpg`, file);
}

export const deleteJournalPhoto = deletePhoto;

export async function uploadWorkoutPhoto(userId: string, workoutId: string, file: File): Promise<string> {
  return uploadPhoto(`workouts/${userId}/${workoutId}-${Date.now()}.jpg`, file);
}

export const deleteWorkoutPhoto = deletePhoto;

export async function uploadAvatarPhoto(userId: string, file: File): Promise<string> {
  return uploadPhoto(`avatars/${userId}-${Date.now()}.jpg`, file);
}

export const deleteAvatarPhoto = deletePhoto;
