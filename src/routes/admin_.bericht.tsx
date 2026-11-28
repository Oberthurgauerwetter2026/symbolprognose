import { createFileRoute } from "@tanstack/react-router";
import { AdminHub } from "@/components/admin/admin-hub";
import { adminHead, validateAdminSearch } from "@/lib/admin-tabs";

// Bisherige Adresse: öffnet dasselbe Redaktions-Tool im passenden Bereich, damit Lesezeichen und installierte Apps weiter funktionieren.
export const Route = createFileRoute("/admin_/bericht")({
  ssr: false,
  validateSearch: validateAdminSearch,
  head: () => adminHead("Wetterbericht verfassen · Oberthurgauer Wetter", "Wetterbericht für Oberthurgauer Wetter verfassen und veröffentlichen.", "OWT Redaktion", "/api/public/admin-manifest"),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminHub tab={tab ?? "bericht"} onTab={(next) => void navigate({ to: ".", search: { tab: next }, replace: true })} />;
}
