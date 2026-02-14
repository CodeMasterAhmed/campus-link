"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Github, Twitter, Linkedin, Mail, Heart, TrendingUp, Users, BookOpen } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
    { href: "/students", label: "Students", icon: Users },
    { href: "/login", label: "Sign In", icon: BookOpen },
  ];

  return (
    <footer className="relative border-t border-[var(--border)] bg-[var(--surface-muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12">
          <div>
            <Link href="/" className="inline-flex items-center space-x-3 mb-5 group">
              <motion.div
                className="w-11 h-11 rounded-2xl bg-[var(--primary)] flex items-center justify-center shadow-lg shadow-blue-500/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <GraduationCap className="w-6 h-6 text-white" />
              </motion.div>
              <span className="text-2xl font-bold text-[var(--foreground)] font-display">
                Campus<span className="text-[var(--primary)]">Link</span>
              </span>
            </Link>
            <p className="text-[var(--muted)] max-w-md leading-relaxed mb-6">
              Your academic journey, visualized. Track results, compare progress, and connect with recruiters in one place.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: Github, href: "#", label: "GitHub" },
                { icon: Twitter, href: "#", label: "Twitter" },
                { icon: Linkedin, href: "#", label: "LinkedIn" },
                { icon: Mail, href: "#", label: "Email" },
              ].map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-11 h-11 rounded-full bg-white border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-[var(--foreground)] font-semibold mb-4">Explore</h3>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--primary)] transition-colors group"
                    >
                      <link.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[var(--foreground)] font-semibold mb-4">Contact</h3>
              <ul className="space-y-3 text-[var(--muted)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--secondary)] mt-0.5">📍</span>
                  <span>Muffakham Jah College of Engineering, Hyderabad</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--secondary)]">📧</span>
                  <a href="mailto:support@campuslink.edu" className="hover:text-[var(--primary)] transition-colors">
                    support@campuslink.edu
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-[var(--muted)]">
          <p>© {currentYear} Campus Link. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-4 h-4 text-red-500" /> for students
          </p>
        </div>
      </div>
    </footer>
  );
}
