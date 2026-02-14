"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Navbar, Footer } from "@/components/layout";
import { Briefcase, Users, Search, MessageSquare, Clock, Bookmark } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RecruiterDashboard() {
    return (
        <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
            <Navbar />

            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    <motion.section
                        className="relative rounded-[32px] overflow-hidden mb-10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Image
                            src="/stock/recruiter-meeting.jpg"
                            alt="Recruiter"
                            width={1200}
                            height={420}
                            className="w-full h-[240px] sm:h-[300px] object-cover"
                            priority
                        />
                        <div className="absolute inset-0 bg-black/35" />
                        <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end text-white">
                            <p className="text-xs uppercase tracking-[0.3em] mb-2">Recruiter Dashboard</p>
                            <h1 className="font-display text-3xl sm:text-4xl">Talent discovery, refined.</h1>
                            <p className="text-white/80 mt-2 max-w-xl">
                                Browse student profiles, filter by branch and performance, and reach out directly.
                            </p>
                        </div>
                    </motion.section>

                    <motion.div
                        className="paper-panel p-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--secondary)] flex items-center justify-center">
                                <Briefcase className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="font-display text-2xl">Recruiter tools are on the way</h2>
                                <p className="text-[var(--muted)]">We&apos;re polishing the new experience.</p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 mb-8">
                            {[
                                { icon: Search, label: "Find talent faster" },
                                { icon: Users, label: "View verified profiles" },
                                { icon: MessageSquare, label: "Send outreach messages" },
                                { icon: Clock, label: "Track applications" },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] flex items-center justify-center">
                                        <item.icon className="w-5 h-5 text-[var(--primary)]" />
                                    </div>
                                    <span className="text-sm font-medium">{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link href="/students">
                                <Button className="gap-2">
                                    <Users className="w-4 h-4" />
                                    Browse Students
                                </Button>
                            </Link>
                            <Link href="/dashboard/recruiter/watchlist">
                                <Button variant="outline" className="gap-2">
                                    <Bookmark className="w-4 h-4" />
                                    Open Watchlist
                                </Button>
                            </Link>
                            <Link href="/messages">
                                <Button variant="outline" className="gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Open Messages
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
