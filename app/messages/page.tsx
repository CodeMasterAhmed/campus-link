"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import { useDelayedLoginRedirect } from "@/lib/hooks/use-delayed-login-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Search, Send } from "lucide-react";

type Thread = {
  withUserId: number;
  name: string;
  role: string;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
};

type ConversationMessage = {
  id: number;
  body: string;
  senderId: number;
  receiverId: number;
  createdAt: string;
  sender?: { id: number; name: string; role: string };
  receiver?: { id: number; name: string; role: string };
  pending?: boolean;
};

type StudentOption = {
  rollNumber: string;
  name: string | null;
  branch: string | null;
  linkedUserId: number | null;
};

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useDelayedLoginRedirect(status);
  const isRecruiter = session?.user?.role === "RECRUITER";

  const [mobileTab, setMobileTab] = useState<"threads" | "chat">("threads");
  const [withQueryId, setWithQueryId] = useState<number | null>(null);
  const [withQueryName, setWithQueryName] = useState("");
  const [withQueryRole, setWithQueryRole] = useState("");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeWithId, setActiveWithId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<StudentOption[]>([]);
  const [findingRecipients, setFindingRecipients] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState("");
  const [prefillRollNumber, setPrefillRollNumber] = useState("");

  const userId = Number(session?.user?.id || 0);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.withUserId === activeWithId) ?? null,
    [threads, activeWithId]
  );

  const handleStartConversation = (student: StudentOption) => {
    const recipientId = student.linkedUserId;
    if (!recipientId) {
      setError("This student has not created an account yet. They must sign up before messaging.");
      return;
    }

    setError("");
    setRecipientInfo("");
    setWithQueryId(recipientId);
    setWithQueryName(student.name || student.rollNumber);
    setWithQueryRole("STUDENT");
    setActiveWithId(recipientId);
    setMobileTab("chat");
    setMessages([]);

    setThreads((prev) => {
      if (prev.some((thread) => thread.withUserId === recipientId)) return prev;
      return [
        {
          withUserId: recipientId,
          name: student.name || student.rollNumber,
          role: "STUDENT",
          lastMessage: "Start a conversation",
          lastAt: new Date().toISOString(),
          unreadCount: 0,
        },
        ...prev,
      ];
    });
  };

  const fetchThreads = async () => {
    setLoadingThreads(true);
    try {
      const response = await fetch("/api/messages/threads", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to load threads");
        return;
      }

      let loaded = payload.threads as Thread[];

      if (withQueryId) {
        if (!loaded.some((thread) => thread.withUserId === withQueryId)) {
          loaded = [
            {
              withUserId: withQueryId,
              name: withQueryName || "New conversation",
              role: withQueryRole || "STUDENT",
              lastMessage: "Start a conversation",
              lastAt: new Date().toISOString(),
              unreadCount: 0,
            },
            ...loaded,
          ];
        }
        setThreads(loaded);
        setActiveWithId(withQueryId);
        return;
      }

      setThreads(loaded);
      if (!activeWithId && loaded.length > 0) {
        setActiveWithId(loaded[0].withUserId);
      }
    } catch {
      setError("Failed to load threads");
    } finally {
      setLoadingThreads(false);
    }
  };

  const markRead = async (withUserId: number) => {
    try {
      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withUserId }),
      });
    } catch {
      // best effort
    }
  };

  const fetchConversation = async (withUserId: number) => {
    setLoadingConversation(true);
    setError("");
    try {
      const response = await fetch(`/api/messages?with=${withUserId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Failed to load conversation");
        setMessages([]);
        return;
      }
      setMessages(payload.conv as ConversationMessage[]);
      await markRead(withUserId);
      setThreads((prev) =>
        prev.map((thread) => (thread.withUserId === withUserId ? { ...thread, unreadCount: 0 } : thread))
      );
    } catch {
      setError("Failed to load conversation");
      setMessages([]);
    } finally {
      setLoadingConversation(false);
    }
  };

  const searchRecipients = async (query: string) => {
    if (!isRecruiter) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setRecipientOptions([]);
      return;
    }

    setFindingRecipients(true);
    try {
      const params = new URLSearchParams({
        search: trimmed,
        page: "1",
        limit: "8",
      });
      const response = await fetch(`/api/students?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        setRecipientOptions([]);
        return;
      }

      const options = ((payload?.data?.students || []) as Array<{
        rollNumber: string;
        name: string | null;
        branch: string | null;
        linkedUserId: number | null;
      }>).map((student) => ({
        rollNumber: student.rollNumber,
        name: student.name,
        branch: student.branch,
        linkedUserId: student.linkedUserId,
      }));

      setRecipientOptions(options);

      if (prefillRollNumber) {
        const exact = options.find((option) => option.rollNumber === prefillRollNumber);
        if (exact?.linkedUserId) {
          handleStartConversation(exact);
        } else if (exact && !exact.linkedUserId) {
          setRecipientInfo("This student exists but has not signed up yet. Messaging can start after account creation.");
        }
        setPrefillRollNumber("");
      }
    } catch {
      setRecipientOptions([]);
    } finally {
      setFindingRecipients(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const withValue = params.get("with");
    const name = params.get("name");
    const role = params.get("role");
    const rollNumber = params.get("rollNumber");

    if (withValue && /^\d+$/.test(withValue)) {
      setWithQueryId(Number(withValue));
    }
    if (name) setWithQueryName(name.slice(0, 80));
    if (role) setWithQueryRole(role.slice(0, 40));

    if (rollNumber && /^\d{12}$/.test(rollNumber)) {
      setRecipientQuery(rollNumber);
      setPrefillRollNumber(rollNumber);
      setMobileTab("threads");
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, withQueryId, withQueryName, withQueryRole]);

  useEffect(() => {
    if (!activeWithId) {
      setMessages([]);
      return;
    }
    setMobileTab("chat");
    fetchConversation(activeWithId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWithId]);

  useEffect(() => {
    if (!isRecruiter) return;
    const timer = setTimeout(() => {
      searchRecipients(recipientQuery);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientQuery, isRecruiter]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeWithId || sending) return;

    const tempId = -Date.now();
    setInput("");
    setSending(true);
    setError("");

    const optimistic: ConversationMessage = {
      id: tempId,
      body: text,
      senderId: userId,
      receiverId: activeWithId,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: activeWithId, body: text }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId));
        setError(payload?.error || "Failed to send message");
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId ? { ...(payload.msg as ConversationMessage), pending: false } : message
        )
      );
      await fetchThreads();
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (status === "loading") {
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
            <h1 className="font-display text-2xl mb-1">Messages</h1>
            <p className="text-sm text-[var(--muted)]">Recruiters can initiate. Students can reply on existing threads.</p>
          </section>

          {isRecruiter && (
            <section className="paper-panel p-4 sm:p-5 mb-6">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] mb-3">Start New Conversation</p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <Input
                  value={recipientQuery}
                  onChange={(event) => setRecipientQuery(event.target.value)}
                  placeholder="Search by roll number or student name"
                  className="pl-11"
                />
              </div>
              <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {findingRecipients ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching students...
                  </div>
                ) : recipientQuery.trim().length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Type a roll number or name to start a conversation.</p>
                ) : recipientOptions.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No matching students found.</p>
                ) : (
                  recipientOptions.map((student) => (
                    <div
                      key={student.rollNumber}
                      className="rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{student.name || "Unknown Student"}</p>
                        <p className="text-xs text-[var(--muted)] truncate">{student.rollNumber} • {student.branch || "-"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={student.linkedUserId ? "default" : "outline"}
                        disabled={!student.linkedUserId}
                        onClick={() => handleStartConversation(student)}
                      >
                        {student.linkedUserId ? "Start Chat" : "No Account"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {recipientInfo && <p className="text-xs text-[var(--muted)] mt-3">{recipientInfo}</p>}
            </section>
          )}

          <div className="lg:hidden mb-4 grid grid-cols-2 gap-2">
            <Button
              variant={mobileTab === "threads" ? "default" : "outline"}
              onClick={() => setMobileTab("threads")}
              className="w-full"
            >
              Threads
            </Button>
            <Button
              variant={mobileTab === "chat" ? "default" : "outline"}
              onClick={() => setMobileTab("chat")}
              className="w-full"
            >
              Chat
            </Button>
          </div>

          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            <aside className={`paper-panel p-4 ${mobileTab === "threads" ? "block" : "hidden"} lg:block`}>
              <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-[0.18em] mb-3">Threads</h2>
              <div className="space-y-2 max-h-[260px] sm:max-h-[560px] overflow-y-auto pr-1">
                {loadingThreads ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                  </div>
                ) : threads.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    {isRecruiter ? "No conversations yet. Start one above." : "No conversations yet."}
                  </p>
                ) : (
                  threads.map((thread) => (
                    <motion.button
                      key={thread.withUserId}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left rounded-2xl border px-3 py-3 ${
                        activeWithId === thread.withUserId
                          ? "border-[var(--primary)] bg-[var(--surface-muted)]"
                          : "border-[var(--border)] bg-white/80 hover:bg-[var(--surface-muted)]"
                      }`}
                      onClick={() => {
                        setActiveWithId(thread.withUserId);
                        setMobileTab("chat");
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{thread.name}</p>
                        {thread.unreadCount > 0 && <Badge variant="destructive">{thread.unreadCount}</Badge>}
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1 truncate">{thread.lastMessage}</p>
                    </motion.button>
                  ))
                )}
              </div>
            </aside>

            <section className={`paper-panel p-4 sm:p-6 min-h-[420px] sm:min-h-[560px] flex-col ${mobileTab === "chat" ? "flex" : "hidden"} lg:flex`}>
              {activeWithId ? (
                <>
                  <div className="border-b border-[var(--border)] pb-3 mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {activeThread?.name || withQueryName || `User #${activeWithId}`}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {activeThread?.role || withQueryRole || "USER"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/profile?userId=${activeWithId}`)}
                    >
                      View Profile
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {loadingConversation ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <MessageCircle className="w-8 h-8 text-[var(--muted)] mb-2" />
                        <p className="text-sm text-[var(--muted)]">No messages yet. Send the first message.</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isSelf = message.senderId === userId;
                        return (
                          <div
                            key={message.id}
                            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                              isSelf
                                ? "ml-auto bg-[var(--primary)] text-white"
                                : "mr-auto bg-[var(--surface-muted)] border border-[var(--border)]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                            {message.pending && <p className="text-[11px] mt-1 opacity-80">Sending...</p>}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSend}
                        disabled={sending || input.trim().length === 0}
                        className="gap-2 w-full sm:w-auto"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <MessageCircle className="w-10 h-10 text-[var(--muted)] mb-3" />
                  <p className="text-sm text-[var(--muted)]">
                    {isRecruiter ? "Start a new conversation above or pick a thread." : "Select a thread to start messaging."}
                  </p>
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
