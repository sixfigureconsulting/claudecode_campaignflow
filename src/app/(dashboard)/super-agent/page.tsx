import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bot, Sparkles, Target, Users, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperAgentClient } from "@/components/super-agent/SuperAgentClient";

export const metadata: Metadata = {
  title: "Super AI Agent | CampaignFlow Pro",
};

const FEATURES = [
  { icon: Target,   label: "ICP Research",     desc: "Identifies titles, pain points, best channels" },
  { icon: Users,    label: "Lead Lists",        desc: "Builds lists from Apollo, Apify, Hunter" },
  { icon: Sparkles, label: "Sequences",         desc: "Personalised 3-step outreach per channel" },
  { icon: Rocket,   label: "Draft Campaigns",   desc: "Creates everything in DRAFT — you approve" },
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
    <div className="space-y-8 animate-fade-in">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden border border-white/[0.07]"
        style={{
          background: "linear-gradient(135deg, #0f0b25 0%, #0d0f2b 50%, #0a0d1f 100%)",
          boxShadow: "0 0 0 1px rgba(139,92,246,0.12), 0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Glows */}
        <div className="absolute -top-16 -left-16 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        <div className="relative p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 0 30px rgba(124,58,237,0.5)" }}
                >
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0b25]">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-black text-white tracking-tight">Super AI Agent</h1>
                  <span className="text-[9px] font-black tracking-widest uppercase bg-gradient-to-r from-violet-500/30 to-indigo-500/30 text-violet-300 border border-violet-400/30 px-2 py-0.5 rounded-full">
                    AUTONOMOUS
                  </span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">
                  Describe your offer &amp; ICP. The agent researches, builds lists, writes sequences, and creates draft campaigns for your review.
                </p>
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs"
              >
                <Icon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="font-semibold text-white/80">{label}</span>
                <span className="text-white/35 hidden sm:inline">· {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Agent UI ──────────────────────────────────────────────────────── */}
      <SuperAgentClient initialCreditBalance={creditBalance} />
    </div>
  );
}
