"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { Bot, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS = [
  { value: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "email",     label: "Email",     emoji: "✉️" },
  { value: "twitter",   label: "Twitter/X", emoji: "🐦" },
  { value: "reddit",    label: "Reddit",    emoji: "🤖" },
  { value: "facebook",  label: "Facebook",  emoji: "👥" },
];

interface Props {
  onStart: (data: { offer: string; icp: string; goals: string; channels: string[] }) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function AgentIntakeForm({ onStart, loading, error }: Props) {
  const [offer, setOffer] = useState("");
  const [icp, setIcp] = useState("");
  const [goals, setGoals] = useState("");
  const [channels, setChannels] = useState<string[]>(["linkedin"]);

  const toggleChannel = (ch: string) => {
    setChannels((prev: string[]) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((c: string) => c !== ch) : prev) : [...prev, ch]
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onStart({ offer: offer.trim(), icp: icp.trim(), goals: goals.trim(), channels });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Offer */}
      <div>
        <label className="block text-sm font-semibold text-white/80 mb-1.5">
          Your Offer <span className="text-red-400">*</span>
        </label>
        <textarea
          value={offer}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setOffer(e.target.value)}
          required
          rows={3}
          placeholder="e.g. We help B2B SaaS founders add $50K MRR in 90 days with a done-for-you outbound system."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 resize-none transition-all"
        />
      </div>

      {/* ICP */}
      <div>
        <label className="block text-sm font-semibold text-white/80 mb-1.5">
          Ideal Customer Profile (ICP) <span className="text-red-400">*</span>
        </label>
        <textarea
          value={icp}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setIcp(e.target.value)}
          required
          rows={3}
          placeholder="e.g. VP of Sales or Founder at B2B SaaS companies with 11-200 employees, $1M-$10M ARR, using CRM but struggling with outbound pipeline."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 resize-none transition-all"
        />
      </div>

      {/* Goals */}
      <div>
        <label className="block text-sm font-semibold text-white/80 mb-1.5">
          Campaign Goals <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={goals}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setGoals(e.target.value)}
          required
          placeholder="e.g. Book 20 discovery calls per month"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
        />
      </div>

      {/* Channels */}
      <div>
        <label className="block text-sm font-semibold text-white/80 mb-2">
          Outreach Channels
        </label>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((ch) => {
            const active = channels.includes(ch.value);
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => toggleChannel(ch.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  active
                    ? "bg-violet-500/25 border-violet-400/60 text-violet-200"
                    : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                )}
              >
                <span>{ch.emoji}</span>
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !offer.trim() || !icp.trim() || !goals.trim()}
        className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-150 shadow-lg shadow-violet-900/40"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting Agent…
          </>
        ) : (
          <>
            <Bot className="w-4 h-4" />
            Launch Super Agent
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-white/30">
        50 credits · Agent researches, builds lists, creates campaigns — all in DRAFT for your review
      </p>
    </form>
  );
}
