"use client";

import { useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Bell, Search, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const getPageTitle = () => {
     if (pathname === "/dashboard") return "Dashboard";
     if (pathname === "/dashboard/reports") return "Products";
     if (pathname === "/dashboard/connections") return "Integrations";
     if (pathname === "/dashboard/competitors") return "Competitors";
     return "Settings";
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border">
      <div className="flex h-16 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-muted rounded-md transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex flex-col">
             <h1 className="text-base font-semibold text-foreground">{getPageTitle()}</h1>
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
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-[10px] font-semibold text-success uppercase tracking-wider">Online</span>
          </div>

          <ThemeToggle />

          <button className="p-2 text-muted-foreground hover:text-foreground transition-all relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full ring-2 ring-background" />
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-border group cursor-pointer">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{session?.user?.name || "Acme Merchant"}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Admin</p>
            </div>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
