const STEPS = [
  {
    step: "01",
    title: "Connect your outbound tool",
    description: "Add your Instantly, HeyReach, Smartlead, or Lemlist API key in Settings. Takes 30 seconds. Your key is AES-256 encrypted.",
  },
  {
    step: "02",
    title: "Create a campaign or standalone report",
    description: "Create a campaign to track ongoing outbound, or go straight to Reports for a one-off analysis of any existing sequence.",
  },
  {
    step: "03",
    title: "Sync live data",
    description: "Click 'Sync from Instantly' (or your connected tool) and your real metrics — sent, opens, replies, meetings — are pulled in instantly.",
  },
  {
    step: "04",
    title: "Generate your AI report",
    description: "Choose OpenAI or Claude, click Generate. Get a full performance analysis, bottleneck diagnosis, and 5 tactical action steps in under 60 seconds.",
  },
  {
    step: "05",
    title: "Act on it and share",
    description: "Execute the fixes. Email the report to yourself or your client directly from the app. Compare week-over-week to track improvement.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-brand-600 text-sm font-semibold tracking-wide uppercase mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            From raw campaign data to action plan in minutes
          </h2>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            Connect once. Sync anytime. Get AI recommendations that actually tell you what to fix.
          </p>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-brand-200 to-brand-400 hidden sm:block" />

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div key={step.step} className="flex gap-6 items-start relative">
                <div className="w-16 h-16 bg-brand-600 text-white rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-brand-600/30 relative z-10">
                  {step.step}
                </div>
                <div className="flex-1 pt-3">
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">{step.title}</h3>
                  <p className="text-gray-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
