import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const FEATURES = [
  "Unlimited campaigns & clients",
  "AI reports with your OpenAI/Claude key",
  "Unified inbox across 5 channels",
  "Super DM Setter generator",
  "All import formats (Apollo, Instantly, HeyReach, CSV)",
  "Priority email support",
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-24 px-4 bg-gray-50">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-14">
          <p className="text-brand-600 text-sm font-semibold tracking-[0.1em] uppercase mb-3">Pricing</p>
          <h2 className="text-[40px] font-bold text-gray-900 leading-[1.15] tracking-tight mb-3">
            One plan. Everything included.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[780px] mx-auto">
          {/* Monthly */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-[30px]">
            <p className="text-sm font-semibold text-gray-500 mb-1.5">Monthly</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-[46px] font-bold tracking-tight tabular-nums">$97</span>
              <span className="text-gray-500 text-sm">/month</span>
            </div>
            <Link href="/signup">
              <Button variant="outline" className="w-full mb-5">Start Free Trial</Button>
            </Link>
            <PricingFeatureList />
          </div>

          {/* Annual — best value */}
          <div
            className="bg-white rounded-2xl shadow-[0_20px_40px_-10px_rgba(100,112,241,0.2)] p-[30px] relative"
            style={{ border: "2px solid #6470f1" }}
          >
            <div className="absolute -top-3 right-5 bg-brand-600 text-white text-[11px] font-semibold px-[10px] py-1 rounded-full">
              BEST VALUE — SAVE $667
            </div>
            <p className="text-sm font-semibold text-brand-600 mb-1.5">Annual</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-[46px] font-bold tracking-tight tabular-nums">$497</span>
              <span className="text-gray-500 text-sm">/year</span>
            </div>
            <Link href="/signup">
              <Button variant="gradient" className="w-full mb-5">Get Best Value</Button>
            </Link>
            <PricingFeatureList />
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingFeatureList() {
  return (
    <ul className="flex flex-col gap-2.5">
      {FEATURES.map((f) => (
        <li key={f} className="flex items-start gap-2 text-[13px] text-gray-700">
          <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}
