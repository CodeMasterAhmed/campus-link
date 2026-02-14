"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Navbar, Footer } from "@/components/layout";
import { useDelayedLoginRedirect } from "@/lib/hooks/use-delayed-login-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Pencil, Check, X, GitCompareArrows } from "lucide-react";

type WatchlistItem = {
  id: number;
  rollNumber: string;
  name: string | null;
  branch: string | null;
  batchYear: number | null;
  latestSgpa: number | null;
  avgSgpa: number | null;
  backlogCount: number;
  note: string;
  tags: string[];
  skills: string[];
};

type CompareRow = {
  watchlistId: number;
  rollNumber: string;
  name: string | null;
  branch: string | null;
  batchYear: number | null;
  latestSgpa: number | null;
  avgSgpa: number | null;
  backlogCount: number;
  topSkills: string[];
  note: string;
};

export default function RecruiterWatchlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useDelayedLoginRedirect(status);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const canCompare = selectedIds.length >= 2 && selectedIds.length <= 4;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/watchlist", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to load watchlist");
        return;
      }
      setItems(payload.watchlist as WatchlistItem[]);
    } catch {
      setError("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session.user.role !== "RECRUITER") {
      router.replace("/dashboard");
      return;
    }
    fetchWatchlist();
  }, [status, session, router]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to remove candidate");
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
      setCompareRows((prev) => prev.filter((row) => row.watchlistId !== id));
    } catch {
      setError("Failed to remove candidate");
    }
  };

  const startEdit = (item: WatchlistItem) => {
    setEditingId(item.id);
    setNoteInput(item.note || "");
    setTagsInput(item.tags.join(", "));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNoteInput("");
    setTagsInput("");
  };

  const saveEdit = async (id: number) => {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: noteInput,
          tags,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to update note");
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, note: noteInput, tags } : item))
      );
      cancelEdit();
    } catch {
      setError("Failed to update note");
    }
  };

  const runCompare = async () => {
    if (!canCompare) return;
    try {
      const response = await fetch("/api/watchlist/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlistIds: selectedIds }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to compare candidates");
        return;
      }
      setCompareRows(payload.rows as CompareRow[]);
    } catch {
      setError("Failed to compare candidates");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <section className="paper-panel p-6 mb-6">
            <h1 className="font-display text-2xl mb-1">Recruiter Watchlist</h1>
            <p className="text-sm text-[var(--muted)]">
              Save shortlisted candidates, add notes/tags, and compare 2-4 profiles side-by-side.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button
                className="gap-2"
                onClick={runCompare}
                disabled={!canCompare}
              >
                <GitCompareArrows className="w-4 h-4" />
                Compare Selected
              </Button>
              <span className="text-xs text-[var(--muted)]">
                {selectedIds.length} selected (choose 2 to 4)
              </span>
              <Link href="/students" className="text-sm text-[var(--primary)] hover:text-blue-700">
                Browse students
              </Link>
            </div>
          </section>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="grid xl:grid-cols-[1.3fr_1fr] gap-6">
            <section className="paper-panel p-4 sm:p-6">
              {items.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Watchlist is empty.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedSet.has(item.id)}
                              onChange={() => toggleSelection(item.id)}
                            />
                            <Link href={`/students/${item.rollNumber}`} className="font-semibold hover:text-[var(--primary)]">
                              {item.name || "Unknown"} ({item.rollNumber})
                            </Link>
                            <Badge variant="outline">{item.branch || "-"}</Badge>
                            <Badge variant="info">Latest SGPA {item.latestSgpa?.toFixed(2) ?? "-"}</Badge>
                          </div>
                          <p className="text-xs text-[var(--muted)] mt-2">
                            Avg SGPA: {item.avgSgpa?.toFixed(2) ?? "-"} | Backlogs: {item.backlogCount}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingId === item.id ? (
                            <>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <X className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => saveEdit(item.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {editingId === item.id ? (
                        <div className="mt-3 space-y-2">
                          <Input
                            value={noteInput}
                            onChange={(event) => setNoteInput(event.target.value)}
                            placeholder="Add private note"
                          />
                          <Input
                            value={tagsInput}
                            onChange={(event) => setTagsInput(event.target.value)}
                            placeholder="Comma-separated tags"
                          />
                        </div>
                      ) : (
                        <div className="mt-3">
                          {item.note && <p className="text-sm text-[var(--muted)]">{item.note}</p>}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.tags.map((tag) => (
                              <Badge key={`${item.id}-${tag}`} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="paper-panel p-4 sm:p-6">
              <h2 className="font-display text-xl mb-4">Compare Workspace</h2>
              {compareRows.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Select candidates and run compare.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="text-left py-2">Candidate</th>
                        <th className="text-left py-2">Latest</th>
                        <th className="text-left py-2">Average</th>
                        <th className="text-left py-2">Backlogs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareRows.map((row) => (
                        <tr key={row.watchlistId} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-3">
                            <p className="font-medium">{row.name || "Unknown"}</p>
                            <p className="text-xs text-[var(--muted)]">{row.rollNumber}</p>
                            <p className="text-xs text-[var(--muted)] mt-1">{row.branch || "-"}</p>
                          </td>
                          <td className="py-3">{row.latestSgpa?.toFixed(2) ?? "-"}</td>
                          <td className="py-3">{row.avgSgpa?.toFixed(2) ?? "-"}</td>
                          <td className="py-3">{row.backlogCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
