"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import Header from "@/components/header";

const menuItems = [
  { icon: LayoutDashboard, label: "Intelligence Hub", href: "/dashboard", short: "Hub" },
  { icon: Link2, label: "Integration Center", href: "/dashboard/connections", short: "Links" },
  { icon: Users, label: "Rival Tracking", href: "/dashboard/competitors", short: "Rivals" },
  { icon: BarChart3, label: "Market Reports", href: "/dashboard/reports", short: "Data" },
  { icon: Settings, label: "Console Config", href: "/dashboard/settings", short: "Settings" },
];

function Sidebar({
  pathname,
  onClose
}: {
  pathname: string;
  onClose?: () => void
}) {
  return (
    <>
      {/* Glow Effects */}
      <div className="absolute top-[-50px] left-[-50px] w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-50px] right-[-50px] w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="p-8 relative z-10 flex items-center justify-between lg:block">
        <Link href="/dashboard" className="flex items-center gap-4 group/logo">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow transition-all group-hover/logo:scale-105 group-hover/logo:rotate-6">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-tighter leading-none">PricePilot</span>
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1.5 opacity-40">Command Console</span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2.5 hover:bg-muted rounded-xl transition-all border border-border"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 px-4 space-y-10 mt-2 relative z-10 overflow-y-auto">
        <div className="space-y-2">
          <p className="px-5 text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em] mb-5 opacity-40">Main Hub</p>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-400 relative overflow-hidden group/item",
                pathname === item.href
                  ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-4">
                <item.icon className={cn(
                  "w-5 h-5 transition-all duration-500",
                  pathname === item.href ? "text-white scale-110" : "group-hover/item:text-primary group-hover/item:scale-110"
                )} />
                <span className="font-black tracking-tight text-xs uppercase tracking-wide">{item.label}</span>
              </div>
              {pathname === item.href && (
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          ))}
        </div>

        <div className="px-1.5">
           <div className="p-7 rounded-[2.5rem] bg-gradient-to-br from-muted/40 to-muted/80 border border-border flex flex-col items-center text-center space-y-6 group/card hover:bg-muted transition-all duration-500 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover/card:bg-primary/10 transition-colors" />
              <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center glow transition-transform group-hover/card:scale-110 group-hover/card:rotate-12">
                 <Zap className="w-7 h-7 text-primary fill-primary/20" />
              </div>
              <div className="space-y-2">
                 <p className="text-sm font-black tracking-tight uppercase tracking-wider">Pro Edition</p>
                 <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.05em] leading-relaxed opacity-60">Scaling reach with <br /> 10k monthly syncs.</p>
              </div>
              <button className="w-full py-3.5 rounded-2xl bg-background border border-border text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm active:scale-95 leading-none">Console Plan</button>
           </div>
        </div>
      </div>

      <div className="p-6 mt-auto space-y-2 relative z-10 border-t border-border/40">
        <button className="flex items-center gap-5 px-6 py-4 w-full rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all font-black tracking-tight text-[10px] uppercase tracking-[0.2em] opacity-70 hover:opacity-100">
          <HelpCircle className="w-5 h-5" />
          Terminal Help
        </button>

        <button
          onClick={() => signOut()}
          className="flex items-center gap-5 px-6 py-5 w-full rounded-2xl bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all font-black tracking-tight text-[10px] uppercase tracking-[0.2em] group/logout border border-transparent hover:border-destructive/20"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          End Session
        </button>
      </div>
    </>
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
    <div className="flex h-screen bg-background text-foreground selection:bg-primary selection:text-white relative overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="w-[280px] border-r border-border hidden lg:flex flex-col bg-card/40 backdrop-blur-xl relative overflow-hidden group/sidebar">
        <Sidebar pathname={pathname} />
      </aside>


      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-md z-[100] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-[280px] bg-card border-r border-border z-[110] lg:hidden transition-transform duration-500 ease-in-out flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar pathname={pathname} onClose={() => setIsSidebarOpen(false)} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/30">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
