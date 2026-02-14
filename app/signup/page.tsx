"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Briefcase, ArrowLeft, CheckCircle, Loader2, Mail, Lock, User, Hash, Building } from "lucide-react";

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"student" | "recruiter" | null>(null);
  const [createdStudent, setCreatedStudent] = useState<{ userId: number; email: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNumber: "",
    companyName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (selectedRole: "student" | "recruiter") => {
    setRole(selectedRole);
    setStep(2);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const endpoint = role === "student"
        ? "/api/auth/signup-student"
        : "/api/auth/signup-recruiter";

      const body = role === "student"
        ? {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            rollNumber: formData.rollNumber,
          }
        : {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            companyName: formData.companyName,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      if (role === "student") {
        const userId = Number(data?.result?.user?.id);
        const email = String(data?.result?.user?.email || "").trim().toLowerCase();
        if (Number.isFinite(userId) && userId > 0 && email) {
          setCreatedStudent({ userId, email });
        } else {
          setCreatedStudent(null);
        }
      } else {
        setCreatedStudent(null);
      }

      setStep(3);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyHref = createdStudent
    ? `/verify-email?userId=${createdStudent.userId}&email=${encodeURIComponent(createdStudent.email)}`
    : `/verify-email${formData.email ? `?email=${encodeURIComponent(formData.email.trim().toLowerCase())}` : ""}`;

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
              src="/stock/students-collab.jpg"
              alt="Students"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
              <p className="text-xs uppercase tracking-[0.3em] mb-3">Join Campus Link</p>
              <h1 className="font-display text-3xl sm:text-4xl mb-3">
                Build a profile recruiters remember.
              </h1>
              <p className="text-white/80 max-w-sm">
                Choose your role, create your account, and unlock your academic dashboard.
              </p>
            </div>
          </motion.div>

          <div className="paper-panel p-8 sm:p-10 self-center">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--primary)] flex items-center justify-center mx-auto mb-4">
                      <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="font-display text-2xl mb-2">Choose your path</h2>
                    <p className="text-[var(--muted)]">Pick the experience that fits you best.</p>
                  </div>

                  <div className="space-y-4">
                    <motion.button
                      onClick={() => handleRoleSelect("student")}
                      className="w-full p-5 rounded-2xl border border-[var(--border)] bg-white/80 hover:border-[var(--primary)] transition-all text-left group"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                          <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">I&apos;m a Student</h3>
                          <p className="text-sm text-[var(--muted)]">Track results and build your profile</p>
                        </div>
                      </div>
                    </motion.button>

                    <motion.button
                      onClick={() => handleRoleSelect("recruiter")}
                      className="w-full p-5 rounded-2xl border border-[var(--border)] bg-white/80 hover:border-[var(--secondary)] transition-all text-left group"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[var(--secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">I&apos;m a Recruiter</h3>
                          <p className="text-sm text-[var(--muted)]">Find and connect with students</p>
                        </div>
                      </div>
                    </motion.button>

                    <div className="text-center text-sm text-[var(--muted)] pt-4">
                      Already have an account?{" "}
                      <Link href="/login" className="text-[var(--primary)] hover:text-blue-700 transition-colors">
                        Sign in
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-8">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                        role === "student" ? "bg-[var(--primary)]" : "bg-[var(--secondary)]"
                      }`}
                    >
                      {role === "student" ? (
                        <GraduationCap className="w-7 h-7 text-white" />
                      ) : (
                        <Briefcase className="w-7 h-7 text-white" />
                      )}
                    </div>
                    <h2 className="font-display text-2xl mb-2">
                      {role === "student" ? "Student Registration" : "Recruiter Registration"}
                    </h2>
                    <p className="text-[var(--muted)]">Fill in your details to create your account.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm"
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2">
                      <label className="text-sm text-[var(--foreground)] flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Full Name
                      </label>
                      <Input
                        type="text"
                        name="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-[var(--foreground)] flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </label>
                      <Input
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {role === "student" && (
                      <motion.div
                        className="space-y-2"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <label className="text-sm text-[var(--foreground)] flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          Roll Number
                        </label>
                        <Input
                          type="text"
                          name="rollNumber"
                          placeholder="160421733XXX"
                          value={formData.rollNumber}
                          onChange={handleChange}
                          required
                        />
                        <p className="text-xs text-[var(--muted)]">Your roll number links your academic records.</p>
                      </motion.div>
                    )}

                    {role === "recruiter" && (
                      <motion.div
                        className="space-y-2"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <label className="text-sm text-[var(--foreground)] flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          Company Name
                        </label>
                        <Input
                          type="text"
                          name="companyName"
                          placeholder="Acme Inc."
                          value={formData.companyName}
                          onChange={handleChange}
                          required
                        />
                      </motion.div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm text-[var(--foreground)] flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Password
                      </label>
                      <Input
                        type="password"
                        name="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-[var(--foreground)] flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Confirm Password
                      </label>
                      <Input
                        type="password"
                        name="confirmPassword"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <motion.div
                    className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                  >
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </motion.div>
                  <h2 className="font-display text-2xl mb-4">Account Created!</h2>
                  {role === "student" ? (
                    <>
                      <p className="text-[var(--muted)] mb-2">
                        OTP sent to{" "}
                        <span className="font-medium text-[var(--foreground)]">
                          {createdStudent?.email || formData.email.trim().toLowerCase()}
                        </span>
                        .
                      </p>
                      <p className="text-[var(--muted)] mb-6">
                        Verify OTP before signing in.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link href={verifyHref}>
                          <Button className="gap-2">Verify OTP</Button>
                        </Link>
                        <Link href="/login">
                          <Button variant="outline" className="gap-2">
                            Go to Login
                          </Button>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[var(--muted)] mb-6">
                        Your recruiter account request has been submitted and is pending admin approval.
                      </p>
                      <Link href="/login">
                        <Button className="gap-2">
                          Go to Login
                        </Button>
                      </Link>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
