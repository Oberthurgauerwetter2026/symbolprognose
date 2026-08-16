import { Component, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportError } from "@/lib/client-error-reporter";

/**
 * Fängt Renderfehler einer Ansicht ab, damit nie eine weisse Seite entsteht.
 * Zeigt eine kurze Meldung mit „Neu laden“ und meldet den Fehler an den Server.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode; label?: string; height?: number },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[app] Renderfehler abgefangen", error);
    reportError("react.render", error, `${this.props.label ?? "app"} ${info.componentStack ?? ""}`.trim());
  }

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/60 p-6 text-center"
        style={this.props.height ? { minHeight: this.props.height } : undefined}
      >
        <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {this.props.label ?? "Diese Ansicht"} konnte nicht geladen werden.
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Die Anzeige wurde unerwartet unterbrochen. Der Fehler ist protokolliert — bitte neu laden.
        </p>
        <button
          type="button"
          onClick={this.reload}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Neu laden
        </button>
      </div>
    );
  }
}

/**
 * Umhüllt eine Ansicht mit dem Fehler-Auffangbereich, damit ein Renderfehler
 * niemals die ganze Seite leer werden lässt.
 */
export function withErrorBoundary<F extends (props: never) => ReactNode>(
  Inner: F,
  label: string,
  height?: number,
): (props: Parameters<F>[0]) => ReactNode {
  const Wrapped = (props: Parameters<F>[0]) => {
    const Inner2 = Inner as unknown as ComponentType<Record<string, unknown>>;
    return (
      <AppErrorBoundary label={label} height={height}>
        <Inner2 {...((props ?? {}) as Record<string, unknown>)} />
      </AppErrorBoundary>
    );
  };
  Wrapped.displayName = `withErrorBoundary(${label})`;
  return Wrapped;
}


