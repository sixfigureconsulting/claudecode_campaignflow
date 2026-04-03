const STEPS = [
  {
    step: "01",
    title: "Add your client",
    description: "Create a client profile with their industry, offer, and website. Takes 60 seconds.",
  },
  {
    step: "02",
    title: "Create a campaign",
    description: "Define the outbound type — Cold Email, LinkedIn Outreach, Multi-Channel Sequence, or Custom.",
  },
  {
    step: "03",
    title: "Import leads or enter metrics",
    description: "Import from Apollo, Instantly, or any CSV. Or manually enter your sequence KPIs. We handle the mapping.",
  },
  {
    step: "04",
    title: "Get AI analysis",
    description: "Click 'Generate AI Report' and receive a complete performance analysis in under 60 seconds.",
  },
  {
    step: "05",
    title: "Act on it",
    description: "Execute the 5 tactical action steps. Share the PDF with your client. Move fast.",
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
            From lead list to action plan in minutes
          </h2>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            No complex setup. No integrations required. Just results.
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
