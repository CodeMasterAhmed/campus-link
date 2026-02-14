"use client";

import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBranchName, getBranchShortName, getSGPAColor, formatSGPA, getGradeColor } from "@/lib/utils";
import { ArrowLeft, GraduationCap, BookOpen, CheckCircle, TrendingUp, ChevronDown, Loader2, User, Bot, Bookmark, BookmarkCheck, MessageCircle, AlertTriangle } from "lucide-react";

interface Subject {
  code: string;
  name: string;
  grade: string | null;
  credits: number | null;
  status: string;
}

interface Semester {
  semester: number | null;
  examName: string | null;
  monthYear: string | null;
  sgpa: number | null;
  status: string;
  subjects: Subject[];
}

interface StudentDetail {
  rollNumber: string;
  name: string | null;
  branch: string | null;
  batchYear: number | null;
  profileImageUrl: string | null;
  linkedUserId: number | null;
  college: { name: string; code: string } | null;
  currentSGPA: number | null;
  semesters: Semester[];
  profile: {
    headline: string | null;
    about: string | null;
    ussScore: number | null;
    skills: string[];
    experiences: {
      title: string;
      company: string;
      type: string;
      startDate: string;
      endDate: string | null;
      description: string | null;
    }[];
    certifications: {
      name: string;
      issuer: string | null;
      issueDate: string | null;
      credentialUrl: string | null;
    }[];
  } | null;
  dataQuality: {
    hasSemesterResults: boolean;
    sourceFound: boolean | null;
    sourceInvalidMessage: string | null;
    sourceLine: number | null;
    selectedFromDuplicates: number | null;
  };
}

