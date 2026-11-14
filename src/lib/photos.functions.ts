import { createServerFn } from "@tanstack/react-start";
import { PHOTO_BURST, PHOTO_MAX_BYTES, cleanSubmission, isJpeg } from "./photo-submit";

export interface PhotoSubmission { id: string; created_at: string; place: string; author: string; note: string; url: string | null }

/** Öffentlich: Besucher senden ein Foto ein. Geht nie live, nur in die Admin-Freigabe. */
export const submitPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { imageBase64: string; place?: string; author?: string; note?: string; consent?: boolean }) => {
    if (typeof d?.imageBase64 !== "string" || d.imageBase64.length > PHOTO_MAX_BYTES * 1.4) throw new Error("Bild zu gross");
    return d;
  })
  .handler(async ({ data }) => {
    const meta = cleanSubmission(data);
    const bin = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
    if (bin.length > PHOTO_MAX_BYTES || !isJpeg(bin)) throw new Error("Ungültiges Bild");
    const { adminClient } = await import("@/lib/warnings.server");
    const sb = (await adminClient()) as any;
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await sb.from("photo_submissions").select("id", { count: "exact", head: true }).gte("created_at", since);
    if ((count ?? 0) >= PHOTO_BURST) throw new Error("Gerade sehr viele Einsendungen – bitte später nochmals versuchen.");
    const path = `einsendungen/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const up = await sb.storage.from("ticker").upload(path, bin, { contentType: "image/jpeg" });
    if (up.error) throw new Error("Upload fehlgeschlagen");
    const { data: photo, error } = await sb.from("photo_submissions").insert({ image_path: path, ...meta }).select("id").single();
    if (error) throw new Error("Speichern fehlgeschlagen");
    try {
      const { notifyPhotoSubmission } = await import("@/lib/push.server");
      await notifyPhotoSubmission({ id: photo.id, ...meta });
    } catch {
      // The photo is saved; never invite duplicate submissions after a push failure.
      console.warn("Reader photo notification failed");
    }
    return { ok: true };
  });

export const listPhotoSubmissions = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }): Promise<PhotoSubmission[]> => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const sb = (await adminClient()) as any;
    const { data: rows, error } = await sb.from("photo_submissions").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    const signed = new Map<string, string>();
    if (list.length) {
      const { data: s } = await sb.storage.from("ticker").createSignedUrls(list.map((r) => r.image_path), 86400);
      for (const x of s ?? []) if (x.signedUrl && x.path) signed.set(x.path, x.signedUrl);
    }
    return list.map((r) => ({ id: r.id, created_at: r.created_at, place: r.place, author: r.author, note: r.note, url: signed.get(r.image_path) ?? null }));
  });

export const deletePhotoSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const sb = (await adminClient()) as any;
    const { data: row } = await sb.from("photo_submissions").select("image_path").eq("id", data.id).maybeSingle();
    if (row?.image_path) await sb.storage.from("ticker").remove([row.image_path]);
    await sb.from("photo_submissions").delete().eq("id", data.id);
    return { ok: true };
  });
