import { XCircle } from "lucide-react";

const PAINS = [
  {
    title: "Leads falling through the cracks",
    description: "Apollo here, Instantly there, a spreadsheet somewhere else. No single view of who's been contacted, who replied, who ghosted.",
  },
  {
    title: "No visibility into sequence performance",
    description: "You're sending hundreds of emails but can't tell which step is killing conversions — or whether it's the message, the list, or the timing.",
  },
  {
    title: "You don't know which message is working",
    description: "You A/B test subject lines but have no structured way to analyze why one sequence books meetings and another gets ignored.",
  },
  {
    title: "No clear next step after a no-reply",
    description: "After all that effort, you still don't have a prioritized list of what to fix first. You tweak randomly, and hope.",
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
            Outbound teams burn hours every week{" "}
            <span className="text-red-400">with nothing to show for it</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            And yet, despite sending thousands of emails, clients still can't see why pipeline is thin — or which lever to pull next.
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
