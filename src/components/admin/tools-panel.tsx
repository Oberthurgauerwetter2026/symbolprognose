import { Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WpSnippets } from "./ticker-panel";
import { ClientErrorsSection, PipelineHealthSection } from "./warnings-panel";
import { EmbedSection, ModelsSection, MosmixStationsSection } from "./tools-sections";

export default function ToolsPanel({ password }: { password: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Gestaltung</h2>
        <p className="text-sm text-muted-foreground">Entwurf für die Anordnung der Kacheln auf Handy und Desktop. Ändert die öffentliche Seite nicht.</p>
        <Button asChild variant="outline"><Link to="/admin/anordnung"><LayoutGrid />Kacheln anordnen</Link></Button>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Einbettung</h2>
        <WpSnippets />
      </section>
      <EmbedSection />
      <PipelineHealthSection password={password} />
      <ClientErrorsSection password={password} />
      <ModelsSection />
      <MosmixStationsSection />
    </div>
  );
}
