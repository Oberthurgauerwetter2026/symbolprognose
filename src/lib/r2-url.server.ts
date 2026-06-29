const KNOWN_R2_OBJECT_SUFFIXES = [
  "radar/frames.json",
  "openmeteo/forecast.json",
  "openmeteo/symbol.json",
  "mch/local_forecast.json",
  "arome/forecast.json",
] as const;

const KNOWN_R2_DIRECTORY_SUFFIXES = ["radar", "openmeteo", "mch", "arome"] as const;

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function pushUnique(out: string[], value: string | null | undefined) {
  if (!value) return;
  const normalized = value.replace(/\/+$/g, "");
  if (normalized && !out.includes(normalized)) out.push(normalized);
}

function stripKnownR2Suffix(pathname: string): string {
  let path = pathname.replace(/\/+$/g, "");
  const normalized = trimSlashes(path);

  for (const suffix of KNOWN_R2_OBJECT_SUFFIXES) {
    if (normalized.toLowerCase().endsWith(suffix.toLowerCase())) {
      const keep = normalized.slice(0, normalized.length - suffix.length).replace(/\/+$/g, "");
      return keep ? `/${keep}` : "";
    }
  }

  for (const suffix of KNOWN_R2_DIRECTORY_SUFFIXES) {
    if (normalized.toLowerCase().endsWith(suffix.toLowerCase())) {
      const keep = normalized.slice(0, normalized.length - suffix.length).replace(/\/+$/g, "");
      return keep ? `/${keep}` : "";
    }
  }

  return path === "/" ? "" : path;
}

export function r2ObjectUrlCandidates(rawUrl: string | null | undefined, objectKey: string): string[] {
  if (!rawUrl) return [];

  const trimmed = rawUrl.trim().replace(/\/+$/g, "");
  if (!trimmed) return [];

  const key = trimSlashes(objectKey);
  const out: string[] = [];

  if (trimSlashes(trimmed).toLowerCase().endsWith(key.toLowerCase())) {
    pushUnique(out, trimmed);
  }

  try {
    const url = new URL(trimmed);
    const rootPath = stripKnownR2Suffix(url.pathname);
    pushUnique(out, `${url.origin}${rootPath}/${key}`);
    pushUnique(out, `${url.origin}/${key}`);
  } catch {
    const root = trimmed
      .replace(/\/+$/g, "")
      .replace(new RegExp(`/${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "")
      .replace(/\/(radar|openmeteo|mch|arome)(\/[^/]+\.json)?$/i, "");
    pushUnique(out, `${root}/${key}`);
  }

  return out;
}