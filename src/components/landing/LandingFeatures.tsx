import {
  Upload,
  TrendingUp,
  Sparkles,
  BarChart2,
  Shield,
  FileDown,
  Users,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "CSV Upload & Auto-Mapping",
    description: "Drop any CSV from Google Ads, Meta, HubSpot, or custom tools. We detect columns and map them to your funnel automatically.",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: TrendingUp,
    title: "Full Funnel Engine",
    description: "Instantly computes Traffic → Lead %, Lead → Opportunity %, Opp → Customer %, CPL, CAC, ROI, and ROAS.",
    color: "text-green-600 bg-green-50",
  },
  {
    icon: Sparkles,
    title: "AI Recommendation Reports",
    description: "Get executive summaries, KPI analysis, bottleneck identification, 5 tactical action steps, and 3 strategic improvements — powered by OpenAI or Claude.",
    color: "text-brand-600 bg-brand-50",
  },
  {
    icon: BarChart2,
    title: "Visual Performance Dashboard",
    description: "Funnel charts, revenue trends, conversion rate graphs, and cost analysis — all in a modern, clean interface.",
    color: "text-purple-600 bg-purple-50",
  },
  {
    icon: Shield,
    title: "Your Keys, Your Data",
    description: "You bring your own OpenAI or Anthropic API key. Keys are AES-256 encrypted. Your data never leaves your control.",
    color: "text-red-600 bg-red-50",
  },
  {
    icon: FileDown,
    title: "PDF Export",
    description: "Download any AI recommendation report as a professional PDF to share with clients in one click.",
    color: "text-orange-600 bg-orange-50",
  },
  {
    icon: Users,
    title: "Client Portfolio Management",
    description: "Organize by Client → Project → Report. Perfect for agency owners managing multiple accounts.",
    color: "text-teal-600 bg-teal-50",
  },
  {
    icon: Zap,
    title: "Week-Over-Week Comparison",
    description: "AI automatically compares your current report with the previous period and highlights what changed and why.",
    color: "text-yellow-600 bg-yellow-50",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-brand-600 text-sm font-semibold tracking-wide uppercase mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything you need to run tighter campaigns
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Built specifically for agency owners, consultants, and performance marketers who are tired of spending their Sundays in spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
