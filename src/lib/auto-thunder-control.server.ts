import { adminClient } from "@/lib/warnings.server";

/** Separate from run logs so scheduled checks cannot overwrite the switch. */
const SETTINGS_JOB = "auto-thunder-settings";

export async function getAutoThunderEnabled(): Promise<boolean> {
  const sb = await adminClient();
  const { data, error } = await sb.from("job_runs").select("note").eq("job", SETTINGS_JOB).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return true; // Preserve existing behaviour until explicitly changed.
  const settings = JSON.parse(data.note ?? "null") as { enabled?: unknown } | null;
  if (typeof settings?.enabled !== "boolean") throw new Error("Gewitter-Einstellung nicht lesbar");
  return settings.enabled;
}

export async function setAutoThunderEnabled(enabled: boolean): Promise<void> {
  if (typeof enabled !== "boolean") throw new Error("Ungültige Gewitter-Einstellung");
  const sb = await adminClient();
  const { error } = await sb.from("job_runs").upsert({
    job: SETTINGS_JOB,
    ran_at: new Date().toISOString(),
    note: JSON.stringify({ enabled }),
  }, { onConflict: "job" });
  if (error) throw new Error(error.message);
  // Do not confirm a new event using observations from before a pause.
  const { error: resetError } = await sb.from("job_runs").delete().eq("job", "auto-thunder-candidates");
  if (resetError) throw new Error(resetError.message);
}