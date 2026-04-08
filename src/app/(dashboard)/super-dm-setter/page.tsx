import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Zap, Flame, Phone, MessageSquare, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperDMSetterClient } from "@/components/super-dm-setter/SuperDMSetterClient";

export const metadata: Metadata = {
  title: "Super DM Setter | CampaignFlow Pro",
};

const PILLS = [
  { icon: Zap,            label: "Speed to Lead",      value: "5×",    color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
  { icon: Flame,          label: "Intent Scoring",      value: "Live",  color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  { icon: Phone,          label: "Call Trigger",        value: "Auto",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { icon: MessageSquare,  label: "Channels",            value: "7",     color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
];

export default async function SuperDMSetterPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  // Detect which AI providers have keys configured — pass to client so Step 1 warns immediately
  const { data: aiConfigs } = await supabase
    .from("ai_configs")
    .select("provider")
    .eq("user_id", user.id);

  const configuredProviders = (aiConfigs ?? []).map((c: { provider: string }) => c.provider);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.07]" style={{ background: "linear-gradient(135deg, #0f0b25 0%, #0d0f2b 50%, #0a0d1f 100%)", boxShadow: "0 0 0 1px rgba(139,92,246,0.12), 0 30px 80px rgba(0,0,0,0.5)" }}>
        {/* Radial glows */}
        <div className="absolute -top-16 -left-16 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/3 w-40 h-40 bg-blue-500/8 rounded-full blur-2xl pointer-events-none" />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        <div className="relative p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 0 30px rgba(124,58,237,0.5)" }}>
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0b25]">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-black text-white tracking-tight">Super DM Setter</h1>
                  <span className="text-[9px] font-black tracking-widest uppercase bg-gradient-to-r from-violet-500/30 to-indigo-500/30 text-violet-300 border border-violet-400/30 px-2 py-0.5 rounded-full">AI-Powered</span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">High-converting DM sequences, objection handling &amp; live intent signals.</p>
              </div>
            </div>

            {/* Live pulse indicator */}
            <div className="flex items-center gap-2.5 bg-red-950/60 border border-red-500/20 rounded-xl px-4 py-3 flex-shrink-0 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
              </span>
              <div>
                <p className="text-xs font-bold text-red-400 leading-none">Live Intent Detection</p>
                <p className="text-[10px] text-white/25 mt-0.5">Scoring active conversations</p>
              </div>
            </div>
          </div>

          {/* Capability pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            {PILLS.map((p) => (
              <div key={p.label} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${p.bg} backdrop-blur-sm`}>
                <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                <span className="text-xs font-semibold text-white/60">{p.label}</span>
                <span className={`text-xs font-black ${p.color}`}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Speed-to-lead warning ────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border border-amber-500/15 px-5 py-3" style={{ background: "linear-gradient(90deg, rgba(120,53,15,0.3) 0%, rgba(30,27,75,0.3) 100%)" }}>
        <div className="flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-white/50 leading-relaxed">
            Prospects who reply to a DM are{" "}
            <span className="font-bold text-amber-300">5× more likely to book</span> if you follow up within{" "}
            <span className="font-bold text-white/80">5 minutes</span>.
            Super DM Setter tells you exactly when to call — don&apos;t ignore those signals.
          </p>
        </div>
      </div>

      {/* ── Feature ─────────────────────────────────────────────────────── */}
      <SuperDMSetterClient configuredProviders={configuredProviders} />
    </div>
  );
}
