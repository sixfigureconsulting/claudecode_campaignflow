import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bot, Sparkles, Target, Users, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperAgentClient } from "@/components/super-agent/SuperAgentClient";

export const metadata: Metadata = {
  title: "Super AI Agent | CampaignFlow Pro",
};

const FEATURES = [
  { icon: Target,   label: "ICP Research",   desc: "Titles, pain points, best channels" },
  { icon: Users,    label: "Lead Lists",      desc: "Apollo, Apify, Hunter" },
  { icon: Sparkles, label: "Sequences",       desc: "3-step personalised outreach" },
  { icon: Rocket,   label: "Draft Campaigns", desc: "Review before anything launches" },
];

export default async function SuperAgentPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const creditBalance: number = creditsRow?.balance ?? 0;

  return (
    // -m-6 cancels the layout p-6, giving full dark bleed; p-6 restores inner spacing
    <div className="-m-6 min-h-full" style={{ background: "linear-gradient(160deg, #08091a 0%, #0b0d1f 60%, #080c18 100%)" }}>
      <div className="p-6 space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
          style={{ background: "linear-gradient(135deg,rgba(124,58,237,.12) 0%,rgba(79,70,229,.08) 100%)" }}>
          {/* top shimmer line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
          {/* glow blobs */}
          <div className="absolute -top-10 -left-10 w-60 h-60 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-indigo-600/08 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-6 py-5">
            <div className="flex items-center gap-4">
              {/* Animated icon */}
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 0 24px rgba(124,58,237,.55)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#08091a]">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                </span>
              </div>

              {/* Text */}
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-lg font-black text-white tracking-tight">Super AI Agent</h1>
                  <span className="text-[9px] font-black tracking-widest uppercase text-violet-300 border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 rounded-full">
                    AUTONOMOUS
                  </span>
                </div>
                <p className="text-sm text-white/45 leading-snug">
                  Describe your offer &amp; ICP — the agent researches, builds lists, writes sequences, and creates draft campaigns for your approval.
                </p>
              </div>
            </div>

            {/* Feature pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs">
                  <Icon className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="font-semibold text-white/75">{label}</span>
                  <span className="text-white/30 hidden sm:inline">· {desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Agent UI ─────────────────────────────────────────────────────── */}
        <SuperAgentClient initialCreditBalance={creditBalance} />

      </div>
    </div>
  );
}
