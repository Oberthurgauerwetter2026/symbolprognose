import { renderToStaticMarkup } from "react-dom/server";
import { HAZARDS, LEVELS } from "@/lib/warnings-config";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("/tmp/gen/svg", { recursive: true });
for (const h of HAZARDS) {
  for (const l of [1, 2, 3] as const) {
    const def = LEVELS[l];
    const inner = renderToStaticMarkup(<h.icon width={24} height={24} />)
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "")
      .replace(/currentColor/g, def.textOnColor);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
<rect width="192" height="192" rx="40" fill="${def.color}"/>
<g transform="translate(36,36) scale(5)" fill="none" stroke="${def.textOnColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;
    writeFileSync(`/tmp/gen/svg/${h.id}-${l}.svg`, svg);
  }
}
console.log("done");
