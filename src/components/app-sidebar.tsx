import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { isAdmin, getUser, getToken, saveSession } from "@/lib/auth";
import { auth } from "@/lib/api";
import { getGrants, type Grant, SHAREABLE_MODULES } from "@/lib/grants";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Factory, Boxes, PackageOpen, FlaskConical,
  GitBranch, Truck, Warehouse, FileText, BarChart3, FileBarChart, UserCog, Settings, Sparkles, ListChecks, Beaker, MessageSquareWarning, BookUser, ReceiptText, PhoneCall, Palette, ClipboardList, PackageCheck, Link2, Activity, TestTube2, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// "skincare" is the internal key for "Procurement and Operations"
const PROCUREMENT_DEPT = "skincare";

// Routes available to non-procurement departments
const COMMON_ROUTES = new Set(["/tasks", "/follow-ups", "/imp-links", "/courier", "/directory", "/sharing"]);

const DEPT_LABELS: Record<string, string> = {
  skincare:  "Procurement and Operations",
  sales:     "Sales",
  marketing: "Marketing",
  crm:       "CRM",
  creative:  "Creative Department",
  hr:        "HR",
  finance:   "Finance",
  logistics: "Logistics and Inventory",
  d2c:       "D2C",
};

const nav = [
  { group: "Overview", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { group: "Products", items: [
    { to: "/skus", label: "SKU Management", icon: Package },
  ]},
  { group: "Work", items: [
    { to: "/tasks",        label: "Task Management", icon: ListChecks   },
    { to: "/follow-ups",   label: "Follow Up",       icon: PhoneCall    },
    { to: "/artwork",      label: "Artwork",          icon: Palette      },
    { to: "/imp-links",    label: "IMP Links",        icon: Link2        },
    { to: "/mft",          label: "MFT",              icon: ClipboardList},
    { to: "/reimburse",    label: "Reimburse",        icon: ReceiptText  },
    { to: "/courier",      label: "Courier",          icon: PackageCheck },
    { to: "/sku-activity", label: "SKU Activity",     icon: Activity     },
    { to: "/sample",       label: "Sample",            icon: TestTube2    },
  ]},
  { group: "NPD", items: [
    { to: "/npd", label: "New Product Development", icon: Beaker },
  ]},
  { group: "Procurement", items: [
    { to: "/procurement",        label: "Procurement",         icon: ShoppingCart          },
    { to: "/purchase-orders",    label: "Purchase Orders",     icon: FileText              },
    { to: "/production-remarks", label: "Production Remarks",  icon: MessageSquareWarning  },
    { to: "/directory",          label: "Directory",           icon: BookUser              },
    { to: "/vendors",            label: "Vendors",             icon: Users                 },
    { to: "/manufacturers",      label: "Manufacturers",       icon: Factory               },
  ]},
  { group: "Inventory", items: [
    { to: "/inventory",               label: "Inventory",           icon: Boxes       },
    { to: "/inventory/packaging",     label: "Packaging Materials", icon: PackageOpen },
    { to: "/inventory/raw-materials", label: "Raw Materials",       icon: FlaskConical },
  ]},
  { group: "Operations", items: [
    { to: "/production", label: "Production Tracking",  icon: GitBranch },
    { to: "/logistics",  label: "Logistics & Transport", icon: Truck     },
    { to: "/warehouse",  label: "Warehouse",             icon: Warehouse },
  ]},
  { group: "Insights", items: [
    { to: "/analytics", label: "Analytics", icon: BarChart3    },
    { to: "/reports",   label: "Reports",   icon: FileBarChart },
  ]},
  { group: "Admin", items: [
    { to: "/users",   label: "User Management", icon: UserCog, adminOnly: true },
    { to: "/sharing", label: "Sharing",          icon: Share2                   },
    { to: "/settings", label: "Settings",        icon: Settings                 },
  ]},
] as const;

interface SharedSectionProps {
  grants: Grant[];
  collapsed: boolean;
  mobileOpen: boolean;
  pathname: string;
  onMobileClose: () => void;
}

function SharedSection({ grants, collapsed, mobileOpen, pathname, onMobileClose }: SharedSectionProps) {
  const moduleMap = Object.fromEntries(SHAREABLE_MODULES.map((m) => [m.key, m]));
  const currentSharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId");
  return (
    <div className="mb-3">
      {(!collapsed || mobileOpen) && (
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shared with me</p>
      )}
      <ul className="space-y-0.5">
        {grants.map((grant) => {
          const mod = moduleMap[grant.module];
          if (!mod) return null;
          const to = `${mod.to}?sharedTeamId=${encodeURIComponent(grant.ownerTeamId)}`;
          const active = pathname.startsWith(mod.to) && currentSharedTeamId === grant.ownerTeamId;
          return (
            <li key={grant.id}>
              <a
                href={to}
                onClick={(e) => { e.preventDefault(); window.location.href = to; onMobileClose(); }}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={(collapsed && !mobileOpen) ? `${mod.label} (${grant.ownerTeamName})` : undefined}
              >
                <Share2 className="h-4 w-4 shrink-0 opacity-70" />
                {(!collapsed || mobileOpen) && (
                  <span className="truncate flex-1">{mod.label}</span>
                )}
                {(!collapsed || mobileOpen) && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wide">shared</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface AppSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AppSidebar({ collapsed, mobileOpen, onMobileClose }: AppSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [admin, setAdmin] = useState(false);
  const [dept,  setDept]  = useState<string | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[]>([]);

  useEffect(() => {
    setAdmin(isAdmin());
    setGrants(getGrants());
    const stored = getUser();
    if (stored?.department) {
      setDept(stored.department);
    } else if (getToken()) {
      // Old session without department stored — refresh from API once
      auth.me().then((me) => {
        if (me?.department && !me.error) {
          setDept(me.department);
          saveSession(getToken()!, { id: me.id, name: me.name, email: me.email, role: me.role, department: me.department });
        }
      }).catch(() => {});
    }
  }, []);

  // Only Procurement and Operations (skincare) sees all tabs; everyone else gets 5 common tabs
  const isProcurement = dept === PROCUREMENT_DEPT;

  const isVisible = (item: { to: string; adminOnly?: boolean }) => {
    if ("adminOnly" in item && item.adminOnly && !admin) return false;
    // Admins see everything
    if (admin) return true;
    // Procurement and Operations sees everything
    if (isProcurement) return true;
    // All other departments: only the 5 common tabs + Settings
    return COMMON_ROUTES.has(item.to) || item.to === "/settings";
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-200",
        "md:sticky md:translate-x-0",
        collapsed ? "md:w-16" : "md:w-60",
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
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {DEPT_LABELS[dept ?? ""] ?? "Procurement Suite"}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (!visibleItems.length) return null;
          return (
            <div key={group.group} className="mb-3">
              {(!collapsed || mobileOpen) && (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.group}</p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
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
          );
        })}

        {/* ── Shared access from other teams ── */}
        {Array.isArray(grants) && grants.length > 0 && (
          <SharedSection
            grants={grants}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            pathname={pathname}
            onMobileClose={onMobileClose}
          />
        )}
      </nav>

      {(!collapsed || mobileOpen) && (
        <div className="border-t p-3 text-[10px] text-muted-foreground">
          v1.0 · {DEPT_LABELS[dept ?? ""] ?? ""}
        </div>
      )}
    </aside>
  );
}
