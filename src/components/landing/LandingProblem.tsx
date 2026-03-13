import { XCircle } from "lucide-react";

const PAINS = [
  {
    title: "Data scattered across 6 tools",
    description: "Google Analytics here, Meta Ads there, HubSpot somewhere else. You spend more time pulling data than acting on it.",
  },
  {
    title: "Reports that don't drive decisions",
    description: "Clients get pretty charts but nobody knows which metric is killing the campaign. Revenue stays flat.",
  },
  {
    title: "You're flying blind on ROI",
    description: "You know you spent $10k on ads but proving it generated $40k in pipeline? That takes hours of manual math.",
  },
  {
    title: "No clear path forward",
    description: "After all that analysis, you still don't have a prioritized list of what to fix first. You guess, and hope.",
  },
];

export function LandingProblem() {
  return (
    <section className="py-20 px-4 bg-gray-950">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-brand-400 text-sm font-semibold tracking-wide uppercase mb-3">
            The Problem
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Agency owners waste 12+ hours a week{" "}
            <span className="text-red-400">just on reporting</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            And yet, despite all that effort, clients still can't see where their money is going — or why growth is stalling.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PAINS.map((pain) => (
            <div
              key={pain.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex gap-4"
            >
              <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white mb-1">{pain.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{pain.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
