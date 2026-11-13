import { createServerFn } from "@tanstack/react-start";
import { MAX_BODY, productById } from "./ticker";

export interface TickerPost {
  id: string; created_at: string; body: string;
  product: string | null; product_value: string | null; image: string | null;
}

export const listTickerPosts = createServerFn({ method: "GET" }).handler(async (): Promise<TickerPost[]> => {
  const { adminClient } = await import("@/lib/warnings.server");
  const sb = (await adminClient()) as any;
  const { data, error } = await sb
    .from("ticker_posts").select("id,created_at,body,product,product_value,image_url")
    .order("created_at", { ascending: false }).limit(30);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const paths = rows.map((r) => r.image_url).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: s } = await sb.storage.from("ticker").createSignedUrls(paths, 7 * 86400);
    for (const x of s ?? []) if (x.signedUrl && x.path) signed.set(x.path, x.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id, created_at: r.created_at, body: r.body, product: r.product,
    product_value: r.product_value, image: r.image_url ? signed.get(r.image_url) ?? null : null,
  }));
});

export const createTickerPost = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; body: string; product?: string | null; productValue?: string | null; imageBase64?: string | null }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const body = data.body.trim();
    if (!body || body.length > MAX_BODY) throw new Error(`Text 1–${MAX_BODY} Zeichen`);
    const product = productById(data.product)?.id ?? null;
    const sb = (await adminClient()) as any;
    let image_url: string | null = null;
    if (data.imageBase64) {
      const bin = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
      if (bin.length > 8_000_000) throw new Error("Bild zu gross");
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("ticker").upload(path, bin, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      image_url = path;
    }
    const { error } = await sb.from("ticker_posts").insert({
      body, product, product_value: product ? data.productValue?.trim().slice(0, 80) || null : null, image_url,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTickerPost = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin, adminClient } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const sb = (await adminClient()) as any;
    const { data: row } = await sb.from("ticker_posts").select("image_url").eq("id", data.id).maybeSingle();
    if (row?.image_url) await sb.storage.from("ticker").remove([row.image_url]);
    const { error } = await sb.from("ticker_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
