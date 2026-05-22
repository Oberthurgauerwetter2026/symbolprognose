import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Code2, Settings } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MAPS } from "@/lib/maps-config";

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });
  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-white"
            style={{ background: "#2561a1" }}
          >
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Wetter-Board
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Übersicht</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")} tooltip="Dashboard">
                  <Link to="/" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Karten</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAPS.map((m) => {
                const Icon = m.icon;
                return (
                  <SidebarMenuItem key={m.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(m.routePath)}
                      tooltip={m.label}
                    >
                      <Link to={m.routePath} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{m.label}</span>
                        {m.status === "coming-soon" && (
                          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
                            bald
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Werkzeuge</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/embed-info")} tooltip="Embed-Snippets">
                  <Link to="/embed-info" className="flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    <span>Embed-Snippets</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Admin">
                  <Link to="/admin" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
