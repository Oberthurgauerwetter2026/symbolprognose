import { createFileRoute } from "@tanstack/react-router";
import { AdminHub } from "@/components/admin/admin-hub";
import { adminHead, validateAdminSearch } from "@/lib/admin-tabs";

// Zentrales Redaktions-Tool: Ticker, Wetterbericht, Warnungen und Werkzeuge.
export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: validateAdminSearch,
  head: () => adminHead("Redaktion · Oberthurgauer Wetter", "Ticker, Wetterbericht und Warnungen von Oberthurgauer Wetter an einem Ort verwalten.", "OWT Redaktion", "/api/public/admin-manifest"),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminHub tab={tab ?? "ticker"} onTab={(next) => void navigate({ to: ".", search: { tab: next }, replace: true })} />;
}
