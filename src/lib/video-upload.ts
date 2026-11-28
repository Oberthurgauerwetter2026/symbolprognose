import { publicSupabase } from "@/lib/public-supabase";
import { requestVideoUpload } from "@/lib/photos.functions";

/** Lädt ein Video direkt in den Speicher (am Server vorbei) und gibt den Pfad zurück. */
export async function uploadVideo(file: File, password?: string): Promise<string> {
  const { path, token } = await requestVideoUpload({ data: { mime: file.type, size: file.size, password } });
  const { error } = await publicSupabase().storage.from("ticker").uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw new Error("Video-Upload fehlgeschlagen");
  return path;
}
