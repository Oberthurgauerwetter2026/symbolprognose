/**
 * Schmaler, immer sichtbarer Streifen am Kopf eines /embed/*-Inhalts.
 * Sichtbar BEVOR die JS-Karte rendert und auch dann, wenn sie crasht oder
 * von einem Content-Blocker verstümmelt wird. Enthält einen Direktlink
 * zur vollen Karte (target="_blank"), damit Besucher in In-App-Browsern
 * (Facebook/Instagram, wo das iframe ggf. an Cloudflare-Bot-Challenge
 * scheitert) immer noch zur Seite kommen.
 */
export function EmbedFallbackBar({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div
      className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-white"
      style={{ background: "#2561a1" }}
    >
      <span className="truncate font-semibold">{title}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="shrink-0 rounded bg-white/15 px-2 py-0.5 font-semibold underline-offset-2 hover:underline"
      >
        Karte öffnen ↗
      </a>
    </div>
  );
}
