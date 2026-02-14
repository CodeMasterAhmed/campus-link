"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Navbar, Footer } from "@/components/layout";
import { useDelayedLoginRedirect } from "@/lib/hooks/use-delayed-login-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Building2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";

type UserRole = "STUDENT" | "RECRUITER" | "ADMIN";
type UserStatus = "ACTIVE" | "PENDING" | "REJECTED";
type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type SummaryPayload = {
  users: {
    total: number;
    students: number;
    recruiters: number;
    admins: number;
  };
  recruiters: {
    pending: number;
    active: number;
    rejected: number;
  };
  colleges: {
    total: number;
    active: number;
    inactive: number;
  };
  activity: {
    studentAcademicRecords: number;
    messages: number;
  };
  recruiterRequests: {
    total: number;
    pending: number;
  };
};

type CollegeRow = {
  id: number;
  name: string;
  code: string;
  emailDomain: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    users: number;
    studentAcademics: number;
    recruiterCollegeRequests: number;
  };
};

type RecruiterRequest = {
  id: number;
  status: RequestStatus;
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  recruiter: {
    id: number;
    name: string;
    email: string;
    status: UserStatus;
    createdAt: string;
    collegeId: number | null;
  };
  targetCollege: {
    id: number;
    name: string;
    code: string;
    emailDomain: string;
  };
  resolvedByAdmin: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type PendingRecruiter = {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  collegeId: number | null;
  linkedCollege: {
    id: number;
    name: string;
    code: string;
    emailDomain: string;
  } | null;
  pendingRequest: {
    id: number;
    reason: string | null;
    createdAt: string;
    targetCollege: {
      id: number;
      name: string;
      code: string;
      emailDomain: string;
    };
  } | null;
};

type UserListItem = {
  id: number;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: UserRole;
  status: UserStatus;
  authProvider: "PASSWORD" | "GOOGLE" | "BOTH";
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  college: {
    id: number;
    name: string;
    code: string;
    emailDomain: string;
    isActive: boolean;
  } | null;
  studentProfile: {
    id: number;
    profileCompleted: boolean;
    headline: string | null;
    yearOfStudy: number | null;
    academic: {
      id: number;
      rollNumber: string;
      branch: string | null;
      batchYear: number | null;
      currentCgpa: string | number | null;
      overallSgpa: string | number | null;
    };
  } | null;
  _count: {
    sentMessages: number;
    receivedMessages: number;
    recruiterRequests: number;
    resolvedRequests: number;
    emailVerificationTokens: number;
    aiConversations: number;
    recruiterWatchlist: number;
  };
};

type UserDetail = UserListItem & {
  studentProfile: UserListItem["studentProfile"] & {
    about?: string | null;
    ussScore?: string | number | null;
    skills?: Array<{ id: number; category: string; name: string; createdAt: string }>;
    experiences?: Array<{
      id: number;
      type: string;
      companyName: string;
      roleTitle: string;
      startDate: string;
      endDate: string | null;
      isCurrent: boolean;
      description: string | null;
    }>;
    certifications?: Array<{
      id: number;
      name: string;
      issuer: string | null;
      issueDate: string | null;
      expiryDate: string | null;
      credentialUrl: string | null;
    }>;
  } | null;
  recruiterRequests: Array<{
    id: number;
    status: RequestStatus;
    reason: string | null;
    createdAt: string;
    resolvedAt: string | null;
    targetCollege: { id: number; name: string; code: string; emailDomain: string };
    resolvedByAdmin: { id: number; name: string; email: string } | null;
  }>;
  sentMessages: Array<{
    id: number;
    body: string;
    createdAt: string;
    receiver: { id: number; name: string; email: string };
  }>;
  receivedMessages: Array<{
    id: number;
    body: string;
    createdAt: string;
    sender: { id: number; name: string; email: string };
  }>;
  emailVerificationTokens: Array<{
    id: number;
    purpose: string;
    expiresAt: string;
    consumedAt: string | null;
    createdAt: string;
  }>;
  aiConversations: Array<{
    id: number;
    title: string;
    contextType: string;
    contextRollNumber: string | null;
    createdAt: string;
    updatedAt: string;
    _count: { messages: number };
  }>;
  recruiterWatchlist: Array<{
    id: number;
    note: string | null;
    createdAt: string;
    studentAcademic: {
      id: number;
      rollNumber: string;
      studentName: string | null;
      branch: string | null;
      batchYear: number | null;
      college: { id: number; name: string; code: string };
    };
  }>;
};

type UserEditState = {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  collegeId: string;
  password: string;
};

const roleFilterOptions = ["ALL", "STUDENT", "RECRUITER", "ADMIN"] as const;
const statusFilterOptions = ["ALL", "ACTIVE", "PENDING", "REJECTED"] as const;
const requestFilterOptions = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

type LoadUsersFilters = {
  search: string;
  role: (typeof roleFilterOptions)[number];
  status: (typeof statusFilterOptions)[number];
};

const defaultUserFilters: LoadUsersFilters = {
  search: "",
  role: "ALL",
  status: "ALL",
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useDelayedLoginRedirect(status);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [colleges, setColleges] = useState<CollegeRow[]>([]);
  const [requestHistory, setRequestHistory] = useState<RecruiterRequest[]>([]);
  const [pendingRecruiters, setPendingRecruiters] = useState<PendingRecruiter[]>([]);
  const [pendingCollegeByRecruiter, setPendingCollegeByRecruiter] = useState<Record<number, string>>({});

  const [requestFilter, setRequestFilter] =
    useState<(typeof requestFilterOptions)[number]>("ALL");

  const [actionRecruiterId, setActionRecruiterId] = useState<number | null>(null);
  const [actionCollegeId, setActionCollegeId] = useState<number | null>(null);
  const [creatingCollege, setCreatingCollege] = useState(false);

  const [collegeName, setCollegeName] = useState("");
  const [collegeDomain, setCollegeDomain] = useState("");
  const [collegeCode, setCollegeCode] = useState("");
  const [collegeActive, setCollegeActive] = useState(true);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<(typeof roleFilterOptions)[number]>("ALL");
  const [userStatusFilter, setUserStatusFilter] =
    useState<(typeof statusFilterOptions)[number]>("ALL");

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<UserEditState | null>(null);

  const filteredHistory = useMemo(() => {
    if (requestFilter === "ALL") return requestHistory;
    return requestHistory.filter((request) => request.status === requestFilter);
  }, [requestHistory, requestFilter]);

  const activeColleges = useMemo(
    () => colleges.filter((college) => college.isActive),
    [colleges]
  );

  const loadCore = useCallback(async () => {
    const [summaryRes, collegeRes, requestRes, pendingRes] = await Promise.all([
      fetch("/api/admin/summary", { cache: "no-store" }),
      fetch("/api/admin/colleges", { cache: "no-store" }),
      fetch("/api/admin/recruiter-requests", { cache: "no-store" }),
      fetch("/api/admin/recruiters/pending", { cache: "no-store" }),
    ]);

    const [summaryJson, collegeJson, requestJson, pendingJson] = await Promise.all([
      summaryRes.json(),
      collegeRes.json(),
      requestRes.json(),
      pendingRes.json(),
    ]);

    if (!summaryRes.ok || !summaryJson?.ok) {
      throw new Error(summaryJson?.error || "Failed to load admin summary.");
    }
    if (!collegeRes.ok || !collegeJson?.ok) {
      throw new Error(collegeJson?.error || "Failed to load colleges.");
    }
    if (!requestRes.ok || !requestJson?.ok) {
      throw new Error(requestJson?.error || "Failed to load request history.");
    }
    if (!pendingRes.ok || !pendingJson?.ok) {
      throw new Error(pendingJson?.error || "Failed to load pending recruiters.");
    }

    const nextSummary = summaryJson.summary as SummaryPayload;
    const nextColleges = collegeJson.colleges as CollegeRow[];
    const nextHistory = requestJson.requests as RecruiterRequest[];
    const nextPending = pendingJson.recruiters as PendingRecruiter[];

    setSummary(nextSummary);
    setColleges(nextColleges);
    setRequestHistory(nextHistory);
    setPendingRecruiters(nextPending);
    setPendingCollegeByRecruiter((prev) => {
      const merged = { ...prev };
      for (const recruiter of nextPending) {
        if (!merged[recruiter.id]) {
          const defaultCollegeId =
            recruiter.pendingRequest?.targetCollege.id ??
            recruiter.linkedCollege?.id ??
            recruiter.collegeId ??
            null;
          if (defaultCollegeId) {
            merged[recruiter.id] = String(defaultCollegeId);
          }
        }
      }
      return merged;
    });
  }, []);

  const loadUsers = useCallback(async (filters: LoadUsersFilters) => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ limit: "120" });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.role !== "ALL") params.set("role", filters.role);
      if (filters.status !== "ALL") params.set("status", filters.status);

      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to load users.");
      }
      setUsers(payload.users as UserListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadSelectedUser = useCallback(async (userId: number) => {
    setLoadingUserDetail(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to load user details.");
      }
      const user = payload.user as UserDetail;
      setSelectedUser(user);
      setEditUser({
        name: user.name || "",
        email: user.email || "",
        role: user.role,
        status: user.status,
        collegeId: user.college?.id ? String(user.college.id) : "",
        password: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user details.");
      setSelectedUser(null);
      setEditUser(null);
    } finally {
      setLoadingUserDetail(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session.user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        await Promise.all([
          loadCore(),
          loadUsers(defaultUserFilters),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin dashboard.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [status, session, router, loadCore, loadUsers]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "ADMIN") return;
    const timeout = setTimeout(() => {
      loadUsers({
        search: userSearch,
        role: userRoleFilter,
        status: userStatusFilter,
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [userSearch, userRoleFilter, userStatusFilter, loadUsers, session?.user?.role, status]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setEditUser(null);
      return;
    }
    loadSelectedUser(selectedUserId);
  }, [selectedUserId, loadSelectedUser]);

  const resolvePendingRecruiter = async (
    recruiterId: number,
    nextStatus: "APPROVED" | "REJECTED"
  ) => {
    setActionRecruiterId(recruiterId);
    setError("");
    setSuccess("");
    try {
      const selectedCollege = pendingCollegeByRecruiter[recruiterId];
      const response = await fetch(`/api/admin/recruiters/${recruiterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          targetCollegeId: selectedCollege ? Number(selectedCollege) : undefined,
          reason: nextStatus === "APPROVED" ? "Approved by admin" : "Rejected by admin",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to resolve recruiter.");
      }
      setSuccess(
        `Recruiter ${nextStatus === "APPROVED" ? "approved" : "rejected"} successfully.`
      );
      await Promise.all([
        loadCore(),
        loadUsers({
          search: userSearch,
          role: userRoleFilter,
          status: userStatusFilter,
        }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve recruiter.");
    } finally {
      setActionRecruiterId(null);
    }
  };

  const toggleCollegeStatus = async (college: CollegeRow) => {
    setActionCollegeId(college.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/colleges/${college.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !college.isActive }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to update college status.");
      }
      setSuccess(`College ${college.isActive ? "deactivated" : "activated"} successfully.`);
      await loadCore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update college status.");
    } finally {
      setActionCollegeId(null);
    }
  };

  const createCollege = async () => {
    if (!collegeName.trim() || !collegeDomain.trim() || !/^\d{4}$/.test(collegeCode.trim())) {
      setError("Provide valid college name, domain, and a 4-digit code.");
      return;
    }

    setCreatingCollege(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/colleges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: collegeName.trim(),
          emailDomain: collegeDomain.trim().toLowerCase(),
          code: collegeCode.trim(),
          isActive: collegeActive,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to create college.");
      }
      setSuccess("College created successfully.");
      setCollegeName("");
      setCollegeDomain("");
      setCollegeCode("");
      setCollegeActive(true);
      await loadCore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create college.");
    } finally {
      setCreatingCollege(false);
    }
  };

  const saveUser = async () => {
    if (!selectedUserId || !editUser) return;
    setSavingUser(true);
    setError("");
    setSuccess("");
    try {
      const payload: {
        name: string;
        email: string;
        role: UserRole;
        status: UserStatus;
        collegeId: number | null;
        password?: string;
      } = {
        name: editUser.name.trim(),
        email: editUser.email.trim().toLowerCase(),
        role: editUser.role,
        status: editUser.status,
        collegeId: editUser.collegeId ? Number(editUser.collegeId) : null,
      };
      if (editUser.password.trim()) {
        payload.password = editUser.password.trim();
      }

      const response = await fetch(`/api/admin/users/${selectedUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Failed to update user.");
      }

      setSuccess("User updated successfully.");
      await Promise.all([
        loadUsers({
          search: userSearch,
          role: userRoleFilter,
          status: userStatusFilter,
        }),
        loadSelectedUser(selectedUserId),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setSavingUser(false);
    }
  };

  const removeUser = async (userId: number) => {
    const target = users.find((u) => u.id === userId);
    const ok = window.confirm(
      `Delete user ${target?.email || `#${userId}`}? This will remove related data (messages/tokens/chats/profile).`
    );
    if (!ok) return;

    setDeletingUserId(userId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Failed to delete user.");
      }
      setSuccess("User deleted successfully.");
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setSelectedUser(null);
        setEditUser(null);
      }
      await Promise.all([
        loadUsers({
          search: userSearch,
          role: userRoleFilter,
          status: userStatusFilter,
        }),
        loadCore(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <section className="relative rounded-[32px] overflow-hidden mb-8">
            <Image
              src="/stock/recruiter-meeting.jpg"
              alt="Admin panel"
              width={1400}
              height={420}
              className="w-full h-[230px] sm:h-[290px] object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end text-white">
              <p className="text-xs uppercase tracking-[0.3em] mb-2">Admin Portal</p>
              <h1 className="font-display text-3xl sm:text-4xl">Platform Control Center</h1>
              <p className="text-white/80 mt-2 max-w-xl">
                Approve recruiters, manage colleges, and control all user accounts.
              </p>
            </div>
          </section>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {success && <p className="text-sm text-green-700 mb-4">{success}</p>}

          <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="paper-panel p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <Users className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Users</p>
                  <p className="text-xl font-semibold">{summary?.users.total ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="paper-panel p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pending Recruiters</p>
                  <p className="text-xl font-semibold">{summary?.recruiters.pending ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="paper-panel p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Colleges</p>
                  <p className="text-xl font-semibold">
                    {summary?.colleges.active ?? 0}/{summary?.colleges.total ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="paper-panel p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Messages</p>
                  <p className="text-xl font-semibold">{summary?.activity.messages ?? 0}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="paper-panel p-5 sm:p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="font-display text-xl">Pending Recruiter Approvals</h2>
            </div>
            <p className="text-sm text-[var(--muted)] mb-4">
              This queue includes pending recruiters with or without a college request row.
            </p>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {pendingRecruiters.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No pending recruiters found.</p>
              ) : (
                pendingRecruiters.map((recruiter) => (
                  <motion.div
                    key={recruiter.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[var(--border)] bg-white/80 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="font-semibold">{recruiter.name}</p>
                      <Badge variant="outline">{recruiter.email}</Badge>
                      <Badge variant="warning">PENDING</Badge>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      Joined: {new Date(recruiter.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {recruiter.pendingRequest?.targetCollege
                        ? `Requested college: ${recruiter.pendingRequest.targetCollege.name} (${recruiter.pendingRequest.targetCollege.code})`
                        : "No college selected by recruiter. Choose one before approval."}
                    </p>

                    <div className="mt-3 grid sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
                      <Select
                        value={pendingCollegeByRecruiter[recruiter.id] || ""}
                        onChange={(event) =>
                          setPendingCollegeByRecruiter((prev) => ({
                            ...prev,
                            [recruiter.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select college</option>
                        {activeColleges.map((college) => (
                          <option key={college.id} value={college.id}>
                            {college.name} ({college.code})
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={actionRecruiterId === recruiter.id}
                        onClick={() => resolvePendingRecruiter(recruiter.id, "APPROVED")}
                      >
                        {actionRecruiterId === recruiter.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Approve"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        disabled={actionRecruiterId === recruiter.id}
                        onClick={() => resolvePendingRecruiter(recruiter.id, "REJECTED")}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
            <section className="paper-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display text-xl">Recruiter Request History</h2>
                  <p className="text-sm text-[var(--muted)]">All recruiter-college request records.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {requestFilterOptions.map((filter) => (
                    <Button
                      key={filter}
                      size="sm"
                      variant={requestFilter === filter ? "default" : "outline"}
                      onClick={() => setRequestFilter(filter)}
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No recruiter request records found.</p>
                ) : (
                  filteredHistory.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-[var(--border)] bg-white/80 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold">{request.recruiter.name}</p>
                        <Badge variant="outline">{request.recruiter.email}</Badge>
                        <Badge
                          variant={
                            request.status === "PENDING"
                              ? "warning"
                              : request.status === "APPROVED"
                              ? "success"
                              : "destructive"
                          }
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {request.targetCollege.name} ({request.targetCollege.code})
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Requested: {new Date(request.createdAt).toLocaleString()}
                      </p>
                      {request.resolvedAt && (
                        <p className="text-xs text-[var(--muted)] mt-1">
                          Resolved: {new Date(request.resolvedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-6">
              <div className="paper-panel p-5 sm:p-6">
                <h2 className="font-display text-xl mb-3">Add College</h2>
                <div className="space-y-3">
                  <Input
                    value={collegeName}
                    onChange={(event) => setCollegeName(event.target.value)}
                    placeholder="College name"
                  />
                  <Input
                    value={collegeDomain}
                    onChange={(event) => setCollegeDomain(event.target.value)}
                    placeholder="Email domain (e.g. mjcollege.ac.in)"
                  />
                  <Input
                    value={collegeCode}
                    onChange={(event) => setCollegeCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="4-digit code"
                  />
                  <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={collegeActive}
                      onChange={(event) => setCollegeActive(event.target.checked)}
                    />
                    College is active
                  </label>
                  <Button className="w-full" disabled={creatingCollege} onClick={createCollege}>
                    {creatingCollege ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                    Create College
                  </Button>
                </div>
              </div>

              <div className="paper-panel p-5 sm:p-6">
                <h2 className="font-display text-xl mb-3">Colleges</h2>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {colleges.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No colleges available.</p>
                  ) : (
                    colleges.map((college) => (
                      <div key={college.id} className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{college.name}</p>
                            <p className="text-xs text-[var(--muted)] truncate">
                              {college.code} • {college.emailDomain}
                            </p>
                          </div>
                          <Badge variant={college.isActive ? "success" : "warning"}>
                            {college.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-2">
                          Students: {college._count.studentAcademics} • Users: {college._count.users}
                        </p>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionCollegeId === college.id}
                            onClick={() => toggleCollegeStatus(college)}
                          >
                            {actionCollegeId === college.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : college.isActive ? (
                              "Deactivate"
                            ) : (
                              "Activate"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="paper-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-xl">User Management</h2>
                <p className="text-sm text-[var(--muted)]">
                  Search, inspect full details, edit, and remove users.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  loadUsers({
                    search: userSearch,
                    role: userRoleFilter,
                    status: userStatusFilter,
                  });
                  if (selectedUserId) loadSelectedUser(selectedUserId);
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            <div className="grid md:grid-cols-[1.5fr_0.8fr_0.8fr] gap-3 mb-4">
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search by name or email"
              />
              <Select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as (typeof roleFilterOptions)[number])}>
                {roleFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value as (typeof statusFilterOptions)[number])}>
                {statusFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid xl:grid-cols-[1.05fr_1fr] gap-6">
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No users found.</p>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        selectedUserId === user.id
                          ? "border-[var(--primary)] bg-[var(--surface-muted)]"
                          : "border-[var(--border)] bg-white/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-sm font-semibold">
                              {user.profileImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.profileImageUrl} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                user.name?.charAt(0) || "?"
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{user.name}</p>
                              <p className="text-xs text-[var(--muted)] truncate">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">{user.role}</Badge>
                            <Badge
                              variant={
                                user.status === "ACTIVE"
                                  ? "success"
                                  : user.status === "PENDING"
                                  ? "warning"
                                  : "destructive"
                              }
                            >
                              {user.status}
                            </Badge>
                            {user.college && <Badge variant="info">{user.college.code}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/profile?userId=${user.id}`)}
                          >
                            Open Profile
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedUserId(user.id)}>
                            <UserCog className="w-4 h-4" />
                            Manage
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingUserId === user.id}
                            onClick={() => removeUser(user.id)}
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-2">
                        Sent: {user._count.sentMessages} • Received: {user._count.receivedMessages} • AI Chats:{" "}
                        {user._count.aiConversations}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 sm:p-5">
                {!selectedUserId ? (
                  <p className="text-sm text-[var(--muted)]">Select a user to view and edit full details.</p>
                ) : loadingUserDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : !selectedUser || !editUser ? (
                  <p className="text-sm text-[var(--muted)]">User detail unavailable.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-display text-xl">User Detail</h3>
                      <p className="text-xs text-[var(--muted)]">
                        User ID: {selectedUser.id} • Created:{" "}
                        {new Date(selectedUser.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input
                        value={editUser.name}
                        onChange={(event) => setEditUser((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                        placeholder="Name"
                      />
                      <Input
                        value={editUser.email}
                        onChange={(event) => setEditUser((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
                        placeholder="Email"
                      />
                      <Select
                        value={editUser.role}
                        onChange={(event) =>
                          setEditUser((prev) => (prev ? { ...prev, role: event.target.value as UserRole } : prev))
                        }
                      >
                        <option value="STUDENT">STUDENT</option>
                        <option value="RECRUITER">RECRUITER</option>
                        <option value="ADMIN">ADMIN</option>
                      </Select>
                      <Select
                        value={editUser.status}
                        onChange={(event) =>
                          setEditUser((prev) => (prev ? { ...prev, status: event.target.value as UserStatus } : prev))
                        }
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PENDING">PENDING</option>
                        <option value="REJECTED">REJECTED</option>
                      </Select>
                      <Select
                        value={editUser.collegeId}
                        onChange={(event) =>
                          setEditUser((prev) => (prev ? { ...prev, collegeId: event.target.value } : prev))
                        }
                        className="sm:col-span-2"
                      >
                        <option value="">No College</option>
                        {colleges.map((college) => (
                          <option key={college.id} value={college.id}>
                            {college.name} ({college.code}) {college.isActive ? "" : "[INACTIVE]"}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="password"
                        value={editUser.password}
                        onChange={(event) =>
                          setEditUser((prev) => (prev ? { ...prev, password: event.target.value } : prev))
                        }
                        placeholder="New password (optional)"
                        className="sm:col-span-2"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={saveUser} disabled={savingUser}>
                        {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => loadSelectedUser(selectedUser.id)}
                        disabled={loadingUserDetail}
                      >
                        Reload Detail
                      </Button>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] p-3 bg-[var(--surface-muted)]">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Profile/Academic</p>
                      {selectedUser.studentProfile ? (
                        <div className="space-y-1 text-sm">
                          <p>
                            Profile Completed:{" "}
                            <span className="font-semibold">
                              {selectedUser.studentProfile.profileCompleted ? "Yes" : "No"}
                            </span>
                          </p>
                          <p>
                            Roll Number:{" "}
                            <span className="font-semibold">
                              {selectedUser.studentProfile.academic?.rollNumber || "-"}
                            </span>
                          </p>
                          <p>
                            Branch:{" "}
                            <span className="font-semibold">
                              {selectedUser.studentProfile.academic?.branch || "-"}
                            </span>
                          </p>
                          <p>
                            Skills:{" "}
                            <span className="font-semibold">
                              {selectedUser.studentProfile.skills?.map((skill) => skill.name).join(", ") || "-"}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">No student profile linked.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[var(--border)] p-3 bg-[var(--surface-muted)]">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Activity</p>
                      <p className="text-sm">
                        Messages: {selectedUser._count.sentMessages} sent / {selectedUser._count.receivedMessages} received
                      </p>
                      <p className="text-sm">AI Conversations: {selectedUser._count.aiConversations}</p>
                      <p className="text-sm">Recruiter Requests: {selectedUser._count.recruiterRequests}</p>
                      <p className="text-sm">Watchlist Entries: {selectedUser._count.recruiterWatchlist}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
