import { createFileRoute } from "@tanstack/react-router";
import { AdminHub } from "@/components/admin/admin-hub";
import { adminHead, validateAdminSearch } from "@/lib/admin-tabs";

// Bisherige Adresse: öffnet dasselbe Redaktions-Tool im passenden Bereich, damit Lesezeichen und installierte Apps weiter funktionieren.
export const Route = createFileRoute("/admin-warnungen")({
  ssr: false,
  validateSearch: validateAdminSearch,
  head: () => adminHead("Warnungen verwalten · Oberthurgauer Wetter", "Redaktionelle Wetterwarnungen von Oberthurgauer Wetter verwalten.", "OWT Redaktion", "/api/public/admin-manifest"),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminHub tab={tab ?? "warnungen"} onTab={(next) => void navigate({ to: ".", search: { tab: next }, replace: true })} />;
}
