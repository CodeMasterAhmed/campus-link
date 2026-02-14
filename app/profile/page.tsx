"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import { useDelayedLoginRedirect } from "@/lib/hooks/use-delayed-login-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, User, Building2, GraduationCap, Mail, ShieldCheck } from "lucide-react";

type ProfilePayload = {
  id: number;
  name: string;
  email: string;
  role: "STUDENT" | "RECRUITER" | "ADMIN";
  status: "ACTIVE" | "PENDING" | "REJECTED";
  profileImageUrl: string | null;
  college: {
    id: number;
    name: string;
    code: string;
    emailDomain: string;
  } | null;
  studentProfile: {
    headline: string | null;
    about: string | null;
    yearOfStudy: number | null;
    ussScore: number | null;
    skills: string[];
    academic: {
      rollNumber: string;
      studentName: string | null;
      branch: string | null;
      batchYear: number | null;
      college: {
        id: number;
        name: string;
        code: string;
      } | null;
      latestSgpa: number | null;
      currentCgpa: number | null;
      totalBacklogs: number;
    };
  } | null;
  recruiterProfile: {
    companyName: string | null;
    companyWebsite: string | null;
    companyAbout: string | null;
    hiringFocus: string | null;
  } | null;
  canEdit: boolean;
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useDelayedLoginRedirect(status);
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  const [name, setName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAbout, setCompanyAbout] = useState("");
  const [hiringFocus, setHiringFocus] = useState("");

  const targetUserId = useMemo(() => {
    if (session?.user?.role !== "ADMIN") return null;
    const value = searchParams.get("userId");
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [searchParams, session?.user?.role]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const query = targetUserId ? `?userId=${targetUserId}` : "";
      const response = await fetch(`/api/me/profile${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to load profile.");
        setProfile(null);
        return;
      }

      const nextProfile = payload.profile as ProfilePayload;
      setProfile(nextProfile);

      setName(nextProfile.name || "");
      setProfileImageUrl(nextProfile.profileImageUrl || "");
      setHeadline(nextProfile.studentProfile?.headline || "");
      setAbout(nextProfile.studentProfile?.about || "");
      setYearOfStudy(
        nextProfile.studentProfile?.yearOfStudy ? String(nextProfile.studentProfile.yearOfStudy) : ""
      );
      setCompanyName(nextProfile.recruiterProfile?.companyName || "");
      setCompanyWebsite(nextProfile.recruiterProfile?.companyWebsite || "");
      setCompanyAbout(nextProfile.recruiterProfile?.companyAbout || "");
      setHiringFocus(nextProfile.recruiterProfile?.hiringFocus || "");
    } catch {
      setError("Failed to load profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, targetUserId]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile?.canEdit) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let body: Record<string, unknown>;
      if (profile.role === "STUDENT") {
        body = {
          profileImageUrl: profileImageUrl.trim(),
          headline: headline.trim(),
          about: about.trim(),
          yearOfStudy: yearOfStudy.trim() ? Number(yearOfStudy.trim()) : null,
        };
      } else if (profile.role === "RECRUITER") {
        body = {
          name: name.trim(),
          profileImageUrl: profileImageUrl.trim(),
          companyName: companyName.trim(),
          companyWebsite: companyWebsite.trim(),
          companyAbout: companyAbout.trim(),
          hiringFocus: hiringFocus.trim(),
        };
      } else {
        body = {
          name: name.trim(),
          profileImageUrl: profileImageUrl.trim(),
        };
      }

      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to save profile.");
        return;
      }

      setSuccess("Profile updated successfully.");
      await loadProfile();
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Navbar />
        <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="paper-panel p-8 max-w-lg w-full text-center">
            <h1 className="font-display text-2xl mb-2">Profile unavailable</h1>
            <p className="text-[var(--muted)]">{error || "Could not load this profile."}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="paper-panel p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-20 h-20 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden flex items-center justify-center text-2xl font-semibold shrink-0">
                {profile.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.name?.charAt(0) || <User className="w-7 h-7 text-[var(--muted)]" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-3xl">{
                  profile.canEdit ? "My Profile" : `${profile.name}'s Profile`
                }</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{profile.role}</Badge>
                  <Badge variant={profile.status === "ACTIVE" ? "success" : profile.status === "PENDING" ? "warning" : "destructive"}>
                    {profile.status}
                  </Badge>
                  {profile.college && (
                    <Badge variant="info">
                      {profile.college.name} ({profile.college.code})
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6">
            <section className="paper-panel p-6 space-y-4">
              <h2 className="font-display text-xl flex items-center gap-2">
                <Mail className="w-5 h-5 text-[var(--primary)]" />
                Account
              </h2>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Email</p>
                <Input value={profile.email} disabled />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Role</p>
                <Input value={profile.role} disabled />
              </div>
              {profile.studentProfile?.academic && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Academic Snapshot (Read-only)</p>
                  <p className="text-sm">Roll Number: <span className="font-semibold">{profile.studentProfile.academic.rollNumber}</span></p>
                  <p className="text-sm">Branch: <span className="font-semibold">{profile.studentProfile.academic.branch || "-"}</span></p>
                  <p className="text-sm">Batch: <span className="font-semibold">{profile.studentProfile.academic.batchYear || "-"}</span></p>
                  <p className="text-sm">Current SGPA: <span className="font-semibold">{profile.studentProfile.academic.currentCgpa ?? "-"}</span></p>
                  <p className="text-sm">Backlogs: <span className="font-semibold">{profile.studentProfile.academic.totalBacklogs}</span></p>
                </div>
              )}
              {profile.recruiterProfile && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Recruiter Summary</p>
                  <p className="text-sm text-[var(--muted)]">
                    {profile.recruiterProfile.companyName || "Recruiter profile not completed yet."}
                  </p>
                </div>
              )}
            </section>

            <section className="paper-panel p-6">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                {profile.role === "STUDENT" ? (
                  <>
                    <GraduationCap className="w-5 h-5 text-[var(--primary)]" />
                    Student Profile
                  </>
                ) : profile.role === "RECRUITER" ? (
                  <>
                    <Building2 className="w-5 h-5 text-[var(--primary)]" />
                    Recruiter Profile
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                    Admin Profile
                  </>
                )}
              </h2>

              <form className="space-y-4" onSubmit={handleSave}>
                {profile.role !== "STUDENT" && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Name</p>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={!profile.canEdit}
                    />
                  </div>
                )}

                {profile.role === "STUDENT" && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Name (Read-only)</p>
                    <Input value={profile.name} disabled />
                  </div>
                )}

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Profile Image URL</p>
                  <Input
                    value={profileImageUrl}
                    onChange={(event) => setProfileImageUrl(event.target.value)}
                    disabled={!profile.canEdit}
                    placeholder="https://..."
                  />
                </div>

                {profile.role === "STUDENT" && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Headline</p>
                      <Input
                        value={headline}
                        onChange={(event) => setHeadline(event.target.value)}
                        disabled={!profile.canEdit}
                        placeholder="Short profile headline"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">About</p>
                      <textarea
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        rows={5}
                        value={about}
                        onChange={(event) => setAbout(event.target.value)}
                        disabled={!profile.canEdit}
                        placeholder="Tell others about your goals and strengths."
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Year of Study</p>
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        value={yearOfStudy}
                        onChange={(event) => setYearOfStudy(event.target.value)}
                        disabled={!profile.canEdit}
                      />
                    </div>
                  </>
                )}

                {profile.role === "RECRUITER" && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Company Name</p>
                      <Input
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        disabled={!profile.canEdit}
                        placeholder="Your company or hiring organization"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Company Website</p>
                      <Input
                        value={companyWebsite}
                        onChange={(event) => setCompanyWebsite(event.target.value)}
                        disabled={!profile.canEdit}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Company About</p>
                      <textarea
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        rows={4}
                        value={companyAbout}
                        onChange={(event) => setCompanyAbout(event.target.value)}
                        disabled={!profile.canEdit}
                        placeholder="What your company does."
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Hiring Focus</p>
                      <textarea
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        rows={4}
                        value={hiringFocus}
                        onChange={(event) => setHiringFocus(event.target.value)}
                        disabled={!profile.canEdit}
                        placeholder="What kind of candidates are you looking for?"
                      />
                    </div>
                  </>
                )}

                {profile.canEdit && (
                  <motion.div whileTap={{ scale: 0.98 }} className="pt-2">
                    <Button type="submit" className="gap-2" disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile
                    </Button>
                  </motion.div>
                )}
              </form>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
