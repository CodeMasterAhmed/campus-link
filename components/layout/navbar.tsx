"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X, GraduationCap, TrendingUp, Users, LogOut, User, LayoutDashboard, Bot, MessageCircle, Bookmark } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dashboardHref =
    session?.user?.role === "RECRUITER"
      ? "/dashboard/recruiter"
      : session?.user?.role === "ADMIN"
      ? "/dashboard/admin"
      : "/dashboard";

  const navLinks = [
    { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
    { href: "/students", label: "Students", icon: Users },
    ...(session
      ? [
          { href: "/assistant", label: "Assistant", icon: Bot },
          { href: "/messages", label: "Messages", icon: MessageCircle },
        ]
      : []),
    ...(session?.user?.role === "RECRUITER"
      ? [{ href: "/dashboard/recruiter/watchlist", label: "Watchlist", icon: Bookmark }]
      : []),
  ];

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-[rgba(246,241,234,0.9)] backdrop-blur-xl border-b border-[var(--border)]"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-3 group">
            <motion.div
              className="w-10 h-10 rounded-2xl bg-[var(--primary)] flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <GraduationCap className="w-6 h-6 text-white" />
            </motion.div>
            <span className="text-xl font-bold text-[var(--foreground)] hidden sm:block font-display">
              Campus<span className="text-[var(--primary)]">Link</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <motion.div
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </motion.div>
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-3">
            {status === "loading" ? (
              <div className="w-24 h-9 bg-black/10 rounded-full animate-pulse" />
            ) : session ? (
              <div className="flex items-center gap-3">
                <Link href={dashboardHref}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="ghost" className="text-[var(--foreground)] hover:bg-black/5 rounded-full">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/profile">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                      {session.user?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={session.user.image} alt={session.user.name || "User"} className="w-full h-full object-cover" />
                      ) : (
                        session.user?.name?.charAt(0) || <User className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[var(--foreground)] text-sm max-w-[100px] truncate">
                      {session.user?.name || "User"}
                    </span>
                  </div>
                </Link>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signOut()}
                    className="text-[var(--muted)] hover:text-red-600 hover:bg-red-50 rounded-full"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </motion.div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="ghost" className="text-[var(--foreground)] rounded-full">
                      Sign In
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/signup">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button className="bg-[var(--primary)] hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/25">
                      Get Started
                    </Button>
                  </motion.div>
                </Link>
              </div>
            )}
          </div>

          <motion.button
            className="md:hidden p-2 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.95 }}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </motion.button>
        </div>
      </div>

      <motion.div
        className={`md:hidden border-t border-[var(--border)] bg-[rgba(246,241,234,0.95)] backdrop-blur-xl ${mobileMenuOpen ? "block" : "hidden"}`}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: mobileMenuOpen ? 1 : 0, height: mobileMenuOpen ? "auto" : 0 }}
      >
        <div className="px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--foreground)] hover:bg-black/5 transition-all">
                <link.icon className="w-5 h-5" />
                {link.label}
              </div>
            </Link>
          ))}

          <div className="pt-4 border-t border-[var(--border)] space-y-2">
            {session ? (
              <>
                <Link href={dashboardHref} onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--foreground)] hover:bg-black/5">
                    <LayoutDashboard className="w-5 h-5" />
                    Dashboard
                  </div>
                </Link>
                <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--foreground)] hover:bg-black/5">
                    <User className="w-5 h-5" />
                    Profile
                  </div>
                </Link>
                <button
                  onClick={() => { signOut(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center justify-center px-4 py-3 rounded-2xl text-[var(--foreground)] hover:bg-black/5">
                    Sign In
                  </div>
                </Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center justify-center px-4 py-3 rounded-2xl bg-[var(--primary)] text-white font-medium">
                    Get Started
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.nav>
  );
}
