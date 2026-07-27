import { createServerFn } from "@tanstack/react-start";

export interface WarningDTO {
  id: string;
  hazard: string;
  level: number;
  validFrom: string;
  validTo: string;
  title: string;
  description: string;
  impact: string;
  value: string | null;
  active: boolean;
  source: string;
  regionIds: string[];
}

/** Öffentliche Liste aller aktiven Warnungen (für Karte und Widgets). */
export const listWarnings = createServerFn({ method: "GET" }).handler(async () => {
  const { readActiveWarnings } = await import("@/lib/warnings.server");
  const { toDTO } = await import("@/lib/warnings-dto.server");
  try {
    const rows = await readActiveWarnings();
    return { warnings: rows.map(toDTO), updatedAt: new Date().toISOString() };
  } catch (err) {
    return {
      warnings: [] as WarningDTO[],
      updatedAt: new Date().toISOString(),
      warning: err instanceof Error ? err.message : "Warnungen nicht verfügbar",
    };
  }
});

/** Admin: alle Warnungen inkl. inaktiver. */
export const adminListWarnings = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, readAllWarnings } = await import("@/lib/warnings.server");
    const { toDTO } = await import("@/lib/warnings-dto.server");
    assertAdmin(data.password);
    const rows = await readAllWarnings();
    return { warnings: rows.map(toDTO) };
  });

export const checkAdminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const { checkAdminPassword } = await import("@/lib/warnings.server");
    return { ok: checkAdminPassword(data.password) };
  });

export interface SaveWarningInput {
  password: string;
  id?: string | null;
  hazard: string;
  level: number;
  validFrom: string;
  validTo: string;
  title: string;
  description: string;
  impact: string;
  value?: string | null;
  regionIds: string[];
  active: boolean;
}

export const saveWarning = createServerFn({ method: "POST" })
  .inputValidator((d: SaveWarningInput) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient, setWarningRegions } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    if (!data.regionIds.length) throw new Error("Mindestens eine Gemeinde auswählen");
    if (![1, 2, 3].includes(data.level)) throw new Error("Ungültige Warnstufe");
    const sb = await adminClient();

    const row = {
      hazard: data.hazard,
      level: data.level,
      valid_from: new Date(data.validFrom).toISOString(),
      valid_to: new Date(data.validTo).toISOString(),
      title: data.title.slice(0, 200),
      description: data.description.slice(0, 2000),
      impact: data.impact.slice(0, 2000),
      params: data.value ? { value: String(data.value).slice(0, 40) } : {},
      active: data.active,
      source: "manual",
    };

    let id = data.id ?? null;
    if (id) {
      const { error } = await sb.from("warnings").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await sb.from("warnings").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      id = (ins as { id: string }).id;
    }
    await setWarningRegions(id!, data.regionIds);

    if (data.active) {
      const { notifyWarning } = await import("@/lib/push.server");
      await notifyWarning(id!).catch(() => undefined);
    }
    return { id };
  });

export const setWarningActive = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string; active: boolean }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const sb = await adminClient();
    const { error } = await sb.from("warnings").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWarning = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const sb = await adminClient();
    const { error } = await sb.from("warnings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Web-Push ------------------------------ */

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { endpoint: string; p256dh: string; auth: string; regionIds: string[] }) => d,
  )
  .handler(async ({ data }) => {
    if (!/^https:\/\//.test(data.endpoint) || data.endpoint.length > 1000) {
      throw new Error("Ungültiger Endpoint");
    }
    const { adminClient } = await import("@/lib/warnings.server");
    const sb = await adminClient();
    const { error } = await sb.from("push_subscriptions").upsert(
      {
        endpoint: data.endpoint,
        p256dh: data.p256dh.slice(0, 400),
        auth: data.auth.slice(0, 200),
        region_ids: Array.from(new Set(data.regionIds)).slice(0, 50),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data }) => {
    const { adminClient } = await import("@/lib/warnings.server");
    const sb = await adminClient();
    await sb.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });
