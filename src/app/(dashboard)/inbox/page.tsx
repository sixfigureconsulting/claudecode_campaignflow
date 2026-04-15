import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox, RefreshCw, Mail, Linkedin, MessageCircle, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "@/components/inbox/InboxClient";

export const metadata: Metadata = {
  title: "Inbox | CampaignFlow Pro",
};

const CHANNEL_PILLS = [
  { icon: Mail,          label: "Gmail",     value: "Multi-account", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
  { icon: Linkedin,      label: "LinkedIn",  value: "HeyReach",      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  { icon: MessageCircle, label: "Instagram", value: "ManyChat",       color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  { icon: Globe,         label: "Forms",     value: "Webhook",        color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [accountsResult, settingsResult] = await Promise.all([
    supabase
      .from("inbox_accounts")
      .select("id, user_id, provider, account_label, email, extra_config, is_active, last_synced_at, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("inbox_settings")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  const accounts = accountsResult.data ?? [];
  const settings = settingsResult.data ?? null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden border border-white/[0.07]"
        style={{
          background: "linear-gradient(135deg, #0a0f1e 0%, #0d1020 50%, #0a0d1a 100%)",
          boxShadow: "0 0 0 1px rgba(59,130,246,0.10), 0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

        <div className="relative p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1d4ed8, #3730a3)", boxShadow: "0 0 24px rgba(29,78,216,0.45)" }}
                >
                  <Inbox className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0f1e]">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-black text-white tracking-tight">Unified Inbox</h1>
                  <span className="text-[9px] font-black tracking-widest uppercase bg-gradient-to-r from-blue-500/30 to-indigo-500/30 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                    AI-Powered
                  </span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">
                  All your prospect conversations in one place — classified, prioritised, and ready to reply.
                </p>
              </div>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2.5 bg-emerald-950/50 border border-emerald-500/20 rounded-xl px-4 py-3 shrink-0 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <div>
                <p className="text-xs font-bold text-emerald-400 leading-none">AI Classification</p>
                <p className="text-[10px] text-white/25 mt-0.5">Auto-filtering prospects</p>
              </div>
            </div>
          </div>

          {/* Channel pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            {CHANNEL_PILLS.map((p) => (
              <div key={p.label} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${p.bg} backdrop-blur-sm`}>
                <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                <span className="text-xs font-semibold text-white/60">{p.label}</span>
                <span className={`text-xs font-black ${p.color}`}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Connected Accounts", value: accounts.length, color: "text-blue-400" },
          { label: "Total Channels",     value: new Set(accounts.map((a) => a.provider)).size, color: "text-purple-400" },
          { label: "AI Auto-classify",   value: "On",  color: "text-emerald-400" },
          { label: "Warmup Filter",      value: "On",  color: "text-amber-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-brand-800 bg-brand-900 px-4 py-3">
            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-brand-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main inbox panel ─────────────────────────────────────────────── */}
      <InboxClient
        initialAccounts={accounts}
        initialSettings={settings}
        appUrl={appUrl}
      />
    </div>
  );
}
