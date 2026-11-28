import { createFileRoute } from "@tanstack/react-router";
import { AdminHub } from "@/components/admin/admin-hub";
import { adminHead, validateAdminSearch } from "@/lib/admin-tabs";

// Bisherige Adresse: öffnet dasselbe Redaktions-Tool im passenden Bereich, damit Lesezeichen und installierte Apps weiter funktionieren.
export const Route = createFileRoute("/admin-ticker")({
  ssr: false,
  validateSearch: validateAdminSearch,
  head: () => adminHead("Ticker erfassen · Oberthurgauer Wetter", "Kurzmeldungen für den Wetter-Ticker erfassen.", "Ticker Admin", "/api/public/admin-ticker-manifest"),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminHub tab={tab ?? "ticker"} onTab={(next) => void navigate({ to: ".", search: { tab: next }, replace: true })} />;
}
