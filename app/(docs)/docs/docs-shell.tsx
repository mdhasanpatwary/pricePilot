"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Puzzle,
  Zap,
  Code,
  HelpCircle,
  Menu,
  X,
  Search,
} from "lucide-react";
import { useState } from "react";

const sidebarLinks = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      { name: "Introduction", href: "/docs" },
      { name: "Quick Start", href: "/docs/quickstart" },
      { name: "Installation", href: "/docs/installation" },
    ],
  },
  {
    title: "Integrations",
    icon: Puzzle,
    items: [
      { name: "Laravel", href: "/docs/laravel" },
      { name: "WooCommerce", href: "/docs/woocommerce", badge: "Soon" },
      { name: "Shopify", href: "/docs/shopify", badge: "Soon" },
    ],
  },
  {
    title: "API Reference",
    icon: Code,
    items: [
      { name: "Overview", href: "/docs/api" },
      { name: "Authentication", href: "/docs/api/auth" },
      { name: "Endpoints", href: "/docs/api/endpoints" },
      { name: "Errors", href: "/docs/api/errors" },
    ],
  },
  {
    title: "Features",
    icon: Zap,
    items: [
      { name: "Product Sync", href: "/docs/features/sync", badge: "Soon" },
      { name: "Pricing Rules", href: "/docs/features/rules", badge: "Soon" },
      { name: "Analytics", href: "/docs/features/analytics", badge: "Soon" },
    ],
  },
  {
    title: "Support",
    icon: HelpCircle,
    items: [
      { name: "FAQ", href: "/docs/faq" },
      { name: "Troubleshooting", href: "/docs/troubleshooting", badge: "Soon" },
      { name: "Contact", href: "/docs/contact", badge: "Soon" },
    ],
  },
];

export default function DocsLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen w-full bg-background selection:bg-primary/10">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
        <div className="container flex h-14 items-center justify-between max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center space-x-2.5">
              <span className="font-bold tracking-tight text-foreground uppercase border-r border-border pr-2.5 mr-0.5">
                PricePilot
              </span>
              <span className="text-xs font-semibold text-muted-foreground pt-0.5">
                Docs
              </span>
            </Link>

            <div className="hidden lg:flex items-center border border-border bg-muted/30 rounded-md px-3 py-1.5 w-64 group hover:bg-muted/50 transition-colors">
              <Search className="w-3.5 h-3.5 text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">
                Search documentation...
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground/50 border border-border rounded px-1">
                ⌘K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/dashboard"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/support"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Support
              </Link>
            </nav>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 container max-w-[1400px] mx-auto px-4 md:px-6">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-0 top-14 z-30 flex-shrink-0 w-64 border-r border-border bg-background transition-transform md:sticky md:block md:translate-x-0 overflow-y-auto pt-8 pb-10 pr-4",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="space-y-7">
            {sidebarLinks.map((section) => (
              <div key={section.title} className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/70 px-3">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.badge ? "#" : item.href}
                      onClick={(e) => {
                        if (item.badge) {
                          e.preventDefault();
                          return;
                        }
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between group px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                        pathname === item.href
                          ? "bg-muted text-primary"
                          : item.badge
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {item.name}
                        {item.badge && (
                          <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/40 italic">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 py-10 md:px-10 lg:px-14 w-full max-w-[850px] mx-auto">
          {children}
        </main>

        {/* Right Sidebar (Table of Contents) */}
        <aside className="hidden xl:block w-56 flex-shrink-0 py-10 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-l border-border pl-6">
          <div className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">
              On this page
            </p>
            <div className="space-y-1.5 text-[13px] font-medium text-muted-foreground">
              <p className="text-primary border-l border-primary pl-3 py-0.5">
                Introduction
              </p>
              <p className="pl-3 py-0.5 hover:text-foreground transition-colors cursor-pointer border-l border-transparent">
                Platform Overview
              </p>
              <p className="pl-3 py-0.5 hover:text-foreground transition-colors cursor-pointer border-l border-transparent">
                Key Concepts
              </p>
              <p className="pl-3 py-0.5 hover:text-foreground transition-colors cursor-pointer border-l border-transparent">
                Architecture
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
