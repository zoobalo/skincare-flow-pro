import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { isAdmin } from "@/lib/auth";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Factory, Boxes, PackageOpen, FlaskConical,
  GitBranch, Truck, Warehouse, FileText, BarChart3, FileBarChart, UserCog, Settings, Sparkles, ListChecks, Beaker, MessageSquareWarning, BookUser, ReceiptText, PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { group: "Overview", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { group: "Products", items: [
    { to: "/skus", label: "SKU Management", icon: Package },
  ]},
  { group: "Work", items: [
    { to: "/tasks",       label: "Task Management", icon: ListChecks },
    { to: "/follow-ups",  label: "Follow Up",        icon: PhoneCall  },
    { to: "/reimburse",   label: "Reimburse",        icon: ReceiptText },
  ]},
  { group: "NPD", items: [
    { to: "/npd", label: "New Product Development", icon: Beaker },
  ]},
  { group: "Procurement", items: [
    { to: "/procurement", label: "Procurement", icon: ShoppingCart },
    { to: "/purchase-orders", label: "Purchase Orders", icon: FileText },
    { to: "/production-remarks", label: "Production Remarks", icon: MessageSquareWarning },
    { to: "/directory", label: "Directory", icon: BookUser },
    { to: "/vendors", label: "Vendors", icon: Users },
    { to: "/manufacturers", label: "Manufacturers", icon: Factory },
  ]},
  { group: "Inventory", items: [
    { to: "/inventory", label: "Inventory", icon: Boxes },
    { to: "/inventory/packaging", label: "Packaging Materials", icon: PackageOpen },
    { to: "/inventory/raw-materials", label: "Raw Materials", icon: FlaskConical },
  ]},
  { group: "Operations", items: [
    { to: "/production", label: "Production Tracking", icon: GitBranch },
    { to: "/logistics", label: "Logistics & Transport", icon: Truck },
    { to: "/warehouse", label: "Warehouse", icon: Warehouse },
  ]},
  { group: "Insights", items: [
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/reports", label: "Reports", icon: FileBarChart },
  ]},
  { group: "Admin", items: [
    { to: "/users", label: "User Management", icon: UserCog, adminOnly: true },
    { to: "/settings", label: "Settings", icon: Settings },
  ]},
] as const;

interface AppSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AppSidebar({ collapsed, mobileOpen, onMobileClose }: AppSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [admin, setAdmin] = useState(false);
  useEffect(() => { setAdmin(isAdmin()); }, []);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-200",
        // Desktop: always visible, width toggles
        "md:sticky md:translate-x-0",
        collapsed ? "md:w-16" : "md:w-60",
        // Mobile: slide in/out
        mobileOpen ? "translate-x-0 w-72 shadow-xl" : "-translate-x-full w-72 md:w-auto",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        {(!collapsed || mobileOpen) && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Zoobalo</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Procurement Suite</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((group) => (
          <div key={group.group} className="mb-3">
            {(!collapsed || mobileOpen) && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.group}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.filter((item) => !("adminOnly" in item && item.adminOnly && !admin)).map((item) => {
                const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onMobileClose}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      title={(collapsed && !mobileOpen) ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {(!collapsed || mobileOpen) && (
        <div className="border-t p-3 text-[10px] text-muted-foreground">
          v1.0 · Demo data
        </div>
      )}
    </aside>
  );
}
