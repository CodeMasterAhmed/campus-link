"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getBranchName, getBranchShortName, getSGPAColor, formatSGPA } from "@/lib/utils";
import {
  Search,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  SlidersHorizontal,
  Bookmark,
  BookmarkCheck,
  MessageCircle,
  RotateCcw,
} from "lucide-react";

interface Student {
  rollNumber: string;
  name: string | null;
  branch: string | null;
  batchYear: number | null;
  currentSGPA: number | null;
  totalBacklogs: number;
  profileImageUrl: string | null;
  college: { name: string; code: string } | null;
  linkedUserId: number | null;
}

type StatsPayload = {
  branches: { code: string | null; count: number }[];
  batches: { year: number | null; count: number }[];
  colleges: { id: number; name: string; code: string; count: number }[];
  semesters: number[];
};

type SelectOption = {
  value: string;
  label: string;
};

const sortOptions: SelectOption[] = [
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "sgpa_desc", label: "Highest SGPA" },
  { value: "sgpa_asc", label: "Lowest SGPA" },
  { value: "backlog_desc", label: "Most Backlogs" },
  { value: "backlog_asc", label: "Fewest Backlogs" },
  { value: "roll_asc", label: "Roll Number A-Z" },
  { value: "roll_desc", label: "Roll Number Z-A" },
];

const backlogOptions: SelectOption[] = [
  { value: "", label: "All Students" },
  { value: "yes", label: "With Backlogs" },
  { value: "no", label: "No Backlogs" },
];

const accountOptions: SelectOption[] = [
  { value: "", label: "All Account States" },
  { value: "yes", label: "Signed Up Accounts" },
  { value: "no", label: "No Account Yet" },
];

