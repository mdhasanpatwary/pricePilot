"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Bell,
  Lock,
  Database,
  CreditCard,
  Mail,
  Smartphone,
  Check,
  Zap,
  Code2,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Users,
  UserPlus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const generalSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
});

const securitySchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type GeneralFormValues = z.infer<typeof generalSchema>;
type SecurityFormValues = z.infer<typeof securitySchema>;

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [detectedCurrency, setDetectedCurrency] = useState<string>("USD");
  const [isLoadingCurrency, setIsLoadingCurrency] = useState<boolean>(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    role: "VIEWER",
    password: "",
  });
  const [userPrefs, setUserPrefs] = useState({ emailNotifications: true });
  const [tenantPrefs, setTenantPrefs] = useState({
    slackEnabled: false,
    slackWebhookUrl: "",
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);

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
    },
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

  useEffect(() => {
    const fetchCurrency = async () => {
      setIsLoadingCurrency(true);
      try {
        const res = await fetch("/api/v1/analytics/summary");
        if (res.ok) {
          const data = await res.json();
          if (data?.stats?.currency) setDetectedCurrency(data.stats.currency);
        }
      } catch (e) {
      } finally {
        setIsLoadingCurrency(false);
      }
    };
    fetchCurrency();
  }, []);

  const {
    register: registerSecurity,
    handleSubmit: handleSubmitSecurity,
    reset: resetSecurity,
    formState: { errors: errorsSecurity },
  } = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
  });

  const onGeneralSubmit = (_data: GeneralFormValues) => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      toast.success("Account information updated");
      setIsSaving(false);
    }, 1000);
  };

  const onSecuritySubmit = async (data: SecurityFormValues) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Password updated successfully");
        resetSecurity();
      } else {
        toast.error(result.error || "Failed to update password");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/v1/tenant/sessions");
      if (res.ok) {
        setActiveSessions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to log out this device?")) return;
    try {
      const res = await fetch(`/api/v1/tenant/sessions?id=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Session revoked");
        fetchSessions();
      } else {
        toast.error("Failed to revoke session");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  useEffect(() => {
    if (activeTab === "security") {
      fetchSessions();
    }
  }, [activeTab]);

  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");

  useEffect(() => {
    if (activeTab === "developers") {
      fetchWebhooks();
    }
  }, [activeTab]);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch("/api/v1/webhooks");
      if (res.ok) {
        setWebhooks(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWebhook = async () => {
    if (!newWebhookUrl) {
      toast.error("URL is required");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newWebhookUrl, secret: newWebhookSecret }),
      });

      if (res.ok) {
        toast.success("Webhook endpoint added");
        setNewWebhookUrl("");
        setNewWebhookSecret("");
        setShowAddWebhook(false);
        fetchWebhooks();
      } else {
        toast.error("Failed to add webhook");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Are you sure? This endpoint will no longer receive updates."))
      return;
    try {
      const res = await fetch(`/api/v1/webhooks?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Webhook removed");
        fetchWebhooks();
      }
    } catch (e) {
      toast.error("Failed to remove webhook");
    }
  };

  const fetchTeam = async () => {
    setIsLoadingTeam(true);
    try {
      const res = await fetch("/api/v1/tenant/team?page=1&limit=50");
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.data);
      }
    } catch (err) {
      toast.error("Failed to load team members");
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/tenant/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberForm),
      });

      if (res.ok) {
        toast.success("Team member added");
        setMemberForm({ name: "", email: "", role: "VIEWER", password: "" });
        setShowAddMember(false);
        fetchTeam();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add member");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    try {
      const res = await fetch(`/api/v1/tenant/team?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Member removed");
        fetchTeam();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const fetchPrefs = async () => {
    setIsLoadingPrefs(true);
    try {
      const [uRes, tRes] = await Promise.all([
        fetch("/api/v1/user/notification-preferences"),
        fetch("/api/v1/tenant/notification-settings"),
      ]);

      if (uRes.ok) setUserPrefs(await uRes.json());
      if (tRes.ok) setTenantPrefs(await tRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "notifications") {
      fetchPrefs();
    }
  }, [activeTab]);

  const handleUserPrefToggle = async (field: string, value: boolean) => {
    try {
      const res = await fetch("/api/v1/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setUserPrefs((prev) => ({ ...prev, [field]: value }));
        toast.success("Preference updated");
      }
    } catch (e) {
      toast.error("Failed to update preference");
    }
  };

  const handleTenantPrefUpdate = async (field: string, value: any) => {
    try {
      const res = await fetch("/api/v1/tenant/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tenantPrefs, [field]: value }),
      });
      if (res.ok) {
        setTenantPrefs((prev) => ({ ...prev, [field]: value }));
        toast.success("Settings updated");
      }
    } catch (e) {
      toast.error("Failed to update settings");
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: User },
    { id: "team", label: "Team", icon: Users },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
    { id: "developers", label: "Developers", icon: Code2 },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "system", label: "System", icon: Database },
  ].filter((tab) => {
    // Only admins can see Team, Developers, and System tabs
    if (session?.user?.role !== "ADMIN") {
      return !["team", "developers", "system"].includes(tab.id);
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account preferences and system configuration.
        </p>
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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent",
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
              <form
                onSubmit={handleSubmitGeneral(onGeneralSubmit)}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Account Information</h3>
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                        Profile Name
                      </label>
                      <input
                        {...registerGeneral("name")}
                        type="text"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                          errorsGeneral.name &&
                            "border-destructive focus:ring-destructive/20",
                        )}
                      />
                      {errorsGeneral.name && (
                        <p className="text-xs text-destructive font-bold">
                          {errorsGeneral.name.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                        Contact Email
                      </label>
                      <input
                        {...registerGeneral("email")}
                        type="email"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm",
                          errorsGeneral.email &&
                            "border-destructive focus:ring-destructive/20",
                        )}
                      />
                      {errorsGeneral.email && (
                        <p className="text-xs text-destructive font-bold">
                          {errorsGeneral.email.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-4 rounded-md border border-border bg-muted/20">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Detected Currency
                  </div>
                  <div className="text-sm font-semibold">
                    {isLoadingCurrency ? "Loading..." : detectedCurrency}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Derived from your integrated store configuration. This value
                    is not editable.
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
              <div className="space-y-8 animate-in slide-in-from-bottom-2 relative">
                {isLoadingPrefs && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Loading...
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Personal Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4 p-4 rounded-md border border-border bg-muted/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-background border border-border">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            Email Notifications
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            Receive price alerts and system updates via email.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleUserPrefToggle(
                            "emailNotifications",
                            !userPrefs.emailNotifications,
                          )
                        }
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-colors cursor-pointer",
                          userPrefs.emailNotifications
                            ? "bg-primary"
                            : "bg-muted",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                            userPrefs.emailNotifications
                              ? "right-0.5"
                              : "left-0.5",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {session?.user?.role === "ADMIN" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">Team Integrations</h3>
                      <div
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded font-black uppercase",
                          tenantPrefs.slackEnabled
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900/30 dark:text-zinc-400",
                        )}
                      >
                        {tenantPrefs.slackEnabled ? "Active" : "Disabled"}
                      </div>
                    </div>

                    <div className="space-y-4 p-4 rounded-md border border-border bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-background border border-border">
                            <Zap className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">Slack Alerts</p>
                            <p className="text-[12px] text-muted-foreground">
                              Send real-time alerts to your team Slack channel.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleTenantPrefUpdate(
                              "slackEnabled",
                              !tenantPrefs.slackEnabled,
                            )
                          }
                          className={cn(
                            "w-10 h-5 rounded-full relative transition-colors cursor-pointer",
                            tenantPrefs.slackEnabled
                              ? "bg-primary"
                              : "bg-muted",
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                              tenantPrefs.slackEnabled
                                ? "right-0.5"
                                : "left-0.5",
                            )}
                          />
                        </button>
                      </div>

                      {tenantPrefs.slackEnabled && (
                        <div className="space-y-1.5 pt-4 border-t border-border/50">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                            Slack Webhook URL
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={tenantPrefs.slackWebhookUrl || ""}
                              onChange={(e) =>
                                setTenantPrefs((prev) => ({
                                  ...prev,
                                  slackWebhookUrl: e.target.value,
                                }))
                              }
                              placeholder="https://hooks.slack.com/services/..."
                              className="flex-1 bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                            />
                            <button
                              onClick={() =>
                                handleTenantPrefUpdate(
                                  "slackWebhookUrl",
                                  tenantPrefs.slackWebhookUrl,
                                )
                              }
                              className="bg-primary text-primary-foreground text-xs font-bold px-3 py-2 rounded-md hover:opacity-90 transition-all shadow-sm"
                            >
                              Save
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground italic">
                            Leave empty to use the system default channel.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "security" && (
              <form
                onSubmit={handleSubmitSecurity(onSecuritySubmit)}
                className="space-y-8 animate-in slide-in-from-bottom-2"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Security Settings</h3>
                  <div className="grid gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          {...registerSecurity("currentPassword")}
                          type={showCurrentPassword ? "text" : "password"}
                          className={cn(
                            "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm pr-10",
                            errorsSecurity.currentPassword &&
                              "border-destructive focus:ring-destructive/20",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errorsSecurity.currentPassword && (
                        <p className="text-xs text-destructive font-bold">
                          {errorsSecurity.currentPassword.message}
                        </p>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            {...registerSecurity("newPassword")}
                            type={showNewPassword ? "text" : "password"}
                            className={cn(
                              "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm pr-10",
                              errorsSecurity.newPassword &&
                                "border-destructive focus:ring-destructive/20",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showNewPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {errorsSecurity.newPassword && (
                          <p className="text-xs text-destructive font-bold">
                            {errorsSecurity.newPassword.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            {...registerSecurity("confirmPassword")}
                            type={showConfirmPassword ? "text" : "password"}
                            className={cn(
                              "w-full bg-background border border-border rounded-md py-2 px-3 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm pr-10",
                              errorsSecurity.confirmPassword &&
                                "border-destructive focus:ring-destructive/20",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {errorsSecurity.confirmPassword && (
                          <p className="text-xs text-destructive font-bold">
                            {errorsSecurity.confirmPassword.message}
                          </p>
                        )}
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
                      <p className="text-sm font-bold">
                        Two-Factor Authentication
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Add an extra layer of security to your account.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Enable
                  </button>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">Active Sessions</h3>
                    {isLoadingSessions && (
                      <span className="text-[10px] text-muted-foreground animate-pulse">
                        Refreshing...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can have up to 5 concurrent sessions. Devices used over
                    24 hours ago are automatically logged out.
                  </p>

                  <div className="space-y-3">
                    {activeSessions.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "p-3 rounded-lg border flex items-center justify-between transition-all",
                          s.isCurrent
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/10 border-border",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-1.5 rounded bg-background border border-border",
                              s.isCurrent
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[12px] font-bold">
                                {s.ipAddress || "Unknown IP"}
                              </p>
                              {s.isCurrent && (
                                <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Last used:{" "}
                              {new Date(s.lastUsedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!s.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            className="text-[10px] font-bold text-destructive hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                    {activeSessions.length === 0 && !isLoadingSessions && (
                      <p className="text-center py-4 text-xs text-muted-foreground italic">
                        No active sessions found.
                      </p>
                    )}
                  </div>
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
            {activeTab === "team" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Team Members</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage your employees and their access levels.
                      </p>
                    </div>
                    {session?.user?.role === "ADMIN" && (
                      <button
                        onClick={() => setShowAddMember(true)}
                        className="flex items-center gap-2 p-2 px-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all text-xs font-bold shadow-sm"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Add Member</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {isLoadingTeam ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 border border-border/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Skeleton className="w-8 h-8 rounded-full" />
                              <div className="flex flex-col gap-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-2 w-32" />
                              </div>
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                        ))}
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <div className="text-center py-10 grayscale opacity-40">
                        <Users className="w-10 h-10 mx-auto mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          No members invited yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-muted/10 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                {member.name?.[0] ||
                                  member.email[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">
                                  {member.name || member.email.split("@")[0]}
                                  {member.id === session?.user?.id && (
                                    <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {member.email}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                                  member.role === "ADMIN"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : member.role === "EDITOR"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400",
                                )}
                              >
                                {member.role}
                              </span>
                              {session?.user?.role === "ADMIN" &&
                                member.id !== session?.user?.id && (
                                  <button
                                    onClick={() =>
                                      handleDeleteMember(member.id)
                                    }
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                                    title="Remove member"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {showAddMember && (
                  <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-in fade-in zoom-in-95 shadow-sm">
                    <h4 className="text-sm font-bold">Invite New Employee</h4>
                    <form onSubmit={handleAddMember} className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                            Full Name
                          </label>
                          <input
                            required
                            value={memberForm.name}
                            onChange={(e) =>
                              setMemberForm({
                                ...memberForm,
                                name: e.target.value,
                              })
                            }
                            placeholder="John Doe"
                            className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                            Email Address
                          </label>
                          <input
                            required
                            type="email"
                            value={memberForm.email}
                            onChange={(e) =>
                              setMemberForm({
                                ...memberForm,
                                email: e.target.value,
                              })
                            }
                            placeholder="john@example.com"
                            className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                            Password
                          </label>
                          <input
                            required
                            type="password"
                            value={memberForm.password}
                            onChange={(e) =>
                              setMemberForm({
                                ...memberForm,
                                password: e.target.value,
                              })
                            }
                            placeholder="••••••••"
                            className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                            Role
                          </label>
                          <select
                            value={memberForm.role}
                            onChange={(e) =>
                              setMemberForm({
                                ...memberForm,
                                role: e.target.value,
                              })
                            }
                            className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-all font-bold"
                          >
                            <option value="VIEWER">Viewer (Read Only)</option>
                            <option value="EDITOR">Editor (Manage Data)</option>
                            <option value="ADMIN">Admin (Full Control)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-md hover:opacity-90 transition-all shadow-sm"
                        >
                          {isSaving ? "Adding..." : "Add Member"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddMember(false)}
                          className="flex-1 bg-secondary text-secondary-foreground text-xs font-bold py-2.5 rounded-md border border-border hover:bg-muted transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === "developers" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Outgoing Webhooks</h3>
                      <p className="text-sm text-muted-foreground">
                        Receive real-time notifications when prices change.
                      </p>
                    </div>
                    {session?.user?.role === "ADMIN" && (
                      <button
                        onClick={() => setShowAddWebhook(true)}
                        className="p-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {webhooks.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground bg-muted/5">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No webhooks configured.</p>
                      </div>
                    ) : (
                      webhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className="p-4 rounded-lg border border-border bg-muted/10 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-background border border-border flex items-center justify-center">
                              <Zap className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold truncate max-w-[200px]">
                                {webhook.url}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-success uppercase">
                                  Active
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                  Secret: {webhook.secret ? "••••••••" : "None"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteWebhook(webhook.id)}
                              className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-md opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {showAddWebhook && (
                  <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-in fade-in zoom-in-95">
                    <h4 className="text-sm font-bold">Add New Webhook</h4>
                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Payload URL
                        </label>
                        <input
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          placeholder="https://your-api.com/webhooks"
                          className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Secret (Optional)
                        </label>
                        <input
                          value={newWebhookSecret}
                          onChange={(e) => setNewWebhookSecret(e.target.value)}
                          placeholder="whsec_..."
                          className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleAddWebhook}
                        disabled={isSaving}
                        className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2 rounded-md hover:opacity-90 transition-all"
                      >
                        {isSaving ? "Adding..." : "Add Endpoint"}
                      </button>
                      <button
                        onClick={() => setShowAddWebhook(false)}
                        className="flex-1 bg-secondary text-secondary-foreground text-xs font-bold py-2 rounded-md border border-border hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2">
                {/* Billing content... */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Subscription Plan</h3>
                  <div className="grid gap-4">
                    {[
                      {
                        name: "Starter",
                        price: "$49",
                        features: [
                          "1,000 SKUs",
                          "Daily Scans",
                          "5 Competitors",
                        ],
                        active: false,
                      },
                      {
                        name: "Professional",
                        price: "$149",
                        features: [
                          "10,000 SKUs",
                          "Hourly Scans",
                          "Unlimited Competitors",
                        ],
                        active: true,
                      },
                      {
                        name: "Enterprise",
                        price: "Custom",
                        features: [
                          "Unlimited SKUs",
                          "Real-time Scans",
                          "Custom Integrations",
                        ],
                        active: false,
                      },
                    ].map((plan, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-5 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                          plan.active
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-background border-border hover:border-primary/50",
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              plan.active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {plan.price} / month
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden md:flex items-center gap-4">
                            {plan.features.slice(0, 2).map((f, j) => (
                              <div
                                key={j}
                                className="flex items-center gap-1.5"
                              >
                                <Check className="w-3 h-3 text-success" />
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {f}
                                </span>
                              </div>
                            ))}
                          </div>
                          {plan.active ? (
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                              Current Plan
                            </span>
                          ) : (
                            <button className="text-xs font-bold text-muted-foreground hover:text-foreground">
                              Upgrade
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3">
                  <h4 className="text-sm font-bold text-destructive">
                    Danger Zone
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Once you cancel your subscription, you will lose access to
                    all premium features at the end of your billing cycle.
                  </p>
                  <button className="text-xs font-bold text-destructive hover:underline">
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )}

            {activeTab === "system" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Maintenance & Database</h3>
                  <p className="text-sm text-muted-foreground">
                    Perform system cleaning and data management tasks.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="p-5 rounded-xl border border-border bg-background space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                          <Database className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Clear Market Data</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Deletes all competitor products, matches, and price
                            history. Your integrated products (Source) will
                            remain safe.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              "Are you sure? All competitor matches and history will be lost.",
                            )
                          )
                            return;
                          setIsSaving(true);
                          try {
                            const res = await fetch(
                              "/api/v1/tenant/maintenance",
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  action: "CLEAN_MARKET_DATA",
                                }),
                              },
                            );
                            const data = await res.json();
                            if (res.ok) toast.success(data.message);
                            else toast.error(data.error);
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="text-xs font-bold text-primary hover:bg-primary/5 px-4 py-2 rounded-md border border-primary/20 transition-all disabled:opacity-50"
                      >
                        Clean Matches
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-border bg-background space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Clear Sync Locks</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            If a site synchronization is stuck in
                            &apos;Syncing&apos; status for too long, use this to
                            force reset it.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setIsSaving(true);
                          try {
                            const res = await fetch(
                              "/api/v1/tenant/maintenance",
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  action: "CLEAR_SYNC_LOCKS",
                                }),
                              },
                            );
                            const data = await res.json();
                            if (res.ok) toast.success(data.message);
                            else toast.error(data.error);
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="text-xs font-bold text-primary hover:bg-primary/5 px-4 py-2 rounded-md border border-primary/20 transition-all disabled:opacity-50"
                      >
                        Reset Locks
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                          <Trash2 className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-destructive">
                            Reset All Data (Hard Reset)
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Permanently deletes ALL products, history, and
                            matches. This will leave your account empty like a
                            fresh install.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              "WARNING: This will permanently delete EVERYTHING. You will have to re-sync your stores. Proceed?",
                            )
                          )
                            return;
                          setIsSaving(true);
                          try {
                            const res = await fetch(
                              "/api/v1/tenant/maintenance",
                              {
                                method: "POST",
                                body: JSON.stringify({ action: "RESET_ALL" }),
                              },
                            );
                            const data = await res.json();
                            if (res.ok) toast.success(data.message);
                            else toast.error(data.error);
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="text-xs font-bold text-white bg-destructive hover:bg-destructive/90 px-4 py-2 rounded-md transition-all disabled:opacity-50 shadow-sm"
                      >
                        Reset Everything
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
