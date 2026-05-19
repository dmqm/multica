"use client";

import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@multica/ui/components/ui/sidebar";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import { ModalRegistry } from "../modals/registry";
import { AppSidebar } from "./app-sidebar";
import { DashboardGuard } from "./dashboard-guard";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobilePageTransition } from "./mobile-page-transition";
import { NavigationProgress } from "./navigation-progress";
import { WorkspacePresencePrefetch } from "./workspace-presence-prefetch";

interface DashboardLayoutProps {
  children: ReactNode;
  /** Rendered inside SidebarInset (e.g. ChatWindow, ChatFab — absolute-positioned overlays) */
  extra?: ReactNode;
  /** Rendered inside sidebar header as a search trigger */
  searchSlot?: ReactNode;
  /** Loading indicator */
  loadingIndicator?: ReactNode;
}

export function DashboardLayout({
  children,
  extra,
  searchSlot,
  loadingIndicator,
}: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  return (
    <DashboardGuard
      loadingFallback={
        <div className="flex h-svh items-center justify-center">
          {loadingIndicator}
        </div>
      }
    >
      <SidebarProvider className="h-svh">
        <WorkspacePresencePrefetch />
        <AppSidebar searchSlot={searchSlot} />
        <SidebarInset className="relative overflow-hidden pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0">
          <NavigationProgress />
          <MobilePageTransition>{children}</MobilePageTransition>
          <ModalRegistry />
          {/* Mobile: ChatPage renders ChatWindow as a route child, peer of
           *  Inbox/Issues inside AnimatePresence — no extra-slot overlay. */}
          {!isMobile && extra}
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </DashboardGuard>
  );
}
