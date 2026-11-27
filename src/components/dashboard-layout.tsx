import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useMatch } from "@tanstack/react-router";
import { PublicWeatherLayout } from "@/components/public-weather-layout";

export function DashboardLayout({
  title,
  subtitle,
  headerAction,
  children,
}: {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  // Pfad der eigenen Route, nicht des Navigationsziels: sonst kippt das Layout schon vor dem Seitenwechsel.
  const pathname = useMatch({ strict: false, select: (match) => match.pathname.replace(/(.)\/$/, "$1") });
  if (pathname === "/" || pathname.startsWith("/karten/") || pathname === "/wetterbericht" || pathname === "/vertikalschnitt") {
    return <PublicWeatherLayout home={pathname === "/"} headerAction={headerAction} {...(title ? { title } : {})}>{children}</PublicWeatherLayout>;
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-5">
            <SidebarTrigger />
            <div className="flex min-w-0 flex-col">
              {title && (
                <span className="truncate font-[family-name:var(--font-display)] text-base font-semibold leading-tight text-foreground sm:text-lg">
                  {title}
                </span>
              )}
              {subtitle && (
                <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  {subtitle}
                </span>
              )}
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-x-clip">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
