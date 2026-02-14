"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import { useDelayedLoginRedirect } from "@/lib/hooks/use-delayed-login-redirect";
import { GraduationCap, TrendingUp, Calendar, CheckCircle, User, BookOpen, Loader2 } from "lucide-react";

interface SemesterData {
    semester: number | null;
    sgpa: number | null;
}

interface AcademicData {
    name: string;
    rollNumber: string;
    branch: string | null;
    batchYear: number | null;
    semesters: SemesterData[];
    currentCgpa: number | null;
    latestSgpa: number | null;
}

const DASHBOARD_CACHE_TTL_MS = 30_000;
let dashboardCache: { key: string; data: AcademicData; cachedAt: number } | null = null;

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    useDelayedLoginRedirect(status);
    const [academicData, setAcademicData] = useState<AcademicData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const userRole = session?.user?.role;
    const cacheKey = useMemo(
        () => `${session?.user?.id ?? ""}:${session?.user?.email ?? ""}`,
        [session?.user?.id, session?.user?.email]
    );

    useEffect(() => {
        if (status !== "authenticated" || !userRole) {
            return;
        }

        if (userRole === "RECRUITER") {
            router.replace("/dashboard/recruiter");
            return;
        }

        if (userRole === "ADMIN") {
            router.replace("/dashboard/admin");
            return;
        }

        if (
            dashboardCache &&
            dashboardCache.key === cacheKey &&
            Date.now() - dashboardCache.cachedAt < DASHBOARD_CACHE_TTL_MS
        ) {
            setAcademicData(dashboardCache.data);
            setLoading(false);
            setError("");
            return;
        }

        const controller = new AbortController();
        const loadStudentData = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch("/api/me/student", {
                    method: "GET",
                    signal: controller.signal,
                    cache: "no-store",
                });
                const payload = await response.json();
                if (!response.ok || !payload?.success || !payload?.data) {
                    setError(payload?.error || "Could not load your academic data.");
                    setAcademicData(null);
                    return;
                }

                const nextData = payload.data as AcademicData;
                setAcademicData(nextData);
                dashboardCache = {
                    key: cacheKey,
                    data: nextData,
                    cachedAt: Date.now(),
                };
            } catch (fetchError) {
                if ((fetchError as Error).name === "AbortError") {
                    return;
                }
                setError("Could not load your academic data.");
                setAcademicData(null);
            } finally {
                setLoading(false);
            }
        };

        loadStudentData();
        return () => controller.abort();
    }, [cacheKey, router, status, userRole]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex flex-col bg-[var(--background)]">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
                </main>
                <Footer />
            </div>
        );
    }

    const calculateCGPA = (semesters: SemesterData[]): number => {
        const validSgpas = semesters.map((sem) => sem.sgpa).filter((sgpa): sgpa is number => sgpa !== null);
        if (validSgpas.length === 0) return 0;
        const sum = validSgpas.reduce((acc, sgpa) => acc + sgpa, 0);
        return parseFloat((sum / validSgpas.length).toFixed(2));
    };

    const getLatestSgpa = (semesters: SemesterData[]): number => {
        const latest = [...semesters]
            .sort((a, b) => (b.semester ?? -1) - (a.semester ?? -1))
            .find((item) => item.sgpa !== null);
        return latest?.sgpa ?? 0;
    };

    if (status === "authenticated" && !loading && !academicData) {
        return (
            <div className="min-h-screen flex flex-col bg-[var(--background)]">
                <Navbar />
                <main className="flex-1 flex items-center justify-center px-4">
                    <div className="paper-panel p-8 max-w-lg w-full text-center">
                        <h1 className="font-display text-2xl mb-3">Dashboard data unavailable</h1>
                        <p className="text-[var(--muted)] mb-6">{error || "No student data linked to this account yet."}</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const cgpa = academicData?.currentCgpa ?? calculateCGPA(academicData?.semesters ?? []);
    const lastSemSgpa = academicData?.latestSgpa ?? getLatestSgpa(academicData?.semesters ?? []);
    const sortedSemesters = [...(academicData?.semesters ?? [])].sort((a, b) => (a.semester ?? 0) - (b.semester ?? 0));
    const cgpaValue = Number.isFinite(cgpa) && cgpa > 0 ? cgpa : "-";
    const latestSgpaValue = Number.isFinite(lastSemSgpa) && lastSemSgpa > 0 ? lastSemSgpa : "-";

    const stats = [
        { icon: GraduationCap, label: "Current CGPA", value: cgpaValue },
        { icon: TrendingUp, label: "Latest SGPA", value: latestSgpaValue },
        { icon: Calendar, label: "Semesters", value: sortedSemesters.length || 0 },
        { icon: CheckCircle, label: "Status", value: sortedSemesters.length > 0 ? "Active" : "Pending" },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
            <Navbar />

            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
                <section className="relative rounded-[32px] overflow-hidden mb-10">
                    <Image
                        src="/stock/campus-walk.jpg"
                        alt="Campus"
                        width={1400}
                        height={420}
                        className="w-full h-[260px] sm:h-[320px] object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/35" />
                    <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end text-white">
                        <p className="text-xs uppercase tracking-[0.3em] mb-3">Dashboard</p>
                        <h1 className="font-display text-3xl sm:text-4xl">
                            Welcome back, {academicData?.name || session?.user?.name || "Student"}
                        </h1>
                        <p className="text-white/80 mt-2 max-w-xl">
                            Here&apos;s a quick snapshot of your academic performance and profile highlights.
                        </p>
                    </div>
                </section>

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {stats.map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                                    <stat.icon className="w-5 h-5 text-[var(--primary)]" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{stat.label}</p>
                                    <p className="text-xl font-semibold text-[var(--foreground)]">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="paper-panel p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                            <h2 className="font-display text-xl">Semester Performance</h2>
                        </div>
                        <p className="text-[var(--muted)] text-sm mb-6">Your SGPA trend over semesters</p>
                        <div className="space-y-4">
                            {sortedSemesters.map((sem, idx) => (
                                <motion.div
                                    key={`${sem.semester ?? "NA"}-${idx}`}
                                    className="flex items-center gap-4"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + idx * 0.05 }}
                                >
                                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] w-16">
                                        Sem {sem.semester ?? "-"}
                                    </span>
                                    <div className="flex-1 bg-[var(--surface-muted)] rounded-full h-3 overflow-hidden">
                                        <motion.div
                                            className="h-3 rounded-full bg-[var(--primary)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${((sem.sgpa ?? 0) / 10) * 100}%` }}
                                            transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold w-10 text-[var(--foreground)]">{sem.sgpa ?? "-"}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="paper-panel p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <User className="w-5 h-5 text-[var(--primary)]" />
                            <h2 className="font-display text-xl">Profile Details</h2>
                        </div>
                        <p className="text-[var(--muted)] text-sm mb-6">Your academic profile information</p>
                        <div className="space-y-4">
                            {[
                                { icon: User, label: "Name", value: academicData?.name || "-" },
                                { icon: BookOpen, label: "Roll Number", value: academicData?.rollNumber || "-" },
                                { icon: GraduationCap, label: "Branch", value: academicData?.branch || "-" },
                                { icon: Calendar, label: "Batch Year", value: academicData?.batchYear || "-" },
                                { icon: TrendingUp, label: "Overall CGPA", value: cgpaValue },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                                    <span className="text-sm text-[var(--muted)] flex items-center gap-2">
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </span>
                                    <span className="text-sm font-semibold text-[var(--foreground)]">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
