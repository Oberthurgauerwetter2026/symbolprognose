import { createServerFn } from "@tanstack/react-start";
import { validatePhotoPushDevice, type PhotoPushDevice } from "./photo-push";

export const getPhotoPushStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; device: PhotoPushDevice }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const device = validatePhotoPushDevice(data.device);
    const sb = await adminClient();
    const { data: row, error } = await sb.from("admin_photo_push_subscriptions").select("endpoint").eq("endpoint", device.endpoint).eq("auth", device.auth).maybeSingle();
    if (error) throw new Error("Geräteanmeldung konnte nicht geprüft werden.");
    return { enabled: Boolean(row) };
  });

export const setPhotoPushDevice = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; device: PhotoPushDevice; enabled: boolean }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const device = validatePhotoPushDevice(data.device);
    if (data.enabled && (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)) throw new Error("Benachrichtigungen sind noch nicht eingerichtet.");
    const sb = await adminClient();
    const { error } = data.enabled
      ? await sb.from("admin_photo_push_subscriptions").upsert(device, { onConflict: "endpoint" })
      : await sb.from("admin_photo_push_subscriptions").delete().eq("endpoint", device.endpoint).eq("auth", device.auth);
    if (error) throw new Error("Geräteanmeldung konnte nicht gespeichert werden.");
    return { enabled: data.enabled };
  });

export const testPhotoPush = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; device: PhotoPushDevice }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const device = validatePhotoPushDevice(data.device);
    const sb = await adminClient();
    const { data: row, error } = await sb.from("admin_photo_push_subscriptions").select("endpoint").eq("endpoint", device.endpoint).eq("auth", device.auth).maybeSingle();
    if (error || !row) throw new Error("Bitte Benachrichtigungen zuerst aktivieren.");
    const { sendPush } = await import("@/lib/push.server");
    const sent = await sendPush(device, { title: "Leserfoto-Benachrichtigungen aktiv", body: "Dieses Gerät erhält neue Fotoeinsendungen.", url: "/admin-ticker", tag: "leserfoto-test" }, "admin_photo_push_subscriptions");
    if (!sent) throw new Error("Testnachricht konnte nicht zugestellt werden. Bitte erneut aktivieren.");
    return { ok: true };
  });