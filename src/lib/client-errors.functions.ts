import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const reportSchema = z.object({
  kind: z.string().max(40),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  detail: z.string().max(2000).optional().nullable(),
  memoryMb: z.number().optional().nullable(),
});

/** Meldet einen Browser-Absturz; schreibt serverseitig in `client_errors`. */
export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reportSchema.parse(data))
  .handler(async ({ data }) => {
    const { insertClientError } = await import("@/lib/client-errors.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    let userAgent: string | null = null;
    try {
      userAgent = getRequest().headers.get("user-agent");
    } catch {
      userAgent = null;
    }
    await insertClientError({ ...data, userAgent });
    return { ok: true as const };
  });

export const adminListClientErrors = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const { readClientErrors } = await import("@/lib/client-errors.server");
    return readClientErrors(50);
  });

export const adminClearClientErrors = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const { clearClientErrors } = await import("@/lib/client-errors.server");
    await clearClientErrors();
    return { ok: true as const };
  });
