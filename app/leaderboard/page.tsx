"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBranchShortName, getSGPAColor, formatSGPA } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Trophy, Medal, Award, Users, GraduationCap, BookOpen, Search, ChevronLeft, ChevronRight, Loader2, Crown } from "lucide-react";

interface Student {
  rank: number;
  rollNumber: string;
  name: string | null;
  branch: string | null;
  batchYear: number | null;
  college: string;
  sgpa: number | null;
  semester: number | null;
}

interface Stats {
  totalStudents: number;
  branches: { code: string | null; count: number }[];
  batches: { year: number | null; count: number }[];
  semesters: number[];
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export default function LeaderboardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "50",
        });
        if (query) params.append("search", query);
        if (branch) params.append("branch", branch);
        if (batch) params.append("batch", batch);

        const res = await fetch(`/api/leaderboard?${params}`);
        const data = await res.json();
        if (data.success) {
          setStudents(data.data.students);
          setTotalPages(data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [page, branch, batch, query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const topThree = students.slice(0, 3);

  const podiumStyles = [
    { label: "#1", icon: Crown, bg: "bg-amber-400", text: "text-amber-900" },
    { label: "#2", icon: Medal, bg: "bg-slate-300", text: "text-slate-700" },
    { label: "#3", icon: Award, bg: "bg-orange-300", text: "text-orange-900" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <section className="relative rounded-[32px] overflow-hidden mb-10">
            <Image
              src="/stock/lab-research.jpg"
              alt="Leaderboard"
              width={1400}
              height={420}
              className="w-full h-[260px] sm:h-[320px] object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end text-white">
              <p className="text-xs uppercase tracking-[0.3em] mb-2">Academic Rankings</p>
              <h1 className="font-display text-3xl sm:text-4xl">Leaderboard</h1>
              <p className="text-white/80 max-w-xl mt-2">
                See how students rank based on performance across batches and branches.
              </p>
            </div>
          </section>

          {topThree.length > 0 && (
            <section className="paper-panel p-6 mb-10">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-[var(--secondary)]" />
                <h2 className="font-display text-xl">Top performers</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {topThree.map((student, index) => {
                  const Icon = podiumStyles[index].icon;
                  return (
                    <div key={student.rollNumber} className="rounded-2xl border border-[var(--border)] bg-white/90 p-4 flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${podiumStyles[index].bg} flex items-center justify-center shadow-sm`}>
                        <Icon className={`w-5 h-5 ${podiumStyles[index].text}`} />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--muted)]">{podiumStyles[index].label}</p>
                        <p className="font-semibold text-[var(--foreground)]">{student.name || "Unknown"}</p>
                        <p className="text-xs text-[var(--muted)]">{getBranchShortName(student.branch || "")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {stats && stats.totalStudents > 0 && (
            <section className="flex flex-wrap gap-3 mb-8">
              {[
                { value: stats.totalStudents.toLocaleString(), label: "Students", icon: Users },
                { value: stats.branches.length, label: "Branches", icon: GraduationCap },
                { value: stats.batches.length, label: "Batches", icon: BookOpen },
                { value: stats.semesters.length, label: "Semesters", icon: Award },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm">
                  <stat.icon className="w-4 h-4 text-[var(--primary)]" />
                  <span className="font-semibold text-[var(--foreground)]">{stat.value}</span>
                  <span className="text-[var(--muted)]">{stat.label}</span>
                </div>
              ))}
            </section>
          )}

          <section className="paper-panel p-6 mb-8">
            <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
                <Input
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <Select
                  value={branch}
                  onChange={(e) => { setBranch(e.target.value); setPage(1); }}
                  className="w-48"
                >
                  <option value="">All Branches</option>
                  {stats?.branches.map((b) => (
                    <option key={b.code} value={b.code || ""}>
                      {getBranchShortName(b.code || "")} ({b.count})
                    </option>
                  ))}
                </Select>
                <Select
                  value={batch}
                  onChange={(e) => { setBatch(e.target.value); setPage(1); }}
                  className="w-40"
                >
                  <option value="">All Batches</option>
                  {stats?.batches.map((b) => (
                    <option key={b.year} value={b.year?.toString() || ""}>
                      {b.year} ({b.count})
                    </option>
                  ))}
                </Select>
                <Button type="submit" className="h-11 px-6">
                  <Search className="w-4 h-4" />
                  Search
                </Button>
              </div>
            </form>
          </section>

          <section className="paper-panel overflow-hidden">
            <div className="sticky top-16 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[var(--secondary)]" />
              <h2 className="font-display text-lg">Rankings</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-20"
                  >
                    <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
                    <p className="text-[var(--muted)] mt-4">Loading rankings...</p>
                  </motion.div>
                ) : students.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-16 text-center"
                  >
                    <Trophy className="w-16 h-16 mx-auto text-[var(--muted)] mb-4" />
                    <h3 className="text-xl font-semibold">No Rankings Found</h3>
                    <p className="text-[var(--muted)]">Try adjusting your filters.</p>
                  </motion.div>
                ) : (
                  <motion.div key="table" initial="initial" animate="animate">
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-[var(--surface-muted)] text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      <div className="col-span-2">Rank</div>
                      <div className="col-span-2">Roll No</div>
                      <div className="col-span-3">Name</div>
                      <div className="col-span-2">Branch</div>
                      <div className="col-span-1">Batch</div>
                      <div className="col-span-2 text-right">SGPA</div>
                    </div>
                    <div>
                      {students.map((student, index) => (
                        <motion.div key={student.rollNumber} variants={fadeInUp}>
                          <Link href={`/students/${student.rollNumber}`}>
                            <div className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-[var(--surface-muted)] transition-colors ${index % 2 === 0 ? "bg-white/70" : "bg-white"}`}>
                              <div className="col-span-12 md:col-span-2 flex items-center gap-2">
                                {student.rank === 1 ? (
                                  <div className="w-10 h-10 rounded-full bg-amber-300 flex items-center justify-center">
                                    <Crown className="w-5 h-5 text-amber-900" />
                                  </div>
                                ) : student.rank === 2 ? (
                                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                    <Medal className="w-5 h-5 text-slate-700" />
                                  </div>
                                ) : student.rank === 3 ? (
                                  <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
                                    <Award className="w-5 h-5 text-orange-900" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center text-sm text-[var(--muted)]">
                                    {student.rank}
                                  </div>
                                )}
                                <span className="text-sm font-semibold">#{student.rank}</span>
                              </div>
                              <div className="col-span-6 md:col-span-2 font-mono text-xs text-[var(--muted)]">
                                {student.rollNumber}
                              </div>
                              <div className="col-span-6 md:col-span-3 font-medium truncate">
                                {student.name || "Unknown"}
                              </div>
                              <div className="col-span-4 md:col-span-2">
                                <Badge variant="info" className="rounded-full">
                                  {getBranchShortName(student.branch || "")}
                                </Badge>
                              </div>
                              <div className="col-span-4 md:col-span-1 text-[var(--muted)]">
                                {student.batchYear || "-"}
                              </div>
                              <div className={`col-span-4 md:col-span-2 text-right text-lg font-semibold ${getSGPAColor(student.sgpa)}`}>
                                {formatSGPA(student.sgpa)}
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {totalPages > 1 && !loading && (
                <div className="flex items-center justify-center gap-4 p-6 border-t border-[var(--border)]">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-[var(--muted)]">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
