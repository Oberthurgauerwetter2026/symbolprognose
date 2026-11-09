/** Deduplicate refreshes; retain recent data only when refresh has a managed lifetime. */
export function createSumsCache<T>(ttl: number, maxAge: number) {
  let cached: { at: number; value: T } | undefined;
  let pending: Promise<T> | undefined;
  return async (load: () => Promise<T>, now: number, waitUntil?: (p: Promise<unknown>) => void): Promise<T> => {
    if (cached && now - cached.at < ttl) return cached.value;
    if (!pending) {
      pending = load().then(value => {
        cached = { at: now, value };
        return value;
      }).finally(() => { pending = undefined; });
    }
    if (cached && now - cached.at < maxAge && waitUntil) {
      waitUntil(pending.catch(() => undefined));
      return cached.value;
    }
    return pending;
  };
}