import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/offline-banner";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    // Client-only — localStorage is unavailable during SSR
    if (typeof window !== "undefined" && !getToken()) {
      throw redirect({ to: "/login", search: { redirect: undefined } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const { refreshing } = usePullToRefresh(() => router.invalidate());

  useEffect(() => {
    // SSR runs loaders without a token and returns empty []. After hydration,
    // re-run all loaders with the real token. setTimeout(0) defers past
    // React's reconciliation phase to avoid hydration mismatch errors.
    const id = setTimeout(() => router.invalidate(), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <PullToRefreshIndicator visible={refreshing} />

      <AppSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setMobileOpen((o) => !o);
            } else {
              setCollapsed((c) => !c);
            }
          }}
        />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <Toaster richColors position="bottom-right" />
      <OfflineBanner />
    </div>
  );
}
