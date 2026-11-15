const BASE = "https://oberthurgauer-wetter.lovable.app";

/** WordPress may HTML-encode inline JavaScript; keep all logic in the external file. */
export const WP_TICKER_SNIPPETS = [
  {
    label: "Smartphone – ganz oben (HTML-Block auf der Startseite)",
    code: `<div class="otw-handy-ticker otw-ticker">
  <iframe src="${BASE}/embed/ticker?view=banner" loading="eager" scrolling="no"
    style="width:100%;height:80px;border:0;display:block;background:transparent;margin:0;"
    title="Wetter-Ticker"></iframe>
</div>
<style>@media (min-width:768px){.otw-handy-ticker{display:none!important}}</style>
<script src="${BASE}/ticker-embed.js" defer></script>`,
  },
  {
    label: "Desktop – Seitenleiste (Widget «Individuelles HTML»)",
    code: `<div class="otw-desktop-ticker otw-ticker">
  <iframe src="${BASE}/embed/ticker?view=widget" loading="eager" scrolling="no"
    style="width:100%;height:80px;border:0;display:block;background:transparent;margin:0;"
    title="Wetter-Ticker"></iframe>
</div>
<style>@media (max-width:767px){.otw-desktop-ticker{display:none!important}}</style>
<script src="${BASE}/ticker-embed.js" defer></script>`,
  },
];