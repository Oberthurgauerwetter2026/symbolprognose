import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function DashboardLayout({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
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
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
