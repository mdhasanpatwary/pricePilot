"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import {
  Bell,
  Search,
  Menu,
  User,
  LogOut,
  Settings,
  CreditCard,
  ChevronDown,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn, formatTimeAgo } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const markAsRead = async (id?: string) => {
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      if (res.ok) {
        if (id) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        } else {
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          setUnreadCount(0);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/v1/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications);
          setUnreadCount(
            data.notifications.filter((n: any) => !n.isRead).length,
          );
        }
      } catch (e) {
        console.error("Failed to fetch notifications");
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Polling every min
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/dashboard/products") return "Products";
    if (pathname === "/dashboard/connections") return "Integrations";
    if (pathname === "/dashboard/competitors") return "Competitors";
    if (pathname.startsWith("/admin")) {
      if (pathname === "/admin") return "Platform Overview";
      if (pathname === "/admin/tenants") return "Tenants (Merchants)";
      if (pathname === "/admin/scrapers") return "Scraper Status";
      if (pathname === "/admin/config") return "Global Config";
      if (pathname === "/admin/settings") return "System Settings";
      return "Admin Console";
    }
    return "Settings";
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SYNC_SUCCESS":
        return {
          icon: CheckCircle2,
          color: "text-success",
          bg: "bg-success/10",
        };
      case "SYNC_ERROR":
        return {
          icon: AlertTriangle,
          color: "text-destructive",
          bg: "bg-destructive/10",
        };
      case "PRICE_ALERT":
        return { icon: Zap, color: "text-primary", bg: "bg-primary/10" };
      default:
        return { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border">
      <div className="flex h-16 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-muted rounded-md transition-all border border-border"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex flex-col">
            <h1 className="text-base font-semibold text-foreground">
              {getPageTitle()}
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-md focus-within:ring-1 focus-within:ring-primary/20 transition-all ml-4">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-sm w-48 font-medium placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-success/5 border border-success/10 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-bold text-success uppercase tracking-wider">
              Live System
            </span>
          </div>

          <ThemeToggle />

          <div className="relative">
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
              }}
              className={cn(
                "p-2 text-muted-foreground hover:text-foreground transition-all relative rounded-md border border-transparent",
                isNotificationsOpen && "bg-muted text-foreground border-border",
              )}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background animate-pulse" />
              )}
            </button>

            {isNotificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsNotificationsOpen(false)}
                />
                <div className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-xl shadow-2xl z-20 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAsRead()}
                        className="text-[10px] font-black uppercase text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => {
                        const {
                          icon: Icon,
                          color,
                          bg,
                        } = getNotificationIcon(n.type);
                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.isRead) markAsRead(n.id);
                              if (n.link) window.location.href = n.link;
                            }}
                            className={cn(
                              "p-4 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0 cursor-pointer group relative",
                              !n.isRead && "bg-primary/5",
                            )}
                          >
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                bg,
                                color,
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold">{n.title}</p>
                              <p className="text-[10px] text-muted-foreground leading-snug">
                                {n.message}
                              </p>
                              <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-tighter">
                                {formatTimeAgo(n.createdAt)}
                              </p>
                            </div>
                            {!n.isRead && (
                              <div className="absolute top-4 right-4 w-1.5 h-1.5 bg-primary rounded-full" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        <p className="text-xs font-medium">
                          No new notifications
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-muted/20 text-center border-t border-border">
                    <Link
                      href="/dashboard/activity"
                      className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                      onClick={() => setIsNotificationsOpen(false)}
                    >
                      View All Intelligence
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <div
              role="button"
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 pl-4 border-l border-border group transition-all",
                isProfileOpen ? "opacity-100" : "hover:opacity-80",
              )}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">
                  {session?.user?.name || "Acme Merchant"}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-black mt-1">
                  Admin
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-border shadow-sm group-hover:border-primary/30 transition-all">
                <Image
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.email || "User"}`}
                  alt="User"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-300",
                  isProfileOpen && "rotate-180",
                )}
              />
            </div>

            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute right-0 mt-3 w-60 bg-card border border-border rounded-xl shadow-2xl z-20 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">
                      Account
                    </p>
                    <p className="text-xs font-bold truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                  <div className="p-2">
                    {[
                      {
                        icon: User,
                        label: "View Profile",
                        href: "/dashboard/settings?tab=general",
                      },
                      {
                        icon: CreditCard,
                        label: "Manage Billing",
                        href: "/dashboard/settings?tab=billing",
                      },
                      {
                        icon: Settings,
                        label: "Global Settings",
                        href: "/dashboard/settings",
                      },
                    ].map((item, i) => (
                      <Link
                        key={i}
                        href={item.href}
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="p-2 border-t border-border bg-muted/10">
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      End Session
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
