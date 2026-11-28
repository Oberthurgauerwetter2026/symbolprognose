/** Bereiche des gemeinsamen Redaktions-Tools; die Reihenfolge ist die der Reiter. */
export const ADMIN_TABS = ["ticker", "bericht", "warnungen", "werkzeuge"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export function parseAdminTab(value: unknown): AdminTab | undefined {
  return ADMIN_TABS.find((tab) => tab === value);
}

/** Gemeinsame Suchparameter aller Admin-Adressen: nur der gewählte Reiter. */
export function validateAdminSearch(search: Record<string, unknown>): { tab?: AdminTab } {
  const tab = parseAdminTab(search["tab"]);
  return tab ? { tab } : {};
}

const ADMIN_META = [
  { name: "robots", content: "noindex, nofollow" },
  { name: "apple-mobile-web-app-capable", content: "yes" },
  { name: "mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-status-bar-style", content: "default" },
  { name: "theme-color", content: "#2561a1" },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
];

/** Kopfdaten einer Admin-Adresse; `manifest` wählt das App-Profil für den Home-Bildschirm. */
export function adminHead(title: string, description: string, appName: string, manifest: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "apple-mobile-web-app-title", content: appName },
      { name: "application-name", content: appName },
      ...ADMIN_META,
    ],
    links: [
      { rel: "manifest", href: manifest },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  };
}
