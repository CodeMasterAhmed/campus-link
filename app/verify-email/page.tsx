"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Mail, Hash } from "lucide-react";

type VerifyFailureReason =
  | "INVALID_PAYLOAD"
  | "USER_NOT_FOUND"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "RESOLUTION_FAILED";

function toVerifyErrorMessage(reason?: VerifyFailureReason, fallback?: string) {
  switch (reason) {
    case "INVALID_PAYLOAD":
      return "Verification request is invalid. Reopen the signup link and try again.";
    case "USER_NOT_FOUND":
      return "No account was found for this email or alias.";
    case "TOKEN_INVALID":
      return "OTP token is invalid. Check the code and try again.";
    case "TOKEN_EXPIRED":
      return "OTP token has expired. Please request a new verification email.";
    case "TOKEN_ALREADY_USED":
      return "This OTP was already used. You can now sign in.";
    case "RESOLUTION_FAILED":
      return "Could not resolve your account for verification.";
    default:
      return fallback || "Verification failed.";
  }
}

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const emailFromQuery = params.get("email");
    const userIdFromQuery = Number(params.get("userId") || "");

    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
    if (Number.isFinite(userIdFromQuery) && userIdFromQuery > 0) {
      setUserId(userIdFromQuery);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedToken = token.trim();
      if (!normalizedToken) {
        setError("Enter the OTP token from your email.");
        return;
      }

      const payload: { token: string; userId?: number; email?: string } = { token: normalizedToken };
      if (userId) {
        payload.userId = userId;
      } else if (email.trim()) {
        payload.email = email.trim().toLowerCase();
      } else {
        setError("Enter your email or open this page from signup.");
        return;
      }

      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(toVerifyErrorMessage(data.reason as VerifyFailureReason | undefined, data.error));
        return;
      }

      setVerified(true);
    } catch {
      setError("Could not verify token right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="paper-panel border border-[var(--border)]">
              {!verified ? (
                <>
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl">Verify Email OTP</CardTitle>
                    <CardDescription className="text-[var(--muted)]">
                      Enter the OTP token sent to your inbox.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                          {error}
                        </div>
                      )}

                      {!userId && (
                        <div className="space-y-2">
                          <label className="text-sm text-[var(--muted)] flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email or Student Alias
                          </label>
                          <Input
                            type="text"
                            placeholder="160421733001@college or you@college.ac.in"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required={!userId}
                          />
                          <p className="text-xs text-[var(--muted)]">
                            Use canonical email or alias format `12digit@college`.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)] flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          OTP Token
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter OTP token"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          required
                        />
                      </div>

                      <Button type="submit" className="w-full gap-2" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify Email"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </>
              ) : (
                <CardContent className="py-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Email Verified</h2>
                  <p className="text-[var(--muted)] mb-6">Your account is now active for sign in.</p>
                  <Link href="/login">
                    <Button>Go to Login</Button>
                  </Link>
                </CardContent>
              )}
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