export default function StudentsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [watchlistByRoll, setWatchlistByRoll] = useState<Record<string, number>>({});
  const hasLoadedStudentsRef = useRef(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState("");
  const [hasBacklogs, setHasBacklogs] = useState("");
  const [hasAccount, setHasAccount] = useState("");
  const [sgpaMin, setSgpaMin] = useState("");
  const [sgpaMax, setSgpaMax] = useState("");
  const [sort, setSort] = useState("name_asc");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isRecruiter = session?.user?.role === "RECRUITER";

  const branches = useMemo<SelectOption[]>(() => {
    const dynamic = (stats?.branches || [])
      .filter((item) => item.code)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .map((item) => ({
        value: item.code as string,
        label: `${getBranchName(item.code || "")} (${item.count})`,
      }));

    return [{ value: "", label: "All Branches" }, ...dynamic];
  }, [stats?.branches]);

  const batches = useMemo<SelectOption[]>(() => {
    const dynamic = (stats?.batches || [])
      .filter((item) => item.year)
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .map((item) => ({
        value: String(item.year),
        label: `Batch ${item.year} (${item.count})`,
      }));

    return [{ value: "", label: "All Batches" }, ...dynamic];
  }, [stats?.batches]);

  const colleges = useMemo<SelectOption[]>(() => {
    const dynamic = (stats?.colleges || []).map((item) => ({
      value: item.code,
      label: `${item.name} (${item.count})`,
    }));
    return [{ value: "", label: "All Colleges" }, ...dynamic];
  }, [stats?.colleges]);

  const semesters = useMemo<SelectOption[]>(() => {
    const dynamic = [...(stats?.semesters || [])]
      .sort((a, b) => b - a)
      .map((sem) => ({
        value: String(sem),
        label: `Semester ${sem}`,
      }));
    return [{ value: "", label: "Latest SGPA (default)" }, ...dynamic];
  }, [stats?.semesters]);

  const activeFilterCount = useMemo(
    () =>
      [
        debouncedSearch,
        branch,
        batch,
        college,
        semester,
        hasBacklogs,
        hasAccount,
        sgpaMin.trim(),
        sgpaMax.trim(),
        sort !== "name_asc" ? sort : "",
      ].filter(Boolean).length,
    [debouncedSearch, branch, batch, college, semester, hasBacklogs, hasAccount, sgpaMin, sgpaMax, sort]
  );

  const fetchWatchlist = async () => {
    try {
      const response = await fetch("/api/watchlist", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return;
      const map: Record<string, number> = {};
      (payload.watchlist as Array<{ id: number; rollNumber: string }>).forEach((item) => {
        map[item.rollNumber] = item.id;
      });
      setWatchlistByRoll(map);
    } catch {
      // best-effort
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) return;
      setStats(payload.data as StatsPayload);
    } catch {
      // best-effort
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchStats();
    if (isRecruiter) {
      fetchWatchlist();
    } else {
      setWatchlistByRoll({});
    }
  }, [isRecruiter]);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      setLoadError("");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        sort,
      });

      if (debouncedSearch) params.append("search", debouncedSearch);
      if (branch) params.append("branch", branch);
      if (batch) params.append("batch", batch);
      if (college) params.append("college", college);
      if (semester) params.append("semester", semester);
      if (hasBacklogs) params.append("hasBacklogs", hasBacklogs === "yes" ? "true" : "false");
      if (hasAccount) params.append("hasAccount", hasAccount === "yes" ? "true" : "false");
      if (sgpaMin.trim()) params.append("sgpaMin", sgpaMin.trim());
      if (sgpaMax.trim()) params.append("sgpaMax", sgpaMax.trim());

      let lastError = "Failed to load students.";

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(`/api/students?${params.toString()}`, { cache: "no-store" });
          const payload = await response.json();
          if (!response.ok || !payload?.success) {
            lastError = payload?.error || "Failed to load students.";
            throw new Error(lastError);
          }

          setStudents(payload.data.students as Student[]);
          setTotalPages(payload.data.pagination.totalPages || 1);
          setTotal(payload.data.pagination.total || 0);
          hasLoadedStudentsRef.current = true;
          setLoading(false);
          return;
        } catch (error) {
          lastError = error instanceof Error && error.message ? error.message : "Failed to load students.";
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }
      }

      if (hasLoadedStudentsRef.current) {
        setLoadError("Could not refresh students right now. Showing last loaded data.");
      } else {
        setLoadError(lastError);
        setStudents([]);
        setTotal(0);
        setTotalPages(1);
      }
      setLoading(false);
    };

    fetchStudents();
  }, [
    page,
    debouncedSearch,
    branch,
    batch,
    college,
    semester,
    hasBacklogs,
    hasAccount,
    sgpaMin,
    sgpaMax,
    sort,
  ]);

  const toggleWatchlist = async (rollNumber: string) => {
    if (!isRecruiter) return;

    const existingId = watchlistByRoll[rollNumber];
    if (existingId) {
      const response = await fetch(`/api/watchlist/${existingId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return;
      setWatchlistByRoll((prev) => {
        const next = { ...prev };
        delete next[rollNumber];
        return next;
      });
      return;
    }

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) return;
    setWatchlistByRoll((prev) => ({ ...prev, [rollNumber]: payload.watchlistId as number }));
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setBranch("");
    setBatch("");
    setCollege("");
    setSemester("");
    setHasBacklogs("");
    setHasAccount("");
    setSgpaMin("");
    setSgpaMax("");
    setSort("name_asc");
    setPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <section className="relative rounded-[32px] overflow-hidden mb-10">
            <Image
              src="/stock/students-collab.jpg"
              alt="Students directory"
              width={1400}
              height={420}
              className="w-full h-[220px] sm:h-[280px] object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs uppercase tracking-[0.2em] mb-3">
                <Users className="w-4 h-4" />
                Student Directory
              </div>
              <h1 className="font-display text-3xl sm:text-4xl">Explore Students</h1>
              <p className="text-white/80 max-w-xl mt-2">
                Browse academic profiles with advanced filters for branch, batch, SGPA, backlogs, college, and account status.
              </p>
            </div>
          </section>

          <div className="grid lg:grid-cols-[300px_1fr] gap-8">
            <aside className="hidden lg:block">
              <div className="paper-panel p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Filters</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Search</p>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Name or roll number"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-11"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Branch</p>
                  <Select value={branch} onChange={(event) => { setBranch(event.target.value); setPage(1); }}>
                    {branches.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Batch</p>
                  <Select value={batch} onChange={(event) => { setBatch(event.target.value); setPage(1); }}>
                    {batches.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">College</p>
                  <Select value={college} onChange={(event) => { setCollege(event.target.value); setPage(1); }}>
                    {colleges.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Semester Scope</p>
                  <Select value={semester} onChange={(event) => { setSemester(event.target.value); setPage(1); }}>
                    {semesters.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Min SGPA</p>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.01}
                      placeholder="0.00"
                      value={sgpaMin}
                      onChange={(event) => {
                        setSgpaMin(event.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Max SGPA</p>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.01}
                      placeholder="10.00"
                      value={sgpaMax}
                      onChange={(event) => {
                        setSgpaMax(event.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Backlogs</p>
                  <Select
                    value={hasBacklogs}
                    onChange={(event) => {
                      setHasBacklogs(event.target.value);
                      setPage(1);
                    }}
                  >
                    {backlogOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Account</p>
                  <Select
                    value={hasAccount}
                    onChange={(event) => {
                      setHasAccount(event.target.value);
                      setPage(1);
                    }}
                  >
                    {accountOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Sort By</p>
                  <Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                    {sortOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {!loading && (
                  <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
                      <Filter className="w-4 h-4" />
                      Found{" "}
                      <span className="text-[var(--foreground)] font-semibold">
                        {total.toLocaleString()}
                      </span>{" "}
                      students
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      Active filters:{" "}
                      <span className="font-semibold text-[var(--foreground)]">{activeFilterCount}</span>
                    </p>
                  </div>
                )}

                {loadingStats && (
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading filter data...
                  </div>
                )}
              </div>
            </aside>

            <section>
              <div className="lg:hidden mb-6">
                <div className="paper-panel p-4 space-y-4">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Search students"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-11"
                      />
                    </div>
                    <Button variant="outline" onClick={() => setFiltersOpen((prev) => !prev)}>
                      <SlidersHorizontal className="w-4 h-4" />
                      Filters
                    </Button>
                  </div>

                  {filtersOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select value={branch} onChange={(event) => { setBranch(event.target.value); setPage(1); }}>
                        {branches.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                      <Select value={batch} onChange={(event) => { setBatch(event.target.value); setPage(1); }}>
                        {batches.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                      <Select value={college} onChange={(event) => { setCollege(event.target.value); setPage(1); }}>
                        {colleges.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={semester}
                        onChange={(event) => {
                          setSemester(event.target.value);
                          setPage(1);
                        }}
                      >
                        {semesters.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.01}
                        placeholder="Min SGPA"
                        value={sgpaMin}
                        onChange={(event) => {
                          setSgpaMin(event.target.value);
                          setPage(1);
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.01}
                        placeholder="Max SGPA"
                        value={sgpaMax}
                        onChange={(event) => {
                          setSgpaMax(event.target.value);
                          setPage(1);
                        }}
                      />
                      <Select
                        value={hasBacklogs}
                        onChange={(event) => {
                          setHasBacklogs(event.target.value);
                          setPage(1);
                        }}
                      >
                        {backlogOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={hasAccount}
                        onChange={(event) => {
                          setHasAccount(event.target.value);
                          setPage(1);
                        }}
                      >
                        {accountOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                      <div className="sm:col-span-2">
                        <Select
                          value={sort}
                          onChange={(event) => {
                            setSort(event.target.value);
                            setPage(1);
                          }}
                        >
                          {sortOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Button variant="outline" className="w-full gap-2" onClick={clearFilters}>
                          <RotateCcw className="w-4 h-4" />
                          Reset Filters
                        </Button>
                      </div>
                    </div>
                  )}

                  {!loading && (
                    <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
                      <Filter className="w-4 h-4" />
                      Found{" "}
                      <span className="text-[var(--foreground)] font-semibold">{total.toLocaleString()}</span> students
                      {activeFilterCount > 0 && (
                        <>
                          • Active filters:{" "}
                          <span className="text-[var(--foreground)] font-semibold">{activeFilterCount}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {loadError && (
                <p className="text-sm text-red-600 mb-4">{loadError}</p>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    className="paper-panel divide-y divide-[var(--border)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {students.map((student, index) => (
                      <motion.div
                        key={student.rollNumber}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                      >
                        <Link href={`/students/${student.rollNumber}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5 hover:bg-[var(--surface-muted)] transition-colors">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-muted)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-lg font-semibold text-[var(--foreground)] shrink-0">
                              {student.profileImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={student.profileImageUrl}
                                  alt={student.name || student.rollNumber}
                                  className="w-full h-full object-cover"
                                />
                              ) : student.name ? (
                                student.name.charAt(0)
                              ) : (
                                <User className="w-6 h-6 text-[var(--muted)]" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-3 mb-1">
                                <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
                                  {student.name || "Unknown"}
                                </h3>
                                <Badge variant="info" className="rounded-full">
                                  {getBranchShortName(student.branch || "")}
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  Batch {student.batchYear ?? "-"}
                                </Badge>
                                {student.totalBacklogs > 0 && (
                                  <Badge variant="warning" className="rounded-full">
                                    {student.totalBacklogs} Backlog{student.totalBacklogs > 1 ? "s" : ""}
                                  </Badge>
                                )}
                                {!student.linkedUserId && (
                                  <Badge variant="secondary" className="rounded-full">
                                    No Account
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-[var(--muted)] font-mono">{student.rollNumber}</p>
                              <p className="text-xs text-[var(--muted)] mt-1">
                                {getBranchName(student.branch || "")}
                                {student.college ? ` • ${student.college.name}` : ""}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className={`text-2xl font-semibold ${getSGPAColor(student.currentSGPA)}`}>
                                {formatSGPA(student.currentSGPA)}
                              </p>
                              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                {semester ? `Sem ${semester} SGPA` : "SGPA"}
                              </p>

                              {isRecruiter && (
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleWatchlist(student.rollNumber);
                                    }}
                                  >
                                    {watchlistByRoll[student.rollNumber] ? (
                                      <>
                                        <BookmarkCheck className="w-4 h-4" />
                                        Saved
                                      </>
                                    ) : (
                                      <>
                                        <Bookmark className="w-4 h-4" />
                                        Save
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const params = new URLSearchParams({
                                        name: student.name || "Student",
                                        role: "STUDENT",
                                      });
                                      if (student.linkedUserId) {
                                        params.set("with", String(student.linkedUserId));
                                      } else {
                                        params.set("rollNumber", student.rollNumber);
                                      }
                                      router.push(`/messages?${params.toString()}`);
                                    }}
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                    Message
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}

              {!loading && students.length === 0 && (
                <motion.div
                  className="text-center py-20"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="w-20 h-20 rounded-full bg-[var(--surface-muted)] flex items-center justify-center mx-auto mb-6">
                    <Users className="w-10 h-10 text-[var(--muted)]" />
                  </div>
                  <h3 className="text-xl font-semibold">No Students Found</h3>
                  <p className="text-[var(--muted)]">
                    Try adjusting your filter criteria.
                  </p>
                </motion.div>
              )}

              {!loading && totalPages > 1 && (
                <motion.div
                  className="mt-10 flex items-center justify-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </Button>

                  <div className="flex items-center gap-1 px-4">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = index + 1;
                      } else if (page <= 3) {
                        pageNum = index + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + index;
                      } else {
                        pageNum = page - 2 + index;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-full font-medium transition-all ${
                            page === pageNum
                              ? "bg-[var(--primary)] text-white"
                              : "bg-white text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
