"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Bell,
  Lock,
  Shield,
  Database,
  CreditCard,
  Mail,
  Smartphone,
  Check,
  Zap,
  CreditCard as BillingIcon,
  ShieldCheck,
  Key
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const generalSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
});

const securitySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type GeneralFormValues = z.infer<typeof generalSchema>;
type SecurityFormValues = z.infer<typeof securitySchema>;

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  const {
    register: registerGeneral,
    handleSubmit: handleSubmitGeneral,
    reset: resetGeneral,
    formState: { errors: errorsGeneral },
  } = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: "",
      email: "",
    }
  });

  // Sync session data with form
  useEffect(() => {
    if (session?.user) {
      resetGeneral({
        name: session.user.name || "",
        email: session.user.email || "",
      });
    }
  }, [session, resetGeneral]);

  const {
    register: registerSecurity,
    handleSubmit: handleSubmitSecurity,
    reset: resetSecurity,
    formState: { errors: errorsSecurity },
  } = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
  });

  const onGeneralSubmit = (data: GeneralFormValues) => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      toast.success("Account information updated");
      setIsSaving(false);
    }, 1000);
  };

  const onSecuritySubmit = (data: SecurityFormValues) => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      toast.success("Security settings updated");
      resetSecurity();
      setIsSaving(false);
    }, 1000);
  };

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
              <form onSubmit={handleSubmitGeneral(onGeneralSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Account Information</h3>
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Profile Name</label>
                      <input
                        {...registerGeneral("name")}
                        type="text"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                          errorsGeneral.name && "border-destructive focus:ring-destructive/20"
                        )}
                      />
                      {errorsGeneral.name && <p className="text-xs text-destructive font-bold">{errorsGeneral.name.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Contact Email</label>
                      <input
                        {...registerGeneral("email")}
                        type="email"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                          errorsGeneral.email && "border-destructive focus:ring-destructive/20"
                        )}
                      />
                      {errorsGeneral.email && <p className="text-xs text-destructive font-bold">{errorsGeneral.email.message}</p>}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-md hover:opacity-90 transition-all disabled:opacity-70"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
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

            {activeTab === "security" && (
              <form onSubmit={handleSubmitSecurity(onSecuritySubmit)} className="space-y-8 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Security Settings</h3>
                  <div className="grid gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Current Password</label>
                      <input
                        {...registerSecurity("currentPassword")}
                        type="password"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                          errorsSecurity.currentPassword && "border-destructive focus:ring-destructive/20"
                        )}
                      />
                      {errorsSecurity.currentPassword && <p className="text-xs text-destructive font-bold">{errorsSecurity.currentPassword.message}</p>}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">New Password</label>
                        <input
                          {...registerSecurity("newPassword")}
                          type="password"
                          className={cn(
                            "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                            errorsSecurity.newPassword && "border-destructive focus:ring-destructive/20"
                          )}
                        />
                        {errorsSecurity.newPassword && <p className="text-xs text-destructive font-bold">{errorsSecurity.newPassword.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Confirm Password</label>
                        <input
                          {...registerSecurity("confirmPassword")}
                          type="password"
                          className={cn(
                            "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                            errorsSecurity.confirmPassword && "border-destructive focus:ring-destructive/20"
                          )}
                        />
                        {errorsSecurity.confirmPassword && <p className="text-xs text-destructive font-bold">{errorsSecurity.confirmPassword.message}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-background border border-border">
                         <Smartphone className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                         <p className="text-sm font-bold">Two-Factor Authentication</p>
                         <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                      </div>
                   </div>
                   <button type="button" className="text-xs font-bold text-primary hover:underline">Enable</button>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-md hover:opacity-90 transition-all disabled:opacity-70"
                  >
                    {isSaving ? "Updating..." : "Update Security"}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "billing" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Subscription Plan</h3>
                  <div className="grid gap-4">
                    {[
                      { name: "Starter", price: "$49", features: ["1,000 SKUs", "Daily Scans", "5 Competitors"], active: false },
                      { name: "Professional", price: "$149", features: ["10,000 SKUs", "Hourly Scans", "Unlimited Competitors"], active: true },
                      { name: "Enterprise", price: "Custom", features: ["Unlimited SKUs", "Real-time Scans", "Custom Integrations"], active: false },
                    ].map((plan, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-5 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                          plan.active
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-background border-border hover:border-primary/50"
                        )}
                      >
                         <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              plan.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                               <Zap className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="text-sm font-bold">{plan.name}</p>
                               <p className="text-xs text-muted-foreground">{plan.price} / month</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-6">
                            <div className="hidden md:flex items-center gap-4">
                               {plan.features.slice(0, 2).map((f, j) => (
                                 <div key={j} className="flex items-center gap-1.5">
                                    <Check className="w-3 h-3 text-success" />
                                    <span className="text-[10px] font-medium text-muted-foreground">{f}</span>
                                 </div>
                               ))}
                            </div>
                            {plan.active ? (
                              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Current Plan</span>
                            ) : (
                              <button className="text-xs font-bold text-muted-foreground hover:text-foreground">Upgrade</button>
                            )}
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3">
                   <h4 className="text-sm font-bold text-destructive">Danger Zone</h4>
                   <p className="text-xs text-muted-foreground">Once you cancel your subscription, you will lose access to all premium features at the end of your billing cycle.</p>
                   <button className="text-xs font-bold text-destructive hover:underline">Cancel Subscription</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
