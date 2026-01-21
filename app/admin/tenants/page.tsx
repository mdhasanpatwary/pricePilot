"use client";

import { useState, useEffect } from "react";
import {
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function TenantsPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: "",
    planType: "BASIC",
    storeLimit: 1,
    competitorLimit: 3,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchTenants();
  }, []);

  const [authError, setAuthError] = useState(false);

  const fetchTenants = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    setAuthError(false);

    try {
      const res = await fetch("/api/v1/admin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      } else if (res.status === 401) {
        setAuthError(true);
        setTenants([]);
      }
    } catch (err) {
      console.error("Failed to load tenants");
      setTenants([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        // Refresh full list to get all proper counts and emails
        await fetchTenants(true);
        setIsCreateModalOpen(false);
        setCreateForm({
          name: "",
          planType: "BASIC",
          storeLimit: 1,
          competitorLimit: 3,
        });
      }
    } catch (err) {
      console.error("Failed to create tenant");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/tenants?id=${tenantToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTenants(tenants.filter((t) => t.id !== tenantToDelete.id));
        setTenantToDelete(null);
      }
    } catch (err) {
      console.error("Failed to delete tenant");
    } finally {
      setIsDeleting(false);
    }
  };

  const updateTenantField = async (id: string, field: string, value: any) => {
    setUpdatingId(`${id}-${field}`);
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
      if (res.ok) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, [field === "planType" ? "plan" : field]: value }
              : t,
          ),
        );
      }
    } catch (err) {
      console.error(`Failed to update ${field}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesTab =
      activeTab === "ALL" ||
      (t.plan && t.plan.toUpperCase() === activeTab.toUpperCase());
    const matchesSearch =
      (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-xs text-muted-foreground font-medium">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20 font-sans">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage organizations and resource allocation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTenants(true)}
            className={cn(
              "p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors",
              isRefreshing && "opacity-50",
            )}
            disabled={isRefreshing}
            title="Refresh Data"
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 text-muted-foreground",
                isRefreshing && "animate-spin",
              )}
            />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            title="Create New Organization"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tenant</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Simple Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
          {["ALL", "BASIC", "PREMIUM", "PRO"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium capitalize transition-all",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-input rounded-md py-1.5 pl-9 pr-3 text-sm focus:border-ring focus:ring-0 outline-none transition-all placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {authError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="w-5 h-5" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold uppercase tracking-tight">
              Access Denied (401)
            </p>
            <p className="text-xs opacity-90">
              Your session might have expired or you don&apos;t have super-admin
              permissions. Please try logging in again.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto bg-destructive text-destructive-foreground px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-destructive/90 transition-colors"
          >
            Re-verify session
          </button>
        </div>
      )}

      {/* Clean Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground w-[250px]">
                  Organization
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Allocation (Limit)
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Current Usage
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="px-6 py-3 text-right font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedTenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="group hover:bg-muted/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {tenant.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tenant.email}
                      </span>
                    </div>
                  </td>

                  {/* Limits */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-muted-foreground font-medium">
                          Stores
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            defaultValue={tenant.storeLimit}
                            onBlur={(e) =>
                              updateTenantField(
                                tenant.id,
                                "storeLimit",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-16 bg-muted border border-input rounded px-2 py-1 text-xs text-center focus:border-ring outline-none transition-all"
                            title="Update store limit"
                          />
                          {updatingId === `${tenant.id}-storeLimit` && (
                            <div className="absolute right-1 top-1.5 w-2 h-2 rounded-full border border-primary border-t-transparent animate-spin" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-muted-foreground font-medium">
                          Comp
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            defaultValue={tenant.competitorLimit}
                            onBlur={(e) =>
                              updateTenantField(
                                tenant.id,
                                "competitorLimit",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-16 bg-muted border border-input rounded px-2 py-1 text-xs text-center focus:border-ring outline-none transition-all"
                            title="Update competitor limit"
                          />
                          {updatingId === `${tenant.id}-competitorLimit` && (
                            <div className="absolute right-1 top-1.5 w-2 h-2 rounded-full border border-primary border-t-transparent animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Usage */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-3 w-40">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground">
                          <span>Stores</span>
                          <span className="text-foreground">
                            {tenant.activeStores}/{tenant.storeLimit}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              tenant.activeStores / tenant.storeLimit >= 0.9
                                ? "bg-destructive/80"
                                : "bg-primary/70",
                            )}
                            style={{
                              width: `${Math.min((tenant.activeStores / tenant.storeLimit) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground">
                          <span>Competitors</span>
                          <span className="text-foreground">
                            {tenant.activeCompetitors}/{tenant.competitorLimit}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              tenant.activeCompetitors /
                                tenant.competitorLimit >=
                                0.9
                                ? "bg-destructive/80"
                                : "bg-primary/70",
                            )}
                            style={{
                              width: `${Math.min((tenant.activeCompetitors / tenant.competitorLimit) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={tenant.plan}
                        onChange={(e) =>
                          updateTenantField(
                            tenant.id,
                            "planType",
                            e.target.value,
                          )
                        }
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-transparent outline-none cursor-pointer hover:bg-muted/50 transition-colors",
                          tenant.plan === "PRO"
                            ? "text-primary border-primary/20"
                            : tenant.plan === "PREMIUM"
                              ? "text-amber-500 border-amber-500/20"
                              : "text-foreground border-border",
                        )}
                        title="Change Pricing Plan"
                      >
                        <option value="BASIC">BASIC</option>
                        <option value="PREMIUM">PREMIUM</option>
                        <option value="PRO">PRO</option>
                      </select>
                      {updatingId === `${tenant.id}-planType` && (
                        <div className="w-3 h-3 border border-primary border-t-transparent animate-spin rounded-full" />
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                      {tenant.storeUrl && (
                        <a
                          href={tenant.storeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:text-foreground hover:bg-muted rounded-md transition-all"
                          title={`Visit Partner Store: ${tenant.storeUrl}`}
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                      <Link
                        href={`/dashboard?tenantId=${tenant.id}`}
                        className="p-1.5 hover:text-foreground hover:bg-muted rounded-md transition-all"
                        title="Launch Partner Dashboard (Impersonate)"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setTenantToDelete(tenant)}
                        className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                        title="Archive/Delete Tenant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedTenants.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Search className="w-6 h-6 opacity-30" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold">
                          No tenants found
                        </p>
                        <p className="text-xs">
                          Adjust your search or filters to find what you&apos;re
                          looking for.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Showing {paginatedTenants.length} of {filteredTenants.length}{" "}
            results
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-input rounded-md bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Go to previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center text-xs font-medium rounded-md transition-all",
                      currentPage === page
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                    title={`Page ${page}`}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 border border-input rounded-md bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Go to next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Create New Tenant
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleCreateTenant}
              className="p-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Company Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Pricing Plan
                </label>
                <select
                  value={createForm.planType}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, planType: e.target.value })
                  }
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="BASIC">Basic</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="PRO">Pro</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Store Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.storeLimit}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        storeLimit: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Comp. Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.competitorLimit}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        competitorLimit: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={isCreating}
                  type="submit"
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                >
                  {isCreating ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-sm border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Delete Tenant?
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete{" "}
                <span className="font-bold text-foreground">
                  {tenantToDelete.name}
                </span>
                ? This action cannot be undone and all associated data will be
                removed.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTenantToDelete(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTenant}
                  disabled={isDeleting}
                  className="flex-1 bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                >
                  {isDeleting && (
                    <div className="w-4 h-4 border-2 border-destructive-foreground border-t-transparent animate-spin rounded-full" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
