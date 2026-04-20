"use client";

import { useState } from "react";
import { Plus, Zap, Pause, Play, Trash2, AlertTriangle, ExternalLink, CheckCircle2, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface Automation {
  id: string;
  name: string;
  platform: "instagram" | "facebook";
  keyword: string;
  reply_dm: string;
  post_id: string | null;
  post_url: string | null;
  status: "active" | "paused" | "draft";
  trigger_count: number;
  dm_sent_count: number;
  created_at: string;
}

interface Props {
  initialAutomations: Automation[];
  hasManyChat: boolean;
  manychatUsername: string | null;
}

const PLATFORM_META = {
  instagram: { emoji: "📸", label: "Instagram", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  facebook:  { emoji: "👥", label: "Facebook",  color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
};

function AutomationForm({ onSave, onCancel, initial }: {
  onSave: (data: Partial<Automation>) => Promise<void>;
  onCancel: () => void;
  initial?: Partial<Automation>;
}) {
  const [name, setName]       = useState(initial?.name ?? "");
  const [platform, setPlatform] = useState<"instagram" | "facebook">(initial?.platform ?? "instagram");
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [replyDm, setReplyDm] = useState(initial?.reply_dm ?? "");
  const [postUrl, setPostUrl] = useState(initial?.post_url ?? "");
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !keyword.trim() || !replyDm.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), platform, keyword: keyword.trim(), reply_dm: replyDm.trim(), post_url: postUrl.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded-xl p-5 space-y-4 bg-muted/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Automation name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Free guide DM" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platform</label>
          <div className="flex gap-2">
            {(["instagram", "facebook"] as const).map((p) => (
              <button key={p} onClick={() => setPlatform(p)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-all", platform === p ? "bg-brand-600 border-brand-500 text-white" : "border-border text-muted-foreground hover:text-foreground")}>
                {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger keyword</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder='e.g. GUIDE or "free pdf"' className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
          <p className="text-[11px] text-muted-foreground">Case-insensitive. Matches anywhere in the comment.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specific post URL (optional)</label>
          <input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://instagram.com/p/..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
          <p className="text-[11px] text-muted-foreground">Leave blank to trigger on any post.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DM message to send</label>
        <textarea value={replyDm} onChange={(e) => setReplyDm(e.target.value)} rows={3} placeholder="Hey! Thanks for your comment 👋 Here's the link you asked for..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none" />
        <p className="text-[11px] text-muted-foreground">This exact message is sent via ManyChat when the keyword is detected.</p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button variant="gradient" size="sm" onClick={handleSave} disabled={saving || !name.trim() || !keyword.trim() || !replyDm.trim()}>
          {saving ? "Saving…" : <><CheckCircle2 className="h-3.5 w-3.5" /> Save automation</>}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function AutomationsClient({ initialAutomations, hasManyChat, manychatUsername }: Props) {
  const [automations, setAutomations]   = useState<Automation[]>(initialAutomations);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const handleCreate = async (data: Partial<Automation>) => {
    const res = await fetch("/api/comment-automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { toast({ title: "Error", description: json.error, variant: "destructive" }); return; }
    setAutomations((prev) => [json.data, ...prev]);
    setShowForm(false);
    toast({ title: "Automation created", variant: "success" });
  };

  const handleUpdate = async (id: string, data: Partial<Automation>) => {
    const res = await fetch(`/api/comment-automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { toast({ title: "Error", description: json.error, variant: "destructive" }); return; }
    setAutomations((prev) => prev.map((a) => (a.id === id ? json.data : a)));
    setEditingId(null);
    toast({ title: "Automation updated", variant: "success" });
  };

  const handleToggle = async (auto: Automation) => {
    const newStatus = auto.status === "active" ? "paused" : "active";
    await handleUpdate(auto.id, { status: newStatus });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/comment-automations/${id}`, { method: "DELETE" });
    if (!res.ok) { toast({ title: "Error deleting automation", variant: "destructive" }); setDeletingId(null); return; }
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
    toast({ title: "Automation deleted", variant: "success" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comment-to-DM Automations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Instagram &amp; Facebook keyword triggers → instant DMs via ManyChat
          </p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4" /> New automation
        </Button>
      </div>

      {/* ManyChat status banner */}
      {!hasManyChat ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-500/10 dark:border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-300">ManyChat not connected</p>
            <p className="text-amber-600 dark:text-amber-400/80 mt-0.5">
              Comment-to-DM automations send via your ManyChat account.{" "}
              <a href="/settings" className="underline font-medium">Connect ManyChat in Settings → Integrations</a> to activate these rules.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-500/20 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-emerald-700 dark:text-emerald-300">
            ManyChat connected{manychatUsername ? ` as @${manychatUsername}` : ""}. Automations are live.
          </span>
        </div>
      )}

      {/* How it works */}
      <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">How it works</p>
        <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
          <li>Someone comments your keyword (e.g. <code className="text-xs bg-muted px-1.5 py-0.5 rounded">GUIDE</code>) on your post</li>
          <li>Meta sends a webhook event to CampaignFlow</li>
          <li>We instantly fire a DM via ManyChat with your preset message</li>
          <li>The comment counts toward your keyword&apos;s trigger stats</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          ✅ This flow is <strong>officially approved by Meta</strong> — no TOS risk. Requires ManyChat connected and an Instagram Business or Facebook Page account.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground">Webhook URL for Meta App Dashboard:</p>
          <code className="text-xs bg-muted px-2 py-1 rounded select-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/meta</code>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <AutomationForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {/* Automations list */}
      {automations.length === 0 && !showForm ? (
        <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
          <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No automations yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first keyword trigger to automatically DM anyone who comments on your posts.
          </p>
          <Button variant="gradient" size="sm" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Create automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto) => {
            const meta = PLATFORM_META[auto.platform];
            if (editingId === auto.id) {
              return (
                <AutomationForm key={auto.id} initial={auto} onSave={(data) => handleUpdate(auto.id, data)} onCancel={() => setEditingId(null)} />
              );
            }
            return (
              <div key={auto.id} className="border border-border rounded-xl p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 border ${meta.bg}`}>
                    {meta.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{auto.name}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border",
                        auto.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                          : "bg-gray-500/10 text-gray-500 border-gray-500/20")}>
                        {auto.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                      <span className={meta.color}>{meta.label}</span>
                      <span>Keyword: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{auto.keyword}</code></span>
                      {auto.post_url && (
                        <a href={auto.post_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                          Specific post <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-1 italic">&ldquo;{auto.reply_dm}&rdquo;</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                      <span><strong className="text-foreground">{auto.trigger_count}</strong> triggers</span>
                      <span><strong className="text-foreground">{auto.dm_sent_count}</strong> DMs sent</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(auto)} title={auto.status === "active" ? "Pause" : "Resume"}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      {auto.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditingId(auto.id)} title="Edit"
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Zap className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(auto.id)} disabled={deletingId === auto.id} title="Delete"
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PhantomBuster cold IG DM section */}
      <div className="border border-red-200/60 dark:border-red-700/30 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-red-50/80 dark:bg-red-950/30 border-b border-red-200/60 dark:border-red-700/30 flex items-center gap-2">
          <Skull className="h-4 w-4 text-red-500" />
          <h2 className="font-semibold text-sm text-red-700 dark:text-red-400">Cold IG DM via PhantomBuster</h2>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/40 uppercase tracking-wide">Ban Risk</span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-700/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-red-700 dark:text-red-400">⚠️ You are using this at your own risk</p>
              <p className="text-red-600/80 dark:text-red-400/70 text-xs leading-relaxed">
                PhantomBuster cold IG DMs are <strong>not approved by Meta</strong> and violate Instagram&apos;s Terms of Service.
                Your Instagram account may be <strong>temporarily or permanently banned</strong>.
                CampaignFlow Pro is not liable for any account suspension or loss of data resulting from use of this feature.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            PhantomBuster is already connected via your integration settings. Trigger the Instagram DM Sender phantom with explicit acknowledgment of the TOS risk.
          </p>
          <PhantomBusterTrigger />
        </div>
      </div>
    </div>
  );
}

function PhantomBusterTrigger() {
  const [accepted, setAccepted] = useState(false);
  const [launched, setLaunched] = useState(false);

  if (launched) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-700/30 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Phantom launched — monitor results in your PhantomBuster dashboard.
        <a href="https://phantombuster.com" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs underline">
          Open dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          I understand this violates Instagram&apos;s ToS and accept full responsibility for any account bans, restrictions, or data loss. CampaignFlow Pro is not liable.
        </span>
      </label>
      <Button
        variant="outline"
        size="sm"
        disabled={!accepted}
        onClick={() => setLaunched(true)}
        className="border-red-300 dark:border-red-700/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
      >
        <Skull className="h-3.5 w-3.5 mr-1.5" />
        Launch PhantomBuster IG DM Sender
      </Button>
    </div>
  );
}
