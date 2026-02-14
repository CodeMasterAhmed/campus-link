"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  ChevronRight,
  GraduationCap,
  Users,
  Briefcase,
  TrendingUp,
} from "lucide-react";

interface Stats {
  totalStudents: number;
  branches: { code: string | null; count: number }[];
  batches: { year: number | null; count: number }[];
  semesters: number[];
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
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
    fetchStats();
  }, []);

  const statItems = [
    {
      label: "Students",
      value: stats?.totalStudents ? stats.totalStudents.toLocaleString() : "12k+",
    },
    {
      label: "Branches",
      value: stats?.branches?.length ? stats.branches.length.toString() : "12",
    },
    {
      label: "Batches",
      value: stats?.batches?.length ? stats.batches.length.toString() : "6",
    },
    {
      label: "Semesters",
      value: stats?.semesters?.length ? stats.semesters.length.toString() : "8",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="flex-1 pt-20">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[rgba(29,78,216,0.12)] blur-3xl" />
            <div className="absolute top-24 right-0 w-96 h-96 rounded-full bg-[rgba(249,115,22,0.14)] blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <motion.div initial="initial" animate="animate" variants={fadeUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[var(--border)] text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-6">
                <Sparkles className="w-4 h-4 text-[var(--secondary)]" />
                Campus Link
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
                A warmer way to navigate
                <span className="text-gradient"> your campus journey</span>.
              </h1>
              <p className="text-lg text-[var(--muted)] max-w-xl mb-8">
                Track results, compare progress, and build a profile that recruiters actually want to read. Designed to
                feel like a modern campus magazine, not another portal.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/students">
                  <Button size="lg" className="group">
                    Explore Students
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/leaderboard">
                  <Button variant="outline" size="lg">
                    View Leaderboard
                  </Button>
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
                {statItems.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-2xl font-semibold text-[var(--foreground)]">
                      {stat.value}
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="relative h-[420px] sm:h-[520px]">
                <div className="absolute -left-6 top-10 w-56 h-72 sm:w-64 sm:h-80 rotate-[-6deg] rounded-3xl overflow-hidden shadow-2xl border border-white">
                  <Image
                    src="/stock/students-collab.jpg"
                    alt="Students collaborating"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="absolute right-0 top-0 w-64 h-80 sm:w-72 sm:h-96 rotate-[4deg] rounded-3xl overflow-hidden shadow-2xl border border-white">
                  <Image
                    src="/stock/campus-hero.jpg"
                    alt="Campus"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="absolute left-20 bottom-0 w-56 h-64 sm:w-60 sm:h-72 rotate-[2deg] rounded-3xl overflow-hidden shadow-2xl border border-white">
                  <Image
                    src="/stock/library-study.jpg"
                    alt="Library study"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] mb-3">How it works</p>
                <h2 className="font-display text-3xl sm:text-4xl mb-4">Three steps to stay ahead</h2>
                <p className="text-[var(--muted)]">
                  Designed around the real academic cycle: log results, track growth, and showcase your progress.
                </p>
              </div>
              <div className="relative pl-10">
                <span className="absolute left-3 top-0 bottom-0 w-px bg-[var(--border)]" />
                {[
                  {
                    title: "Import your academic story",
                    body: "Results, semester history, and highlights all stitched into one profile.",
                  },
                  {
                    title: "See where you stand",
                    body: "Rankings and filters surface your position across branches and batches.",
                  },
                  {
                    title: "Get discovered",
                    body: "Recruiters find your skills, not just your scores.",
                  },
                ].map((step, index) => (
                  <div key={step.title} className="relative pb-10 pl-12">
                    <span className="absolute -left-2.5 top-0 w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-semibold">
                      0{index + 1}
                    </span>
                    <h3 className="font-display text-xl mb-2">{step.title}</h3>
                    <p className="text-[var(--muted)] max-w-lg">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-[32px] overflow-hidden border border-white shadow-2xl">
              <Image
                src="/stock/campus-walk.jpg"
                alt="Campus story"
                width={1400}
                height={600}
                className="w-full h-[320px] sm:h-[380px] object-cover"
              />
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-end text-white">
                <p className="text-xs uppercase tracking-[0.3em] mb-2">Campus story</p>
                <h3 className="font-display text-3xl sm:text-4xl max-w-xl">
                  Every semester is a chapter. Make yours unforgettable.
                </h3>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
            {[
              {
                title: "For Students",
                body: "Track progress, build your profile, and highlight your strengths in a clean portfolio.",
                bullets: ["Profile snapshots", "SGPA timeline", "Skills & achievements"],
                image: "/stock/students-collab.jpg",
                icon: GraduationCap,
              },
              {
                title: "For Recruiters",
                body: "Find the right candidates faster with filters that surface talent by branch and performance.",
                bullets: ["Targeted search", "Verified results", "Direct outreach"],
                image: "/stock/recruiter-meeting.jpg",
                icon: Briefcase,
              },
            ].map((panel) => (
              <div key={panel.title} className="paper-panel p-6 sm:p-8 grid sm:grid-cols-[1fr_1.1fr] gap-6 items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] mb-3">
                    <panel.icon className="w-4 h-4 text-[var(--secondary)]" />
                    {panel.title}
                  </div>
                  <h3 className="font-display text-2xl mb-3">{panel.body}</h3>
                  <ul className="space-y-2 text-[var(--muted)]">
                    {panel.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-[var(--primary)]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden">
                  <Image src={panel.image} alt={panel.title} fill className="object-cover" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-[var(--border)] bg-white px-6 py-4 text-sm">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Users className="w-4 h-4" />
                Students tracked daily
              </div>
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <TrendingUp className="w-4 h-4" />
                Live leaderboard updates
              </div>
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Briefcase className="w-4 h-4" />
                Recruiter-ready profiles
              </div>
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <GraduationCap className="w-4 h-4" />
                Built for Muffakham Jah College
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="paper-panel p-6 sm:p-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] mb-3">Get started</p>
                <h2 className="font-display text-3xl sm:text-4xl mb-4">
                  Turn grades into stories recruiters remember.
                </h2>
                <p className="text-[var(--muted)] mb-6">
                  Create your account in minutes, then watch your academic journey unfold in a clean, editorial layout.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/signup">
                    <Button size="lg" className="group">
                      Create Account
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/students">
                    <Button variant="outline" size="lg">
                      Browse Students
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="relative h-56 sm:h-64 rounded-3xl overflow-hidden">
                <Image src="/stock/lab-research.jpg" alt="Research" fill className="object-cover" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
