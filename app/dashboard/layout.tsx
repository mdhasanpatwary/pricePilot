"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  LineChart,
  Settings,
  LogOut,
  ShieldCheck,
  Database,
  Globe,
  X,
  CheckCircle2,
  History as HistoryIcon,
  Bell,
  Zap,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import Header from "@/components/header";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Package, label: "Products", href: "/dashboard/products" },
  { icon: CheckCircle2, label: "Match Approval", href: "/dashboard/matching" },
  { icon: Copy, label: "Duplicate Detection", href: "/dashboard/duplicates" },
  {
    icon: LineChart,
    label: "Market Intelligence",
    href: "/dashboard/analytics",
  },
  { icon: Users, label: "Competitors", href: "/dashboard/competitors" },
  { icon: Globe, label: "Integrations", href: "/dashboard/connections" },
  { icon: Zap, label: "Pricing Rules", href: "/dashboard/rules" },
  { icon: Bell, label: "Alert Center", href: "/dashboard/alerts" },
  { icon: HistoryIcon, label: "Activity Logs", href: "/dashboard/activity" },
  {
    icon: Database,
    label: "Data & Backups",
    href: "/dashboard/settings/backups",
  },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

import { useSession } from "next-auth/react";

function Sidebar({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose?: () => void;
}) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  const filteredMenuItems = menuItems.filter((item) => {
    // Only admins can see Activity Logs, Rules, and Competitors
    if (session?.user?.role !== "ADMIN") {
      if (
        item.href === "/dashboard/activity" ||
        item.href === "/dashboard/rules" ||
        item.href === "/dashboard/competitors"
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 flex items-center justify-between lg:block">
        <Link
          href={tenantId ? `/dashboard?tenantId=${tenantId}` : "/dashboard"}
          className="flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-all">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">PricePilot</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-muted rounded-md transition-all border border-border"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold uppercase text-muted-foreground/60 tracking-wider mb-2">
          Main Menu
        </p>
        {filteredMenuItems.map((item) => {
          const href = tenantId
            ? `${item.href}?tenantId=${tenantId}`
            : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                pathname === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4",
                  pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all text-sm font-medium group"
        >
          <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          Logout
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="w-64 border-r border-border hidden lg:flex flex-col bg-card">
        <Suspense
          fallback={<div className="w-64 bg-card h-full animate-pulse" />}
        >
          <Sidebar pathname={pathname} />
        </Suspense>
      </aside>

      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-[110] lg:hidden transition-transform duration-300 ease-in-out flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Suspense
          fallback={<div className="w-64 bg-card h-full animate-pulse" />}
        >
          <Sidebar
            pathname={pathname}
            onClose={() => setIsSidebarOpen(false)}
          />
        </Suspense>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
