## Plan

Implement a dispatch-side queue guard so the app stops sending `workflow_dispatch` requests while an Open-Meteo ingest run is already `queued`, `waiting`, `pending`, `requested`, or `in_progress`.

### Changes

1. **Harden `src/lib/openmeteo-dispatch.server.ts`**
   - Before calling GitHub `workflow_dispatch`, query recent runs for `openmeteo-ingest.yml`.
   - If an active run already exists, return a throttled/skipped result instead of creating another queued run.
   - Keep the short in-memory throttle as a small extra protection against rapid double-click/manual calls.
   - Include useful debug fields in the response, such as active run status/id/url when available.

2. **Keep workflow concurrency as-is**
   - Leave `.github/workflows/openmeteo-ingest.yml` with `cancel-in-progress: false`.
   - The fix is to avoid creating the third pending run in the first place, because GitHub only allows one waiting run for a concurrency group.

3. **Clean up stale comments/docs**
   - Update the Open-Meteo dispatch comments so they no longer imply a 60s throttle is sufficient.
   - Update `.lovable/plan.md` to document the durable queue guard and the expected `429 throttled` behavior from the cron worker when a run is already active.

### Verification

- Trigger `/run/openmeteo` repeatedly or let the 15-minute cron fire during an active ingest.
- Expected behavior:
  - First trigger dispatches the workflow.
  - Later triggers while it is active return/log `429 throttled` from the endpoint.
  - GitHub Actions no longer shows `Canceling since a higher priority waiting request for openmeteo-ingest exists`.