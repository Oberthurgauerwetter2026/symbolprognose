import { Component, type ReactNode } from "react";

/**
 * Fängt Render- und Chunk-Lade-Fehler im Live-Widget-Teil eines Embeds ab.
 * Wenn das Widget crasht, wird `html.js-ok` wieder entfernt — damit greift die
 * Embed-CSS-Regel und der serverseitig gerenderte Fallback wird wieder sichtbar.
 */
export class EmbedErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[embed] live widget crashed, falling back to SSR", error);
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("js-ok");
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
