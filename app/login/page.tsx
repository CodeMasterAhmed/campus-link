"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, ArrowRight, Sparkles } from "lucide-react";

type LoginCheckReason =
    | "OK"
    | "INVALID_CREDENTIALS"
    | "PENDING_APPROVAL"
    | "INACTIVE_ACCOUNT"
    | "EMAIL_NOT_VERIFIED"
    | "RATE_LIMITED";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
};

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [errorReason, setErrorReason] = useState<LoginCheckReason | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setErrorReason(null);

        try {
            const loginCheckRes = await fetch("/api/auth/login-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                }),
            });
            const loginCheckData = await loginCheckRes.json().catch(() => ({}));
            const reason = (loginCheckData?.reason as LoginCheckReason | undefined) ?? "INVALID_CREDENTIALS";

            if (!loginCheckRes.ok || !loginCheckData?.ok || reason !== "OK") {
                setErrorReason(reason);
                if (reason === "EMAIL_NOT_VERIFIED") {
                    setError("Your account exists but email OTP is not verified.");
                } else if (reason === "RATE_LIMITED") {
                    setError("Too many login attempts. Please wait and try again.");
                } else if (reason === "PENDING_APPROVAL") {
                    setError("Your recruiter account is pending admin approval.");
                } else if (reason === "INACTIVE_ACCOUNT") {
                    setError("Your account is inactive. Please contact support.");
                } else {
                    setError("Invalid email or password");
                }
                return;
            }

            const result = await signIn("credentials", {
                email: email.trim().toLowerCase(),
                password,
                redirect: false,
            });

            if (result?.ok) {
                router.push("/dashboard");
            } else {
                setErrorReason("INVALID_CREDENTIALS");
                setError("Invalid email or password");
            }
        } catch {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
            <Navbar />

            <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-stretch">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="relative rounded-[32px] overflow-hidden min-h-[320px] lg:min-h-[560px]"
                    >
                        <Image
                            src="/stock/library-study.jpg"
                            alt="Library"
                            fill
                            className="object-cover"
                            priority
                        />
                        <div className="absolute inset-0 bg-black/35" />
                        <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
                            <p className="text-xs uppercase tracking-[0.3em] mb-3">Welcome back</p>
                            <h1 className="font-display text-3xl sm:text-4xl mb-3">
                                Your campus story continues here.
                            </h1>
                            <p className="text-white/80 max-w-sm">
                                Sign in to access your dashboard, results, and profile insights.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={fadeInUp}
                        className="paper-panel p-8 sm:p-10 self-center"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[var(--border)] text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-6">
                            <Sparkles className="w-4 h-4 text-[var(--secondary)]" />
                            Sign In
                        </div>
                        <h2 className="font-display text-3xl mb-2">Access Campus Link</h2>
                        <p className="text-[var(--muted)] mb-8">Track your academic journey with a clean, modern dashboard.</p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm"
                                >
                                    <div className="flex items-start gap-2">
                                        <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <div>{error}</div>
                                            {errorReason === "EMAIL_NOT_VERIFIED" && (
                                                <Link
                                                    href={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                                                    className="underline underline-offset-2 hover:no-underline"
                                                >
                                                    Verify OTP
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-[var(--muted)]" />
                                    Email
                                </label>
                                <Input
                                    id="email"
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com or 12digit@college"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-[var(--muted)]" />
                                    Password
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                <Button
                                    type="submit"
                                    className="w-full h-12"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                        />
                                    ) : (
                                        <>
                                            Sign In
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        </form>
                        <p className="mt-3 text-xs text-[var(--muted)]">
                            Just signed up?{" "}
                            <Link href="/verify-email" className="text-[var(--primary)] hover:text-blue-700 transition-colors">
                                Verify OTP first.
                            </Link>
                        </p>

                        <div className="mt-8">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-[var(--border)]" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-[var(--surface)] text-[var(--muted)]">
                                        Or continue with
                                    </span>
                                </div>
                            </div>

                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full mt-6 h-12"
                                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path
                                            fill="#4285F4"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Continue with Google
                                </Button>
                            </motion.div>
                        </div>

                        <p className="mt-8 text-center text-sm text-[var(--muted)]">
                            Don&apos;t have an account?{" "}
                            <Link href="/signup" className="text-[var(--primary)] hover:text-blue-700 font-medium transition-colors">
                                Sign up
                            </Link>
                        </p>
                    </motion.div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
