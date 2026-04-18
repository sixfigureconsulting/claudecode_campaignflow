const PAINS = [
  {
    title: "Leads fall through the cracks",
    description: "Replies get ghosted. Follow-ups never sent. You find out weeks later.",
  },
  {
    title: "Reports that collect dust",
    description: "Generic \"improve your subject line\" advice. Zero specificity. Zero action.",
  },
  {
    title: "You're the bottleneck",
    description: "Every insight requires you exporting CSVs and squinting at pivot tables at midnight.",
  },
];

export function LandingProblem() {
  return (
    <section className="py-24 px-4 bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-red-300 text-sm font-semibold tracking-[0.1em] uppercase mb-3">
            The Problem
          </p>
          <h2 className="text-[42px] font-bold text-white leading-[1.15] tracking-tight mb-4">
            You&rsquo;re flying blind on outbound.
          </h2>
          <p className="text-lg text-gray-400 max-w-[620px] mx-auto leading-relaxed">
            Your data lives in Apollo. Your sequences run in Instantly. Your replies sit in Gmail.
            And your &ldquo;reporting&rdquo; is a spreadsheet somewhere else. So what&rsquo;s actually working?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PAINS.map((pain) => (
            <div
              key={pain.title}
              className="px-6 py-6 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <h3 className="font-semibold text-[15px] text-white mb-2">{pain.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{pain.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