export default function StudentDetailPage({ params }: { params: Promise<{ rollNumber: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { rollNumber } = use(params);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSemester, setExpandedSemester] = useState<number | null>(null);
  const [watchlistId, setWatchlistId] = useState<number | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const isRecruiter = session?.user?.role === "RECRUITER";

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await fetch(`/api/students/${rollNumber}`);
        const data = await res.json();
        if (data.success) {
          setStudent(data.data);
        } else {
          setError(data.error || "Student not found");
        }
      } catch {
        setError("Failed to fetch student details");
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [rollNumber]);

  useEffect(() => {
    if (!isRecruiter || !student) {
      setWatchlistId(null);
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const response = await fetch("/api/watchlist", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) return;
        const entry = (payload.watchlist as Array<{ id: number; rollNumber: string }>).find(
          (row) => row.rollNumber === student.rollNumber
        );
        setWatchlistId(entry?.id ?? null);
      } catch {
        setWatchlistId(null);
      }
    };

    fetchWatchlist();
  }, [isRecruiter, student]);

  const toggleWatchlist = async () => {
    if (!student || !isRecruiter) return;
    setWatchlistLoading(true);
    try {
      if (watchlistId) {
        const response = await fetch(`/api/watchlist/${watchlistId}`, { method: "DELETE" });
        const payload = await response.json();
        if (response.ok && payload?.ok) {
          setWatchlistId(null);
        }
      } else {
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rollNumber: student.rollNumber }),
        });
        const payload = await response.json();
        if (response.ok && payload?.ok) {
          setWatchlistId(payload.watchlistId as number);
        }
      }
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--background)]">
        <Navbar />
        <main className="flex-1 pt-24 pb-12 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--background)]">
        <Navbar />
        <main className="flex-1 pt-24 pb-12 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <User className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Student Not Found</h2>
            <p className="text-[var(--muted)] mb-6">{error}</p>
            <Link href="/students">
              <Button className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Students
              </Button>
            </Link>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  const sgpaValues = student.semesters
    .map((semester) => semester.sgpa)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const avgSGPA =
    sgpaValues.length > 0 ? sgpaValues.reduce((sum, value) => sum + value, 0) / sgpaValues.length : null;
  const bestSGPA = sgpaValues.length > 0 ? Math.max(...sgpaValues) : null;
  const hasSemesterResults = (student.dataQuality?.hasSemesterResults ?? false) || student.semesters.length > 0;
  const hasSgpaTrend = sgpaValues.length > 0;
  const noResultsReason =
    student.dataQuality?.sourceInvalidMessage ||
    (student.dataQuality?.sourceFound === false
      ? "The source result file marks this hall-ticket as invalid, so semester rows were not imported."
      : "No semester rows were imported for this roll number in the current dataset.");

  const recruiterAssistantPrompt = `Give me a concise recruiter summary for roll number ${student.rollNumber}. Include strengths, risk signals, backlog exposure, and 3 focused interview questions.`;
  const ownProfileAssistantPrompt =
    "Review my profile as a student and give me a practical plan: strengths, weak spots, SGPA/backlog risk, and next 30-day actions.";
  const peerLearningPrompt =
    "Using only my own academic context, suggest how I can benchmark myself against strong profiles and improve my SGPA, backlog risk, and placement readiness.";
  const staffReviewPrompt = `Summarize roll number ${student.rollNumber} for academic mentoring: strengths, concerns, and support actions.`;
  const currentUserId = Number(session?.user?.id || 0);
  const isOwnProfile =
    session?.user?.role === "STUDENT" &&
    Number.isFinite(currentUserId) &&
    currentUserId > 0 &&
    student.linkedUserId !== null &&
    student.linkedUserId === currentUserId;

  let assistantHref = "/assistant";
  if (isRecruiter) {
    assistantHref = `/assistant?rollNumber=${student.rollNumber}&new=1&autosend=1&prompt=${encodeURIComponent(recruiterAssistantPrompt)}`;
  } else if (isOwnProfile) {
    assistantHref = `/assistant?new=1&autosend=1&prompt=${encodeURIComponent(ownProfileAssistantPrompt)}`;
  } else if (session?.user?.role === "STUDENT") {
    assistantHref = `/assistant?prompt=${encodeURIComponent(peerLearningPrompt)}`;
  } else {
    assistantHref = `/assistant?prompt=${encodeURIComponent(staffReviewPrompt)}`;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <section className="relative rounded-[32px] overflow-hidden mb-8">
            <Image
              src="/stock/campus-hero.jpg"
              alt="Student cover"
              width={1400}
              height={420}
              className="w-full h-[240px] sm:h-[300px] object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end text-white">
              <p className="text-xs uppercase tracking-[0.3em] mb-2">Student Profile</p>
              <h1 className="font-display text-3xl sm:text-4xl">{student.name || "Unknown"}</h1>
              <p className="text-white/80 mt-2">{student.rollNumber}</p>
            </div>
          </section>

          <Link href="/students" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--primary)] mb-6 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Students
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {status === "authenticated" && (
              <Link href={assistantHref}>
                <Button variant="outline" className="gap-2">
                  <Bot className="w-4 h-4" />
                  Ask AI about this profile
                </Button>
              </Link>
            )}
            {isRecruiter && (
              <>
                <Button variant="outline" className="gap-2" onClick={toggleWatchlist} disabled={watchlistLoading}>
                  {watchlistLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : watchlistId ? (
                    <BookmarkCheck className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  {watchlistId ? "Saved to Watchlist" : "Save to Watchlist"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
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
                  Message Student
                </Button>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-8">
            <div className="space-y-8">
              <section className="paper-panel p-6">
                <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
                  <div className="w-20 h-20 rounded-2xl bg-[var(--surface-muted)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-2xl font-semibold">
                    {student.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={student.profileImageUrl}
                        alt={student.name || student.rollNumber}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      student.name?.charAt(0) || "?"
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">{getBranchName(student.branch || "")}</Badge>
                      <Badge variant="outline">Batch {student.batchYear}</Badge>
                      {student.college && (
                        <Badge variant="secondary">{student.college.name}</Badge>
                      )}
                    </div>
                    <p className="text-[var(--muted)] mt-2">Current SGPA</p>
                    <p className={`text-3xl font-semibold ${getSGPAColor(student.currentSGPA)}`}>
                      {formatSGPA(student.currentSGPA)}
                    </p>
                  </div>
                </div>
              </section>

              {hasSgpaTrend && (
                <section className="paper-panel p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                    <h2 className="font-display text-xl">SGPA Progress</h2>
                  </div>
                  <div className="flex items-end justify-between gap-3 h-40">
                    {student.semesters.map((sem, idx) => {
                      const height = ((sem.sgpa || 0) / 10) * 100;
                      return (
                        <motion.div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-2"
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.5, delay: 0.2 + idx * 0.1, ease: "easeOut" }}
                          style={{ originY: 1 }}
                        >
                          <div className="text-xs font-semibold text-[var(--muted)]">
                            {formatSGPA(sem.sgpa)}
                          </div>
                          <div
                            className="w-full rounded-t-2xl bg-[var(--primary)]/80"
                            style={{ height: `${height}%`, minHeight: "8px" }}
                          />
                          <div className="text-xs text-[var(--muted)]">Sem {sem.semester}</div>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="space-y-4">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[var(--primary)]" />
                  Semester Results
                </h2>
                <div className="paper-panel divide-y divide-[var(--border)]">
                  {hasSemesterResults ? (
                    student.semesters.map((semester, idx) => (
                      <div key={idx}>
                        <button
                          className="w-full text-left px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-[var(--surface-muted)] transition-colors"
                          onClick={() => setExpandedSemester(expandedSemester === idx ? null : idx)}
                        >
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Semester {semester.semester}</p>
                            <p className="text-sm text-[var(--muted)] mt-1">{semester.monthYear || semester.examName}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={semester.status === "PASSED" ? "success" : "destructive"}>
                              {semester.status}
                            </Badge>
                            <span className={`text-xl font-semibold ${getSGPAColor(semester.sgpa)}`}>
                              {formatSGPA(semester.sgpa)}
                            </span>
                            <ChevronDown
                              className={`w-5 h-5 text-[var(--muted)] transition-transform ${expandedSemester === idx ? "rotate-180" : ""}`}
                            />
                          </div>
                        </button>
                        <AnimatePresence>
                          {expandedSemester === idx && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <div className="px-6 pb-6">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                                        <th className="text-left py-2">Code</th>
                                        <th className="text-left py-2">Subject</th>
                                        <th className="text-center py-2">Credits</th>
                                        <th className="text-center py-2">Grade</th>
                                        <th className="text-center py-2">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {semester.subjects.map((subject, subIdx) => (
                                        <motion.tr
                                          key={subIdx}
                                          className="border-b border-[var(--border)]/60 last:border-0"
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: subIdx * 0.03 }}
                                        >
                                          <td className="py-3 font-mono text-xs text-[var(--muted)]">{subject.code}</td>
                                          <td className="py-3 text-[var(--foreground)]">{subject.name}</td>
                                          <td className="py-3 text-center text-[var(--muted)]">{subject.credits || "-"}</td>
                                          <td className={`py-3 text-center font-semibold ${getGradeColor(subject.grade)}`}>
                                            {subject.grade || "-"}
                                          </td>
                                          <td className="py-3 text-center">
                                            <Badge variant={subject.status === "PASSED" ? "success" : "destructive"}>
                                              {subject.status}
                                            </Badge>
                                          </td>
                                        </motion.tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <div className="mx-auto mb-4 w-10 h-10 rounded-full bg-amber-100/60 text-amber-600 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <p className="font-medium mb-1">No semester results available</p>
                      <p className="text-sm text-[var(--muted)] max-w-xl mx-auto">{noResultsReason}</p>
                    </div>
                  )}
                </div>
              </section>

              {student.profile && (
                <section className="paper-panel p-6">
                  <h2 className="font-display text-xl flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-[var(--primary)]" />
                    Profile
                  </h2>
                  {student.profile.about && (
                    <div className="mb-6">
                      <p className="text-[var(--muted)] leading-relaxed">{student.profile.about}</p>
                    </div>
                  )}
                  {student.profile.skills.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {student.profile.skills.map((skill, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Badge variant="info">{skill}</Badge>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <aside className="space-y-6">
              <div className="paper-panel p-6">
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-[var(--primary)]" />
                  <h3 className="font-display text-lg">Overview</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Roll Number</span>
                    <span className="font-medium">{student.rollNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Branch</span>
                    <span className="font-medium">{getBranchShortName(student.branch || "")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Batch</span>
                    <span className="font-medium">{student.batchYear}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Average SGPA</span>
                    <span className={`font-semibold ${getSGPAColor(avgSGPA)}`}>{avgSGPA !== null ? avgSGPA.toFixed(2) : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Semesters</span>
                    <span className="font-medium">{student.semesters.length}</span>
                  </div>
                  {student.college && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">College</span>
                      <span className="font-medium">{student.college.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="paper-panel p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-[var(--secondary)]" />
                  <h3 className="font-display text-lg">Highlights</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <p className="text-[var(--muted)]">Track your best semester and keep momentum going.</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Best SGPA</span>
                    <span className="font-semibold">{bestSGPA !== null ? bestSGPA.toFixed(2) : "-"}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
