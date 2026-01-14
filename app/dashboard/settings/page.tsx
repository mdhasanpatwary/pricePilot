"use client";

import { useState } from "react";
import {
  User,
  Bell,
  Lock,
  Shield,
  Database,
  CreditCard,
  Mail,
  Smartphone,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: "General", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">Manage your account preferences and system configuration.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <aside className="lg:w-64 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 max-w-2xl">
          <div className="bg-card border border-border rounded-lg p-6 md:p-8 space-y-8">
            {activeTab === "general" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Account Information</h3>
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Profile Name</label>
                      <input
                        type="text"
                        defaultValue="Felix Agent"
                        className="w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Contact Email</label>
                      <input
                        type="email"
                        defaultValue="felix@pricepilot.ai"
                        className="w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <button className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-md hover:opacity-90 transition-all">
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold">Notification Preferences</h3>
                <div className="space-y-4">
                  {[
                    { label: "Price Alerts", desc: "Get notified when a competitor changes prices.", icon: Mail },
                    { label: "Inventory Updates", desc: "Weekly summaries of stock movements.", icon: Database },
                    { label: "Security Events", desc: "Immediate alerts for new login sessions.", icon: Shield },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 p-4 rounded-md border border-border bg-muted/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-background border border-border">
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{item.label}</p>
                          <p className="text-[12px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <div className="w-10 h-5 bg-primary/20 rounded-full relative cursor-pointer">
                        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-primary rounded-full shadow-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab !== "general" && activeTab !== "notifications" && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Database className="w-6 h-6 text-muted-foreground opacity-20" />
                </div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Section under development</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
