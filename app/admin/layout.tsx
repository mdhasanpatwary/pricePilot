"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ShieldCheck,
  Building2,
  Database,
  Settings2,
  LogOut,
  X,
  Lock,
  ChevronDown,
  Settings,
  Activity,
  Menu,
  ArrowLeft,
  FileText,
  Bug,
  RefreshCw,
  ActivitySquare,
  CalendarClock,
  HeartPulse,
  Microscope,
  Eye,
  EyeOff,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const adminMenuItems = [
  { icon: Activity, label: "Platform Overview", href: "/admin" },
  { icon: Building2, label: "Tenants (Merchants)", href: "/admin/tenants" },
  {
    icon: Database,
    label: "Scraping Engine",
    href: "/admin/scrapers", // Default link if clicked
    children: [
      { label: "System Status", href: "/admin/scrapers", icon: Database },
      { label: "Engine Health", href: "/admin/health", icon: HeartPulse },
      { label: "Live Monitor", href: "/admin/monitor", icon: RefreshCw },
      {
        label: "Profiles & Proxy",
        href: "/admin/scraper-profiles",
        icon: Settings,
      },
      { label: "Engine Playground", href: "/admin/playground", icon: Bug },
    ],
  },
  { icon: Microscope, label: "Audit Search", href: "/admin/audit" },
  { icon: ActivitySquare, label: "Diagnostics", href: "/admin/diagnostics" },
  {
    icon: Settings2,
    label: "Business Setup (Logic)",
    href: "/admin/business-setup",
  },
  { icon: CalendarClock, label: "Task Scheduler", href: "/admin/scheduler" },
];

const secondaryMenuItems = [
  { icon: ArrowLeft, label: "Back to Dashboard", href: "/dashboard" },
  { icon: FileText, label: "Documentation", href: "/docs" },
];

function AdminSidebar({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose?: () => void;
}) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Auto-expand menus that contain the active path
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedMenus((prev) => {
      const toAdd: string[] = [];
      adminMenuItems.forEach((item) => {
        if (
          item.children?.some((child) => pathname === child.href) &&
          !prev.includes(item.label)
        ) {
          toAdd.push(item.label);
        }
      });
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
  }, [pathname]);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="h-16 px-6 flex items-center border-b border-border">
        <Link href="/admin" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-foreground" />
          <span className="font-semibold text-sm tracking-tight text-foreground">
            PricePilot Admin
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="ml-auto lg:hidden">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Platform
        </div>
        {adminMenuItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isChildActive =
            hasChildren &&
            item.children!.some((child) => pathname === child.href);
          const isExpanded = expandedMenus.includes(item.label);

          return (
            <div key={item.label} className="space-y-1">
              {hasChildren ? (
                <>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors text-sm",
                      isChildActive
                        ? "bg-muted/30 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={cn(
                          "w-4 h-4",
                          isChildActive
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform duration-200",
                        isExpanded ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </button>

                  <div
                    className={cn(
                      "pl-9 pr-2 space-y-1 overflow-hidden transition-all duration-300",
                      isExpanded
                        ? "max-h-64 opacity-100 mt-1"
                        : "max-h-0 opacity-0",
                    )}
                  >
                    {item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={cn(
                          "block px-3 py-1.5 rounded-md transition-colors text-xs",
                          pathname === child.href
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <Link
                  href={item.href!}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                    pathname === item.href
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4",
                      pathname === item.href
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              )}
            </div>
          );
        })}

        <div className="mt-6 mb-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Quick Links
        </div>
        {secondaryMenuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <item.icon className="w-4 h-4 text-muted-foreground" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
            A
          </div>
          <div className="text-xs">
            <p className="font-medium text-foreground">Admin</p>
            <p className="text-muted-foreground">Super User</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 px-2 py-1.5 w-full rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs font-medium"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  // Check session storage on mount
  useEffect(() => {
    const verified = sessionStorage.getItem("pp_admin_verified");
    if (verified === "true") {
      setIsVerified(true);
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/admin/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });

      if (res.ok) {
        setIsVerified(true);
        sessionStorage.setItem("pp_admin_verified", "true");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid code");
      }
    } catch (err) {
      setError("Connection failed");
    } finally {
      setIsVerifying(false);
    }
  };

  // Authentication & Authorization check
  if (status === "loading") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-center p-6 font-sans">
        <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Login Required
        </h1>
        <p className="text-sm text-zinc-500 max-w-sm mb-6">
          Please login to your account to access the administrative area.
        </p>
        <button
          onClick={() => router.push("/auth/login")}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Secondary verification screen (ENV Code)
  if (!isVerified) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-4">
              <Lock className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Admin Access
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Enter your administrative key
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1">
              <div className="relative">
                <input
                  type={showAdminCode ? "text" : "password"}
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="••••••••••••"
                  className={cn(
                    "w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md py-2 pl-3 pr-10 text-center text-sm font-medium outline-none focus:border-zinc-400 transition-all placeholder:text-zinc-300",
                    error && "border-red-300 focus:border-red-300",
                  )}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAdminCode(!showAdminCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  {showAdminCode ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {error && (
                <p className="text-xs text-red-600 text-center">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying || !adminCode}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isVerifying ? "Verifying..." : "Verify Access"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      {/* Sidebar - Desktop */}
      <aside className="w-64 border-r border-border hidden lg:flex flex-col bg-card z-30">
        <AdminSidebar pathname={pathname} />
      </aside>

      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-[110] lg:hidden transition-transform duration-200",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <AdminSidebar
          pathname={pathname}
          onClose={() => setIsSidebarOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 hover:bg-muted rounded-sm"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <h1 className="text-sm font-semibold text-foreground">
              {adminMenuItems.find((m) => m.href === pathname)?.label ||
                "Admin"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
              Production
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
