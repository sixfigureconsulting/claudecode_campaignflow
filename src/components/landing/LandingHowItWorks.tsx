const STEPS = [
  {
    step: "01",
    title: "Import your leads",
    description: "Drop a CSV from Apollo, Instantly, or LinkedIn. We auto-map the fields.",
  },
  {
    step: "02",
    title: "Connect your channels",
    description: "Gmail, HeyReach, ManyChat, website forms. Two-click OAuth, no dev work.",
  },
  {
    step: "03",
    title: "Watch the funnel move",
    description: "Real-time dashboards. Every reply, open, and meeting booked.",
  },
  {
    step: "04",
    title: "Generate an AI report",
    description: "5 tactical fixes + 3 strategic plays, tuned to your exact data.",
  },
  {
    step: "05",
    title: "Ship the fixes",
    description: "Reports export to PDF or email. Action plans with assignable tasks.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 bg-white">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-16">
          <p className="text-brand-600 text-sm font-semibold tracking-[0.1em] uppercase mb-3">
            How it works
          </p>
          <h2 className="text-[40px] font-bold text-gray-900 leading-[1.15] tracking-tight mb-3">
            From CSV to pipeline in five steps
          </h2>
        </div>

        <div className="flex flex-col gap-10">
          {STEPS.map((step) => (
            <div key={step.step} className="flex gap-6 items-start">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0 tabular-nums shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #4f52e4, #6470f1)",
                  boxShadow: "0 10px 18px -10px rgba(79,82,228,0.5)",
                }}
              >
                {step.step}
              </div>
              <div className="flex-1 pt-1.5">
                <h3 className="text-[20px] font-semibold text-gray-900 tracking-tight mb-1.5">{step.title}</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
