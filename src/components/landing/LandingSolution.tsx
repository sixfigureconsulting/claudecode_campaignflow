import { CheckCircle2, ArrowRight } from "lucide-react";

const SOLUTIONS = [
  "Import lead lists from Apollo, Instantly, LinkedIn, or any CSV",
  "Automatically maps Prospects → Contacted → Replied → Booked → Closed",
  "Computes reply rate, meeting rate, close rate, and CPM instantly",
  "Generates AI analysis that pinpoints your exact sequence bottleneck",
  "Delivers 5 tactical fixes and 3 strategic plays — not generic fluff",
];

export function LandingSolution() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-brand-600 text-sm font-semibold tracking-wide uppercase mb-3">
              The Solution
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
              One platform that does the heavy lifting
            </h2>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              CampaignFlow Pro is your outbound intelligence hub. Import your leads, see the full picture,
              and get AI recommendations you can act on today — not in three meetings.
            </p>

            <ul className="space-y-3">
              {SOLUTIONS.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual mockup */}
          <div className="bg-gradient-to-br from-brand-950 to-brand-800 rounded-2xl p-6 shadow-2xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-brand-300 mb-4">
                <span>Q1 2025 — Cold Email Campaign</span>
                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Active</span>
              </div>

              {/* Funnel bars */}
              {[
                { label: "Prospects", value: "5,000", width: "100%", color: "bg-brand-400/30" },
                { label: "Contacted", value: "4,200", width: "84%", color: "bg-brand-400/50" },
                { label: "Replied", value: "630", width: "40%", color: "bg-brand-400/70" },
                { label: "Meetings Booked", value: "126", width: "20%", color: "bg-brand-400" },
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-center justify-between text-xs text-brand-200 mb-1">
                    <span>{bar.label}</span>
                    <span className="font-semibold">{bar.value}</span>
                  </div>
                  <div className="h-6 bg-brand-900 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${bar.color} rounded-lg transition-all`}
                      style={{ width: bar.width }}
                    />
                  </div>
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-brand-700 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs text-brand-400">Reply Rate</p>
                  <p className="text-sm font-bold text-white">15%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-brand-400">Meeting Rate</p>
                  <p className="text-sm font-bold text-white">2.5%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-brand-400">CPM</p>
                  <p className="text-sm font-bold text-green-400">$31</p>
                </div>
              </div>

              <div className="mt-3 p-3 bg-brand-700/30 rounded-lg">
                <p className="text-xs text-brand-300 italic">
                  "Primary bottleneck: Reply → Meeting rate at 20%. Improve call-to-action in follow-up step 2 — add a specific time slot offer..."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
