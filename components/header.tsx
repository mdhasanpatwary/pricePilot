"use client";

import { useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Shield, Bell, Search, Command, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const getPageTitle = () => {
     if (pathname === "/dashboard") return "Intelligence Hub";
     if (pathname === "/dashboard/reports") return "Market Reports";
     if (pathname === "/dashboard/connections") return "Integration Center";
     if (pathname === "/dashboard/competitors") return "Rival Tracking";
     return "Settings";
  }

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/50">
      <div className="flex h-16 md:h-18 2xl:h-20 items-center justify-between px-4 md:px-6 lg:px-8 2xl:px-10">
        <div className="flex items-center gap-3 md:gap-6 lg:gap-8">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-muted rounded-lg transition-all border border-transparent hover:border-border active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/dashboard" className="flex lg:hidden items-center gap-2 group">
             <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center glow transition-transform group-hover:scale-110">
                <Shield className="w-5 h-5 text-white" />
             </div>
             <span className="text-lg font-black tracking-tighter">PricePilot</span>
          </Link>

          <div className="hidden lg:flex flex-col">
             <h1 className="text-lg font-black tracking-tight">{getPageTitle()}</h1>
             <p className="text-[9px] uppercase font-black text-muted-foreground tracking-[0.2em] mt-1 opacity-50">Command Console</p>
          </div>

          <div className="hidden xl:flex items-center gap-3 bg-muted/40 border border-border px-4 py-2 rounded-xl group focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
             <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
             <input
               type="text"
               placeholder="Search..."
               className="bg-transparent border-none outline-none text-xs w-40 xl:w-56 font-medium placeholder:text-muted-foreground/40"
             />
             <div className="flex items-center gap-1 px-1.5 py-0.5 bg-background border border-border rounded-md text-[9px] font-black text-muted-foreground shadow-sm">
                <Command className="w-2.5 h-2.5" /> K
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 lg:gap-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-full shadow-sm">
            <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.05em] text-success">Online</span>
          </div>

          <div className="h-6 w-px bg-border/50 mx-0.5" />

          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />

            <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all relative border border-transparent hover:border-border group active:scale-95 shadow-sm">
              <Bell className="w-5 h-5 transition-transform group-hover:rotate-12" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full ring-2 ring-background" />
            </button>

            <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-3 ml-0.5 border-l border-border/50 group cursor-pointer active:scale-95 transition-all">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black leading-none group-hover:text-primary transition-colors tracking-tight">{session?.user?.name || "Acme Merchant"}</p>
                <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.05em] mt-1 opacity-60">ADMIN</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 p-[1.5px] shadow-lg transition-transform group-hover:scale-105">
                 <div className="w-full h-full rounded-[0.45rem] bg-card flex items-center justify-center text-primary border border-white/10 overflow-hidden relative">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
