import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles } from "lucide-react";

const FUNNEL_STATS = [
  { label: "Prospects",  value: "4,238", color: "#fbbf24" },
  { label: "Contacted",  value: "3,890", color: "#3b82f6" },
  { label: "Replied",    value: "412",   color: "#94a3b8" },
  { label: "Meetings",   value: "87",    color: "#a855f7" },
  { label: "Closed",     value: "19",    color: "#10b981" },
];

const BARS = [42, 58, 39, 64, 72, 55, 81, 68, 90, 76, 88, 95];

export function LandingHero() {
  return (
    <section className="pt-32 pb-24 px-4 bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-0 right-0 w-[420px] h-[420px] -translate-y-20 translate-x-16 bg-brand-600/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] translate-y-28 -translate-x-20 bg-brand-400/14 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/6 border border-white/12 text-xs font-medium text-brand-200 mb-7">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered recommendations · New
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-extrabold text-white leading-[1.05] tracking-[-0.03em] mb-5">
          Stop Guessing.<br />
          <span className="bg-gradient-to-r from-brand-300 to-white bg-clip-text text-transparent">
            Start Booking.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-brand-200 max-w-[680px] mx-auto mb-9 leading-relaxed">
          CampaignFlow Pro tracks your outbound sequences, visualizes your entire sales funnel,
          and delivers AI-powered action plans that fill your pipeline — not just reports that collect dust.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
          <Link href="/signup">
            <Button size="xl" variant="gradient" className="w-full sm:w-auto">
              Start 7-Day Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button
              size="xl"
              className="w-full sm:w-auto bg-white/8 text-white border border-white/20 hover:bg-white/14 hover:text-white"
              variant="outline"
            >
              See How It Works
            </Button>
          </a>
        </div>

        {/* Trust line */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center text-[13px] text-brand-300 mb-16">
          {["No credit card required", "7-day free trial", "Cancel anytime"].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> {t}
            </span>
          ))}
        </div>

        {/* Hero dashboard mockup */}
        <div className="rounded-2xl bg-white text-left p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.1)] max-w-[860px] mx-auto">
          {/* Window dots */}
          <div className="flex gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {FUNNEL_STATS.map((s) => (
              <div key={s.label} className="border border-gray-100 rounded-[10px] px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </div>
                <div className="text-xl font-bold tracking-tight tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-1 h-[100px] px-1">
            {BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px]"
                style={{
                  height: `${h}%`,
                  background: "linear-gradient(180deg, rgba(100,112,241,.88) 0%, rgba(100,112,241,.22) 100%)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
