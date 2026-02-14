"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import { useDelayedLoginRedirect } from "@/lib/hooks/use-delayed-login-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Bot, Loader2, MessageSquare, Plus, Send, Trash2 } from "lucide-react";

type Conversation = {
  id: number;
  title: string;
  contextType: string;
  contextRollNumber: string | null;
  updatedAt: string;
  lastMessage: string | null;
};

type ChatMessage = {
  id: number;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  pending?: boolean;
};

function formatAssistantError(reason?: string, fallback?: string) {
  switch (reason) {
    case "AI_NOT_CONFIGURED":
      return "AI assistant is not configured yet. Add OpenRouter values in .env.";
    case "RATE_LIMITED":
      return "Rate limit reached. Please wait and try again.";
    case "CONTEXT_FORBIDDEN":
      return "This context is not allowed for your account.";
    case "INVALID_PAYLOAD":
      return "Invalid request. Please retry.";
    case "PROVIDER_ERROR":
      return "AI provider error. Please retry in a moment.";
    default:
      return fallback || "Failed to get assistant response.";
  }
}

async function safeJson(response: Response) {
  const raw = await response.text();
  if (!raw) return {} as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Invalid server response" } as Record<string, unknown>;
  }
}

class AssistantRuntimeBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("assistant.runtime.error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
          <Navbar />
          <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto paper-panel p-6 sm:p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h1 className="font-display text-2xl mb-2">Assistant temporarily unavailable</h1>
              <p className="text-sm text-[var(--muted)] mb-6">
                The assistant UI hit an unexpected runtime issue. Please retry.
              </p>
              <Button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.reload();
                  }
                }}
              >
                Reload Assistant
              </Button>
            </div>
          </main>
          <Footer />
        </div>
      );
    }

    return this.props.children;
  }
}

function AssistantPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useDelayedLoginRedirect(status);
  const searchParams = useSearchParams();
  const [mobileTab, setMobileTab] = useState<"chat" | "conversations">("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contextRollInput, setContextRollInput] = useState("");
  const processedAutoAction = useRef<string>("");

  const recruiterContextRoll = useMemo(() => {
    if (session?.user?.role !== "RECRUITER") return undefined;
    if (!contextRollInput || !/^\d{12}$/.test(contextRollInput)) return undefined;
    return contextRollInput;
  }, [session?.user?.role, contextRollInput]);

  const fetchConversations = async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/ai/conversations", { cache: "no-store" });
      const payload = await safeJson(response);
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Failed to load conversations"));
        return;
      }
      const items = Array.isArray(payload.conversations) ? (payload.conversations as Conversation[]) : [];
      setConversations(items);
      if (!activeConversationId && items.length > 0) {
        setActiveConversationId(items[0].id);
      }
    } catch {
      setError("Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  };

  const fetchConversation = async (conversationId: number) => {
    setLoadingConversation(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}`, { cache: "no-store" });
      const payload = await safeJson(response);
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Failed to load conversation"));
        return;
      }
      setMessages(Array.isArray(payload.messages) ? (payload.messages as ChatMessage[]) : []);
    } catch {
      setError("Failed to load conversation");
    } finally {
      setLoadingConversation(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    void fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    void fetchConversation(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (recruiterContextRoll) {
      setNotice(`Context locked to roll number ${recruiterContextRoll}.`);
    } else if (session?.user?.role === "RECRUITER") {
      setNotice("Enter a 12-digit roll number to ask profile-aware questions.");
    } else {
      setNotice("");
    }
  }, [recruiterContextRoll, session?.user?.role]);

  const handleCreateConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError("");
    setMobileTab("chat");
  };

  const handleDeleteConversation = async (conversationId: number) => {
    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const payload = await safeJson(response);
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Failed to delete conversation"));
        return;
      }
      const next = conversations.filter((conversation) => conversation.id !== conversationId);
      setConversations(next);
      if (activeConversationId === conversationId) {
        setActiveConversationId(next[0]?.id ?? null);
        setMobileTab("chat");
      }
    } catch {
      setError("Failed to delete conversation");
    }
  };

  const handleSend = async (options?: {
    message?: string;
    forceNew?: boolean;
    contextRollNumber?: string;
  }) => {
    const text = (options?.message ?? input).trim();
    if (!text || sending) return;

    const effectiveContextRoll = options?.contextRollNumber ?? recruiterContextRoll;

    if (session?.user?.role === "RECRUITER" && !effectiveContextRoll) {
      setError("Enter a valid 12-digit roll number context first.");
      return;
    }

    if (options?.forceNew) {
      setActiveConversationId(null);
      setMessages([]);
    }

    const tempId = -Date.now();
    setMessages((prev) => [...prev, { id: tempId, role: "USER", content: text, pending: true }]);
    if (!options?.message) {
      setInput("");
    }
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: options?.forceNew ? undefined : activeConversationId ?? undefined,
          message: text,
          contextRollNumber: effectiveContextRoll,
        }),
      });
      const payload = await safeJson(response);

      if (!response.ok || !payload?.ok) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId));
        setError(formatAssistantError(String(payload?.reason || ""), String(payload?.error || "")));
        return;
      }

      const conversationId = Number(payload.conversationId);
      setActiveConversationId(Number.isFinite(conversationId) ? conversationId : null);
      setMobileTab("chat");
      setMessages((prev) => [
        ...prev.map((message) =>
          message.id === tempId ? { ...message, pending: false, id: Date.now() } : message
        ),
        {
          id: Date.now() + 1,
          role: "ASSISTANT",
          content: String(payload.reply || ""),
        },
      ]);
      await fetchConversations();
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;

    const roll = searchParams.get("rollNumber");
    const prompt = searchParams.get("prompt")?.trim() || "";
    const autoSend = ["1", "true", "yes"].includes(
      (searchParams.get("autosend") || "").toLowerCase()
    );
    const forceNew = ["1", "true", "yes"].includes(
      (searchParams.get("new") || "").toLowerCase()
    );
    const validRoll = roll && /^\d{12}$/.test(roll) ? roll : "";

    if (session?.user?.role === "RECRUITER" && validRoll) {
      setContextRollInput(validRoll);
    }

    if (!prompt) return;

    if (!autoSend) {
      setInput(prompt);
      return;
    }

    const actionKey = `${validRoll}|${prompt}|${forceNew}`;
    if (processedAutoAction.current === actionKey) return;
    processedAutoAction.current = actionKey;

    void handleSend({
      message: prompt,
      forceNew,
      contextRollNumber: validRoll || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session?.user?.role, status]);

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
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--secondary)] flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl">Campus AI Assistant</h1>
                <p className="text-sm text-[var(--muted)]">
                  Profile-aware guidance using your academic context and role permissions.
                </p>
              </div>
            </div>
            {notice && <p className="text-xs text-[var(--muted)] mt-3">{notice}</p>}
            {session?.user?.role === "RECRUITER" && (
              <div className="mt-4 max-w-xs">
                <Input
                  value={contextRollInput}
                  onChange={(event) => setContextRollInput(event.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="Context roll number"
                />
              </div>
            )}
          </section>

          <div className="lg:hidden mb-4 grid grid-cols-2 gap-2">
            <Button
              variant={mobileTab === "conversations" ? "default" : "outline"}
              onClick={() => setMobileTab("conversations")}
              className="w-full"
            >
              Conversations
            </Button>
            <Button
              variant={mobileTab === "chat" ? "default" : "outline"}
              onClick={() => setMobileTab("chat")}
              className="w-full"
            >
              Chat
            </Button>
          </div>

          <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            <aside className={`paper-panel p-4 ${mobileTab === "conversations" ? "block" : "hidden"} lg:block`}>
              <Button className="w-full gap-2 mb-3" onClick={handleCreateConversation}>
                <Plus className="w-4 h-4" />
                New Conversation
              </Button>
              <div className="space-y-2 max-h-[260px] sm:max-h-[560px] overflow-y-auto pr-1">
                {loadingList ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] px-2 py-4">No conversations yet.</p>
                ) : (
                  conversations.map((conversation) => (
                    <motion.div
                      key={conversation.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setActiveConversationId(conversation.id);
                        setMobileTab("chat");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveConversationId(conversation.id);
                          setMobileTab("chat");
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`w-full text-left rounded-2xl border px-3 py-3 transition-colors overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                        activeConversationId === conversation.id
                          ? "border-[var(--primary)] bg-[var(--surface-muted)]"
                          : "border-[var(--border)] bg-white/80 hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{conversation.title}</p>
                          <p className="text-xs text-[var(--muted)] truncate mt-1">
                            {(conversation.lastMessage || "No messages yet").replace(/\s+/g, " ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-[var(--muted)] hover:text-red-500"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleDeleteConversation(conversation.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </aside>

            <section className={`paper-panel p-4 sm:p-6 flex flex-col min-h-[420px] sm:min-h-[560px] ${mobileTab === "chat" ? "flex" : "hidden"} lg:flex`}>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {loadingConversation ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <MessageSquare className="w-10 h-10 text-[var(--muted)] mb-3" />
                    <p className="text-sm text-[var(--muted)]">
                      Ask about SGPA trends, backlog status, semester performance, and profile insights.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                        message.role === "USER"
                          ? "ml-auto bg-[var(--primary)] text-white"
                          : "mr-auto bg-[var(--surface-muted)] text-[var(--foreground)] border border-[var(--border)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                      {message.pending && <p className="text-[11px] mt-2 opacity-80">Sending...</p>}
                    </div>
                  ))
                )}
              </div>

              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    placeholder="Ask your question..."
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    maxLength={2000}
                  />
                  <Button
                    className="gap-2 w-full sm:w-auto"
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={
                      sending ||
                      input.trim().length === 0 ||
                      (session?.user?.role === "RECRUITER" && !recruiterContextRoll)
                    }
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </Button>
                </div>
                <p className="text-xs text-[var(--muted)] mt-2">
                  AI responses are generated from your scoped academic context and may contain mistakes.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function AssistantPage() {
  return (
    <SessionProvider>
      <AssistantRuntimeBoundary>
        <AssistantPageInner />
      </AssistantRuntimeBoundary>
    </SessionProvider>
  );
}
