import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";

const FEATURES = [
  "Unlimited campaigns & reports",
  "CSV lead list import with auto-mapping",
  "Outbound funnel tracking (Sent → Opens → Replies → Meetings)",
  "AI sequence recommendations (OpenAI or Claude)",
  "Visual performance dashboard & charts",
  "Week-over-week comparison",
  "PDF export of AI reports",
  "Bring your own API key (AES-256 encrypted)",
  "Priority support",
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-20 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-brand-600 text-sm font-semibold tracking-wide uppercase mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            Start free for 7 days. No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Free trial */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="font-semibold text-gray-900 mb-1">Free Trial</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-gray-500 text-sm">/ 7 days</span>
            </div>
            <ul className="space-y-2 mb-6 text-sm">
              <li className="flex items-center gap-2 text-gray-600">
                <Check className="h-4 w-4 text-green-500" />
                All features unlocked
              </li>
              <li className="flex items-center gap-2 text-gray-600">
                <Check className="h-4 w-4 text-green-500" />
                No credit card
              </li>
            </ul>
            <Link href="/signup">
              <Button variant="outline" className="w-full">Start Free Trial</Button>
            </Link>
          </div>

          {/* Monthly */}
          <div className="bg-white rounded-2xl border-2 border-brand-400 p-6">
            <p className="font-semibold text-gray-900 mb-1">Monthly</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold">$97</span>
              <span className="text-gray-500 text-sm">/ month</span>
            </div>
            <ul className="space-y-2 mb-6 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-gray-600">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <Button className="w-full">Get Started</Button>
            </Link>
          </div>

          {/* Yearly */}
          <div className="bg-brand-950 rounded-2xl border-2 border-brand-600 p-6 relative">
            <div className="absolute -top-3 right-4">
              <span className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Save $667
              </span>
            </div>
            <p className="font-semibold text-white mb-1">Yearly</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold text-white">$497</span>
              <span className="text-brand-300 text-sm">/ year</span>
            </div>
            <p className="text-brand-400 text-xs mb-4">$41.42/month, billed annually</p>
            <ul className="space-y-2 mb-6 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-brand-200">
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <Button variant="gradient" className="w-full">Get Best Value</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
