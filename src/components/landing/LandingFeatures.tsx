import {
  Sparkles,
  TrendingUp,
  Inbox,
  Zap,
  Upload,
  BarChart2,
  Users,
  Shield,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Action Plans",
    description: "5 tactical fixes and 3 strategic plays — not generic fluff.",
    iconBg: "bg-brand-100",
    iconColor: "text-brand-700",
  },
  {
    icon: TrendingUp,
    title: "Funnel Visualizer",
    description: "Prospect → Closed. See exactly where leads drop.",
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
  },
  {
    icon: Inbox,
    title: "Unified Inbox",
    description: "Gmail, LinkedIn, ManyChat, forms — triaged by AI.",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    icon: Zap,
    title: "Super DM Setter",
    description: "7 channels × 8 message types with temperature scoring.",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
  },
  {
    icon: Upload,
    title: "Smart Imports",
    description: "Apollo, Instantly, HeyReach, LinkedIn, CSV — auto-mapped.",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  {
    icon: BarChart2,
    title: "Campaign Analytics",
    description: "Real-time send, open, reply, meeting rates.",
    iconBg: "bg-brand-100",
    iconColor: "text-brand-700",
  },
  {
    icon: Users,
    title: "Client Workspaces",
    description: "Separate data per client. Share read-only reports.",
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
  },
  {
    icon: Shield,
    title: "BYO AI Keys",
    description: "OpenAI or Claude. AES-256 encrypted at rest.",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-700",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 px-4 bg-gray-50">
      <div className="max-w-[1120px] mx-auto">
        <div className="text-center mb-14">
          <p className="text-brand-600 text-sm font-semibold tracking-[0.1em] uppercase mb-3">Features</p>
          <h2 className="text-[40px] font-bold text-gray-900 leading-[1.15] tracking-tight mb-3">
            Everything you need to run tighter outbound
          </h2>
          <p className="text-[17px] text-gray-500 max-w-[620px] mx-auto">
            Eight tools in one — built for agency owners, consultants, and founders running their own book.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-[22px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-[14px] ${feature.iconBg} ${feature.iconColor}`}>
                <feature.icon className="h-[18px] w-[18px]" />
              </div>
              <h3 className="font-semibold text-[15px] text-gray-900 mb-1.5 tracking-tight">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-[1.55]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
