"use client";

import { useState } from "react";
import {
  CheckCircle2, Rocket, Users, Megaphone, MessageSquare,
  Target, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import type { OutreachPlan } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  plan: OutreachPlan;
  sessionId: string;
  onLaunched: () => void;
}

export function OutreachPlanReview({ plan, sessionId, onLaunched }: Props) {
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [icpOpen, setIcpOpen] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/super-agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json() as { error?: string; launchedCampaigns?: number };
      if (!res.ok) throw new Error(data.error ?? "Launch failed");
      setLaunched(true);
      onLaunched();
    } catch (err) {
      setError(String(err));
    } finally {
      setLaunching(false);
    }
  };

  if (launched) {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <Rocket className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="text-lg font-bold text-white">Campaigns Launched!</p>
        <p className="text-sm text-white/50">All campaigns and automations are now active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Outreach Plan Ready</h3>
          <p className="text-xs text-white/45">{plan.total_leads.toLocaleString()} leads · {plan.campaigns.length} campaigns · {plan.automations.length} automations</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-sm text-white/70 leading-relaxed">
        {plan.summary}
      </div>

      {/* What was done */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">What was done</p>
        {plan.what_was_done.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-white/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            {item}
          </div>
        ))}
      </div>

      {/* ICP Analysis (collapsible) */}
      <div className="border border-white/8 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIcpOpen((o: boolean) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white/70 hover:text-white/90 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-400" />
            ICP Analysis
          </div>
          {icpOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {icpOpen && (
          <div className="border-t border-white/8 px-4 py-3 space-y-3 text-xs">
            <Row label="Titles" items={plan.icp_analysis.titles} color="text-violet-300" />
            <Row label="Company Types" items={plan.icp_analysis.company_types} color="text-blue-300" />
            <Row label="Sizes" items={plan.icp_analysis.company_sizes} color="text-indigo-300" />
            <Row label="Pain Points" items={plan.icp_analysis.pain_points} color="text-orange-300" />
            <Row label="Best Channels" items={plan.icp_analysis.best_channels} color="text-emerald-300" />
          </div>
        )}
      </div>

      {/* Campaigns */}
      {plan.campaigns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" /> Campaigns ({plan.campaigns.length})
          </p>
          {plan.campaigns.map((c) => (
            <div key={c.id} className="bg-white/4 border border-white/8 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">{c.name}</span>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full capitalize">{c.channel}</span>
              </div>
              <p className="text-xs text-white/45">{c.lead_count.toLocaleString()} leads</p>
              {c.sequence_preview.slice(0, 2).map((step, i) => (
                <div key={i} className="text-xs text-white/55 bg-white/3 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="text-white/30 font-mono">Step {i + 1}: </span>{step}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Automations */}
      {plan.automations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Comment Automations ({plan.automations.length})
          </p>
          {plan.automations.map((a) => (
            <div key={a.id} className="bg-white/4 border border-white/8 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">{a.name}</span>
                <span className="text-[10px] font-bold bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full capitalize">{a.platform}</span>
              </div>
              <p className="text-xs text-white/45">Keyword: <span className="text-white/65 font-mono">&quot;{a.keyword}&quot;</span></p>
              <p className="text-xs text-white/55 leading-relaxed">{a.reply_dm}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Launch button */}
      <button
        onClick={handleLaunch}
        disabled={launching}
        className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-900/40 text-sm"
      >
        {launching ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Launching…</>
        ) : (
          <><Rocket className="w-4 h-4" /> Approve &amp; Launch All Campaigns</>
        )}
      </button>
      <p className="text-center text-xs text-white/30">This will activate all draft campaigns and automations.</p>
    </div>
  );
}

function Row({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="text-white/35 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={cn("bg-white/5 border border-white/8 px-2 py-0.5 rounded-md", color)}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
