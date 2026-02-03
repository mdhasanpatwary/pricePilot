"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  X,
  AlertTriangle,
  Shield,
  User,
  Building2,
  Mail,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";

export default function UsersManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    role: "VIEWER",
    password: "",
  });

  // State trigger for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUsers = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      try {
        const url = `/api/v1/admin/users?page=${currentPage}&limit=${itemsPerPage}${searchQuery ? `&search=${searchQuery}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const result = await res.json();
          setUsers(result.data);
          setMeta(result.meta);
        }
      } catch (err) {
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentPage, searchQuery, itemsPerPage],
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userToEdit.id,
          ...editForm,
        }),
      });
      if (res.ok) {
        toast.success("User updated successfully");
        fetchUsers(true);
        setUserToEdit(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update user");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/users?id=${userToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("User deleted");
        setUsers(users.filter((u) => u.id !== userToDelete.id));
        setUserToDelete(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Frontend search filter for instant response (optional, now that we have backend filtering)
  const paginatedUsers = users;
  const totalPages = meta.totalPages;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-xs text-muted-foreground font-medium">
            Loading users...
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
            Universal Users Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor and take action on every user account across the platform.
          </p>
        </div>
        <button
          onClick={() => fetchUsers(true)}
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
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {meta.totalCount} Total Accounts
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow>
                <TableHead className="px-6 py-4 font-bold text-muted-foreground">
                  User
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-muted-foreground">
                  Organization
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-muted-foreground text-center">
                  Sessions
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-muted-foreground">
                  Joined
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-muted-foreground text-right w-25">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {paginatedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">
                          {user.name || "Unnamed User"}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium text-xs">
                        {user.tenantName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded border shadow-sm",
                        user.role === "ADMIN"
                          ? "bg-primary/5 text-primary border-primary/20"
                          : user.role === "EDITOR"
                            ? "bg-amber-500/5 text-amber-600 border-amber-200"
                            : "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {user.role}
                    </span>
                    {user.isSuperAdmin && (
                      <span className="ml-2 text-[10px] font-black text-white bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded uppercase tracking-tighter">
                        Super
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            user.activeSessions > 0
                              ? "bg-success animate-pulse"
                              : "bg-muted",
                          )}
                        />
                        <span className="font-bold text-xs">
                          {user.activeSessions}
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                        <Smartphone className="w-2.5 h-2.5" />
                        Devices
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setUserToEdit(user);
                          setEditForm({
                            name: user.name || "",
                            role: user.role,
                            password: "",
                          });
                        }}
                        className="p-1.5 hover:bg-muted border border-transparent hover:border-border rounded-md transition-all text-muted-foreground hover:text-foreground"
                        title="Edit User"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      {!user.isSuperAdmin && (
                        <button
                          onClick={() => setUserToDelete(user)}
                          className="p-1.5 hover:bg-destructive/10 hover:border-destructive/20 border border-transparent rounded-md transition-all text-muted-foreground hover:text-destructive"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground font-medium"
                  >
                    No users found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Showing {paginatedUsers.length} of {meta.totalCount} Accounts
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-input rounded-md bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => i + 1,
              ).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-md transition-all",
                    currentPage === page
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 border border-input rounded-md bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-bold text-foreground">
                  Manage User Account
                </h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                  {userToEdit.email}
                </p>
              </div>
              <button
                onClick={() => setUserToEdit(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleUpdateUser}
              className="p-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                  Display Name
                </Label>
                <Input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                  Organization Role
                </Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Viewer (Read Only)</SelectItem>
                    <SelectItem value="EDITOR">Editor (Manage Data)</SelectItem>
                    <SelectItem value="ADMIN">Admin (Full Control)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                    Reset Password
                  </Label>
                  <span className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter">
                    Leave blank to keep current
                  </span>
                </div>
                <Input
                  type="password"
                  placeholder="New strong password (min 12 chars)..."
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm({ ...editForm, password: e.target.value })
                  }
                />
                {editForm.password && (
                  <PasswordStrengthIndicator password={editForm.password} />
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border rounded-md transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={isUpdating}
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Save Account Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-sm border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Terminate Account?
              </h3>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-foreground italic">
                  {userToDelete.email}
                </span>
                ? This will immediately revoke all access across devices.
                <br />
                <br />
                <span className="text-destructive font-black uppercase tracking-widest text-[9px]">
                  This action is final and recorded in audit logs.
                </span>
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent rounded-md transition-all"
                >
                  No, Keep User
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 bg-destructive text-white px-4 py-2.5 rounded-md text-xs font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                >
                  {isDeleting && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  )}
                  Confirm Deletion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
