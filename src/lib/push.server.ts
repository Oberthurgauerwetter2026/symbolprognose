/**
 * Web-Push-Versand (VAPID, Cloudflare-Worker-kompatibel).
 * Server-only.
 */

import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { adminClient, type WarningRow } from "@/lib/warnings.server";
import {
  formatRange,
  warningTitle,
  WP_WARN_URL,
  type HazardId,
  type WarnLevel,
} from "@/lib/warnings-config";

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  region_ids: string[];
}

function vapid() {
  return {
    subject: process.env.VAPID_SUBJECT ?? "mailto:info@example.com",
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };
}

export async function sendPush(
  sub: SubRow,
  payload: { title: string; body: string; url: string; tag?: string; icon?: string },

): Promise<boolean> {
  const keys = vapid();
  if (!keys.publicKey || !keys.privateKey) return false;
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { auth: sub.auth, p256dh: sub.p256dh },
  };
  try {
    const init = await buildPushPayload({ data: payload, options: { ttl: 3600 } }, subscription, keys);
    const res = await fetch(sub.endpoint, init as unknown as RequestInit);
    if (res.status === 404 || res.status === 410) {
      const sb = await adminClient();
      await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      return false;
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** Benachrichtigt alle Abos, die mindestens eine betroffene Gemeinde abonniert haben. */
export async function notifyWarning(warningId: string): Promise<number> {
  const sb = await adminClient();
  const { data: w } = await sb.from("warnings").select("*").eq("id", warningId).single();
  if (!w) return 0;
  const warning = w as unknown as WarningRow;
  const { data: links } = await sb.from("warning_regions").select("region_id").eq("warning_id", warningId);
  const regionIds = ((links ?? []) as { region_id: string }[]).map((l) => l.region_id);
  if (!regionIds.length) return 0;

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, region_ids")
    .overlaps("region_ids", regionIds);

  const { regionName } = await import("@/lib/warnings-config");
  const names = regionIds.map((id) => regionName(id));
  const list = names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
  const period = formatRange(warning.valid_from, warning.valid_to);

  const level = Math.max(1, Math.min(3, warning.level)) as WarnLevel;
  const hazardId = warning.hazard as HazardId;

  // iOS zeigt unter dem Titel automatisch den App-Namen ("from …") an –
  // daher hier keinen Absender mehr anhängen. Das Emoji vor dem Titel ist
  // auch auf iOS sichtbar, wo das Symbolbild vom System ersetzt wird.
  const emoji: Record<string, string> = {
    gewitter: "⚡",
    regen: "💧",
    wind: "🎏",
    schnee: "❄️",
    glaette: "🛞",
    frost: "🌡️",
  };
  const levelDot: Record<WarnLevel, string> = { 1: "🟡", 2: "🟠", 3: "🔴" };
  const baseTitle = warning.title || warningTitle(hazardId, level);
  // Ortsangabe im Titel: bis zu zwei Gemeinden, danach gekürzt.
  const place =
    names.length === 0
      ? ""
      : names.length <= 2
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const prefix = `${emoji[hazardId] ? `${emoji[hazardId]} ` : ""}${levelDot[level]} `;
  const title = `${prefix}${baseTitle}${place ? ` für ${place}` : ""}`;


  const { SITE_URL } = await import("@/lib/site-url");
  const known = ["gewitter", "regen", "schnee", "glaette", "wind", "frost"].includes(hazardId);
  const icon = known ? `${SITE_URL}/warn-icons/${hazardId}-${level}.png` : undefined;

  const body = `${warning.description} Betroffene Gemeinden: ${list}. Gültig: ${period}. Details: oberthurgauerwetter.ch`;

  let sent = 0;
  for (const s of (subs ?? []) as SubRow[]) {
    const ok = await sendPush(s, {
      title,
      body,
      url: WP_WARN_URL,
      tag: warning.id,
      icon,
    });
    if (ok) sent++;
  }

  return sent;
}
