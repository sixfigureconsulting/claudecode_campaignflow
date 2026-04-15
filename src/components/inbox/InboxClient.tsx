"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail, Linkedin, MessageCircle, Globe, Inbox, Search, RefreshCw,
  Archive, Ban, MoreVertical, Send, Sparkles, CheckCircle2,
  AlertCircle, Clock, Filter, Settings2, Trash2, ChevronDown,
  User, Building2, AtSign, ExternalLink, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SyncAccountsModal, AddAccountButton } from "./SyncAccountsModal";
import type { InboxAccount, InboxConversation, InboxMessage, InboxSettings } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_ICON: Record<string, React.ElementType> = {
  gmail:    Mail,
  linkedin: Linkedin,
  manychat: MessageCircle,
  form:     Globe,
};

const PROVIDER_COLOR: Record<string, string> = {
  gmail:    "text-red-400",
  linkedin: "text-blue-400",
  manychat: "text-purple-400",
  form:     "text-emerald-400",
};

type ClassificationMeta = {
  label: string;
  color: string;
  bg: string;
  dot: string;
  icon: React.ElementType;
};

const CLASSIFICATION: Record<string, ClassificationMeta> = {
  prospect:     { label: "Prospect",     color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400", icon: CheckCircle2 },
  not_prospect: { label: "Not Prospect", color: "text-brand-400",   bg: "bg-brand-800/50 border-brand-700",       dot: "bg-brand-500",   icon: AlertCircle  },
  warmup:       { label: "Warmup",       color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/25",     dot: "bg-amber-400",   icon: Clock        },
  unclassified: { label: "Unclassified", color: "text-brand-500",   bg: "bg-brand-800/40 border-brand-700",       dot: "bg-brand-600",   icon: Filter       },
};

const FILTER_TABS = [
  { id: "all",          label: "All" },
  { id: "prospect",     label: "Prospects" },
  { id: "not_prospect", label: "Other" },
  { id: "warmup",       label: "Warmup" },
  { id: "unread",       label: "Unread" },
  { id: "archived",     label: "Archived" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ConversationWithAccount = InboxConversation & {
  inbox_accounts?: { provider: string; account_label: string; email: string | null };
};

type FullConversation = ConversationWithAccount & {
  inbox_messages: InboxMessage[];
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialAccounts: InboxAccount[];
  initialSettings: InboxSettings | null;
  appUrl: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function InboxClient({ initialAccounts, initialSettings, appUrl }: Props) {
  const [accounts, setAccounts]             = useState<InboxAccount[]>(initialAccounts);
  const [conversations, setConversations]   = useState<ConversationWithAccount[]>([]);
  const [selected, setSelected]             = useState<FullConversation | null>(null);
  const [filter, setFilter]                 = useState("all");
  const [accountFilter, setAccountFilter]   = useState<string>("all");
  const [search, setSearch]                 = useState("");
  const [loadingConvos, setLoadingConvos]   = useState(false);
  const [loadingDetail, setLoadingDetail]   = useState(false);
  const [showSync, setShowSync]             = useState(false);
  const [showSettings, setShowSettings]     = useState(false);
  const [settings, setSettings]             = useState<InboxSettings | null>(initialSettings);

  // Reply composer state
  const [replyBody, setReplyBody]           = useState("");
  const [aiDrafting, setAiDrafting]         = useState(false);
  const [replySending, setReplySending]     = useState(false);
  const [replyError, setReplyError]         = useState("");
  const [classifying, setClassifying]       = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load conversations ───────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const params = new URLSearchParams({ filter });
      if (accountFilter !== "all") params.set("account_id", accountFilter);
      const res = await fetch(`/api/inbox/conversations?${params}`);
      const json = await res.json();
      setConversations(json.conversations ?? []);
    } catch {
      // silent
    } finally {
      setLoadingConvos(false);
    }
  }, [filter, accountFilter]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Open conversation ────────────────────────────────────────────────────

  async function openConversation(convo: ConversationWithAccount) {
    setLoadingDetail(true);
    setReplyBody("");
    setReplyError("");
    try {
      const res = await fetch(`/api/inbox/conversations/${convo.id}`);
      const json = await res.json();
      setSelected(json.conversation ?? null);
      // Mark as read in local state
      setConversations((prev) =>
        prev.map((c) => c.id === convo.id ? { ...c, is_read: true } : c)
      );
    } catch {
      // silent
    } finally {
      setLoadingDetail(false);
    }
  }

  // Scroll to bottom of messages when selected changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.inbox_messages?.length]);

  // ── AI Classify ──────────────────────────────────────────────────────────

  async function classifyConversation(id: string) {
    setClassifying(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${id}/classify`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => c.id === id
            ? { ...c, classification: json.classification, classification_reason: json.reason }
            : c
          )
        );
        if (selected?.id === id) {
          setSelected((prev) => prev ? { ...prev, classification: json.classification, classification_reason: json.reason } : null);
        }
      }
    } catch {
      // silent
    } finally {
      setClassifying(false);
    }
  }

  // ── Archive / Block ──────────────────────────────────────────────────────

  async function updateConversation(id: string, patch: Record<string, boolean>) {
    await fetch(`/api/inbox/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  // ── AI Draft ────────────────────────────────────────────────────────────

  async function draftWithAI() {
    if (!selected) return;
    setAiDrafting(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/inbox/conversations/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft_ai",
          ai_provider: settings?.ai_provider ?? "anthropic",
        }),
      });
      const json = await res.json();
      if (res.ok) setReplyBody(json.draft ?? "");
      else setReplyError(json.error ?? "AI draft failed");
    } catch {
      setReplyError("Network error");
    } finally {
      setAiDrafting(false);
    }
  }

  // ── Send Reply ───────────────────────────────────────────────────────────

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setReplySending(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/inbox/conversations/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "send", body: replyBody }),
      });
      const json = await res.json();
      if (res.ok) {
        setSelected((prev) =>
          prev ? { ...prev, inbox_messages: [...(prev.inbox_messages ?? []), json.message] } : null
        );
        setReplyBody("");
      } else {
        setReplyError(json.error ?? "Send failed");
      }
    } catch {
      setReplyError("Network error");
    } finally {
      setReplySending(false);
    }
  }

  // ── Filtered conversations ───────────────────────────────────────────────

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_email?.toLowerCase().includes(q) ||
      c.subject?.toLowerCase().includes(q) ||
      c.contact_company?.toLowerCase().includes(q)
    );
  });

  const hasAccounts = accounts.length > 0;

  // ── No accounts — empty state ────────────────────────────────────────────

  if (!hasAccounts) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-800 border border-brand-700 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-brand-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Connect your first account</h2>
            <p className="text-sm text-brand-400 max-w-sm leading-relaxed">
              Sync Gmail, LinkedIn (HeyReach), ManyChat, or website form submissions into one AI-powered inbox.
            </p>
          </div>
          <Button
            onClick={() => setShowSync(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Accounts
          </Button>
        </div>
        {showSync && (
          <SyncAccountsModal
            appUrl={appUrl}
            onClose={() => setShowSync(false)}
            onAccountAdded={(acct) => {
              setAccounts((prev) => [...prev, acct]);
              setShowSync(false);
            }}
          />
        )}
      </>
    );
  }

  // ── 3-panel layout ───────────────────────────────────────────────────────

  return (
    <>
      <div className="flex h-[calc(100vh-112px)] gap-0 rounded-xl overflow-hidden border border-brand-800 bg-brand-950">

        {/* ── Left: Accounts + Filters ──────────────────────────────────── */}
        <aside className="w-52 shrink-0 flex flex-col border-r border-brand-800 bg-brand-950">
          <div className="px-3 pt-4 pb-2 border-b border-brand-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-brand-300 uppercase tracking-wider">Accounts</span>
              <AddAccountButton onClick={() => setShowSync(true)} />
            </div>

            {/* Account list */}
            <div className="space-y-0.5">
              <button
                onClick={() => setAccountFilter("all")}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  accountFilter === "all" ? "bg-brand-700 text-white" : "text-brand-400 hover:bg-brand-800 hover:text-white"
                )}
              >
                <Inbox className="w-3.5 h-3.5 shrink-0" />
                All Inboxes
              </button>
              {accounts.map((acct) => {
                const Icon = PROVIDER_ICON[acct.provider] ?? Mail;
                const color = PROVIDER_COLOR[acct.provider] ?? "text-brand-400";
                return (
                  <button
                    key={acct.id}
                    onClick={() => setAccountFilter(acct.id)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      accountFilter === acct.id ? "bg-brand-700 text-white" : "text-brand-400 hover:bg-brand-800 hover:text-white"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
                    <span className="truncate">{acct.account_label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-xs font-bold text-brand-300 uppercase tracking-wider mb-2">Filter</p>
            <div className="space-y-0.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    filter === tab.id ? "bg-brand-700 text-white" : "text-brand-400 hover:bg-brand-800 hover:text-white"
                  )}
                >
                  {tab.id !== "all" && CLASSIFICATION[tab.id] && (
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", CLASSIFICATION[tab.id].dot)} />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings shortcut */}
          <div className="mt-auto px-3 py-3 border-t border-brand-800">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-medium text-brand-400 hover:bg-brand-800 hover:text-white transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5 shrink-0" />
              ICP & Filters
            </button>
          </div>
        </aside>

        {/* ── Center: Conversation list ──────────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col border-r border-brand-800">
          {/* Search */}
          <div className="px-3 py-3 border-b border-brand-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="pl-8 h-8 text-xs bg-brand-900 border-brand-700 text-white placeholder:text-brand-500"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                <p className="text-xs text-brand-500">No conversations yet.</p>
                <p className="text-[11px] text-brand-600 mt-1">
                  {filter === "all" ? "Sync an account to pull in messages." : "Try a different filter."}
                </p>
              </div>
            ) : (
              filtered.map((convo) => {
                const cls = CLASSIFICATION[convo.classification] ?? CLASSIFICATION.unclassified;
                const Icon = PROVIDER_ICON[convo.inbox_accounts?.provider ?? ""] ?? Mail;
                const color = PROVIDER_COLOR[convo.inbox_accounts?.provider ?? ""] ?? "text-brand-400";
                const isActive = selected?.id === convo.id;

                return (
                  <button
                    key={convo.id}
                    onClick={() => openConversation(convo)}
                    className={cn(
                      "w-full text-left px-3 py-3 border-b border-brand-800 transition-colors",
                      isActive ? "bg-brand-800" : "hover:bg-brand-900"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center shrink-0 text-[10px] font-bold text-brand-200">
                        {convo.contact_name ? initials(convo.contact_name) : <User className="w-3.5 h-3.5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={cn("text-xs font-semibold truncate", convo.is_read ? "text-white/70" : "text-white")}>
                            {convo.contact_name ?? convo.contact_email ?? "Unknown"}
                          </span>
                          <span className="text-[10px] text-brand-500 shrink-0">{timeAgo(convo.last_message_at)}</span>
                        </div>

                        <p className={cn("text-[11px] truncate mb-1.5", convo.is_read ? "text-brand-500" : "text-brand-300")}>
                          {convo.subject ?? "(no subject)"}
                        </p>

                        <div className="flex items-center gap-1.5">
                          {/* Classification badge */}
                          <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", cls.bg, cls.color)}>
                            <span className={cn("w-1 h-1 rounded-full", cls.dot)} />
                            {cls.label}
                          </span>

                          {/* Provider icon */}
                          <Icon className={cn("w-3 h-3 shrink-0", color)} />

                          {/* Unread dot */}
                          {!convo.is_read && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Conversation detail + Reply ────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Inbox className="w-8 h-8 text-brand-700 mb-3" />
              <p className="text-sm text-brand-500">Select a conversation to read it</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-800 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-white truncate">{selected.contact_name ?? "Unknown"}</h3>
                    {(() => {
                      const cls = CLASSIFICATION[selected.classification];
                      return (
                        <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", cls.bg, cls.color)}>
                          <span className={cn("w-1 h-1 rounded-full", cls.dot)} />
                          {cls.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-brand-400">
                    {selected.contact_email && (
                      <span className="flex items-center gap-1">
                        <AtSign className="w-3 h-3" />{selected.contact_email}
                      </span>
                    )}
                    {selected.contact_company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{selected.contact_company}
                      </span>
                    )}
                    {selected.contact_linkedin_url && (
                      <a
                        href={selected.contact_linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />LinkedIn
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-brand-700 hover:bg-brand-800"
                    onClick={() => classifyConversation(selected.id)}
                    disabled={classifying}
                  >
                    {classifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Classify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-brand-700 hover:bg-brand-800"
                    onClick={() => updateConversation(selected.id, { is_archived: true })}
                  >
                    <Archive className="w-3 h-3" />
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => updateConversation(selected.id, { is_blocked: true })}
                  >
                    <Ban className="w-3 h-3" />
                    Block
                  </Button>
                </div>
              </div>

              {/* Classification reason banner */}
              {selected.classification_reason && (
                <div className={cn(
                  "mx-5 mt-3 px-3 py-2 rounded-lg border text-xs leading-relaxed",
                  CLASSIFICATION[selected.classification]?.bg,
                  CLASSIFICATION[selected.classification]?.color
                )}>
                  <span className="font-semibold">AI: </span>{selected.classification_reason}
                </div>
              )}

              {/* Messages thread */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {(selected.inbox_messages ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.direction === "outbound" ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.direction === "outbound"
                        ? "bg-brand-600 text-white rounded-br-sm"
                        : "bg-brand-800 text-white/90 rounded-bl-sm"
                    )}>
                      {msg.direction === "inbound" && msg.sender_name && (
                        <p className="text-[10px] font-bold text-brand-400 mb-1">{msg.sender_name}</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p className={cn(
                        "text-[10px] mt-1.5",
                        msg.direction === "outbound" ? "text-white/50 text-right" : "text-brand-500"
                      )}>
                        {new Date(msg.sent_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply composer */}
              <div className="border-t border-brand-800 px-5 py-4 shrink-0">
                <div className="relative">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                    className="w-full bg-brand-900 border border-brand-700 rounded-xl text-sm text-white placeholder:text-brand-500 px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 transition-shadow"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                    }}
                  />
                </div>

                {replyError && (
                  <p className="text-xs text-red-400 mt-1.5">{replyError}</p>
                )}

                <div className="flex items-center justify-between mt-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 border-brand-700 hover:bg-brand-800"
                    onClick={draftWithAI}
                    disabled={aiDrafting}
                  >
                    {aiDrafting
                      ? <><Loader2 className="w-3 h-3 animate-spin" />Drafting…</>
                      : <><Sparkles className="w-3 h-3" />AI Assist</>
                    }
                  </Button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-brand-600">⌘↵ to send</span>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1.5 bg-brand-600 hover:bg-brand-500 text-white"
                      onClick={sendReply}
                      disabled={replySending || !replyBody.trim()}
                    >
                      {replySending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sync accounts modal */}
      {showSync && (
        <SyncAccountsModal
          appUrl={appUrl}
          onClose={() => setShowSync(false)}
          onAccountAdded={(acct) => {
            setAccounts((prev) => [...prev, acct]);
            setShowSync(false);
          }}
        />
      )}

      {/* ICP Settings panel */}
      {showSettings && (
        <ICPSettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => setSettings(s)}
        />
      )}
    </>
  );
}

// ── ICP Settings Panel ────────────────────────────────────────────────────────

function ICPSettingsPanel({
  settings,
  onClose,
  onSave,
}: {
  settings: InboxSettings | null;
  onClose: () => void;
  onSave: (s: InboxSettings) => void;
}) {
  const [icp, setIcp]                       = useState(settings?.icp_description ?? "");
  const [keywords, setKeywords]             = useState((settings?.sales_keywords ?? []).join(", "));
  const [blocked, setBlocked]               = useState((settings?.blocked_senders ?? []).join(", "));
  const [blockWarmup, setBlockWarmup]       = useState(settings?.block_warmup_tools ?? true);
  const [autoClassify, setAutoClassify]     = useState(settings?.auto_classify ?? true);
  const [aiProvider, setAiProvider]         = useState<"anthropic" | "openai">(settings?.ai_provider ?? "anthropic");
  const [saving, setSaving]                 = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inbox/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icp_description:    icp,
          sales_keywords:     keywords.split(",").map((k) => k.trim()).filter(Boolean),
          blocked_senders:    blocked.split(",").map((k) => k.trim()).filter(Boolean),
          block_warmup_tools: blockWarmup,
          auto_classify:      autoClassify,
          ai_provider:        aiProvider,
        }),
      });
      const json = await res.json();
      if (res.ok) { onSave(json.settings); onClose(); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-brand-800 bg-brand-950 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-800">
          <div>
            <h2 className="text-base font-bold text-white">ICP & Filter Settings</h2>
            <p className="text-xs text-brand-400 mt-0.5">Configure how AI classifies incoming messages.</p>
          </div>
          <button onClick={onClose} className="text-brand-400 hover:text-white">
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-300">Ideal Customer Profile (ICP)</label>
            <textarea
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              placeholder="e.g. B2B SaaS founders with 10-200 employees, interested in outbound sales automation…"
              rows={3}
              className="w-full bg-brand-900 border border-brand-700 rounded-xl text-sm text-white placeholder:text-brand-500 px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-300">Sales Keywords (comma-separated)</label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="bg-brand-900 border-brand-700 text-white text-sm"
            />
            <p className="text-[11px] text-brand-500">Messages containing these words are more likely classified as prospects.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-300">Block Senders (comma-separated emails/domains)</label>
            <Input
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
              placeholder="invoices@stripe.com, noreply.com"
              className="bg-brand-900 border-brand-700 text-white text-sm"
            />
          </div>

          <div className="space-y-2">
            {[
              { label: "Auto-block warmup emails", hint: "Filters Instantly, Smartlead, Lemwarm warmup signals", value: blockWarmup, set: setBlockWarmup },
              { label: "Auto-classify on arrival", hint: "Run AI classification when new messages sync", value: autoClassify, set: setAutoClassify },
            ].map((opt) => (
              <label key={opt.label} className="flex items-start gap-3 cursor-pointer group">
                <div
                  className={cn(
                    "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    opt.value ? "bg-brand-500 border-brand-500" : "border-brand-600"
                  )}
                  onClick={() => opt.set(!opt.value)}
                >
                  {opt.value && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                </div>
                <div onClick={() => opt.set(!opt.value)}>
                  <p className="text-xs font-medium text-white">{opt.label}</p>
                  <p className="text-[11px] text-brand-500">{opt.hint}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-300">AI Provider for Classification</label>
            <div className="flex gap-2">
              {(["anthropic", "openai"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setAiProvider(p)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors",
                    aiProvider === p ? "bg-brand-700 border-brand-500 text-white" : "border-brand-700 text-brand-400 hover:bg-brand-800"
                  )}
                >
                  {p === "anthropic" ? "Claude (Anthropic)" : "GPT (OpenAI)"}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full bg-brand-600 hover:bg-brand-500 text-white"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
