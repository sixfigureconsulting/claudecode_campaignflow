import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingSolution } from "@/components/landing/LandingSolution";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingNav } from "@/components/landing/LandingNav";

export const metadata: Metadata = {
  title: "CampaignFlow Pro — Stop Guessing. Start Growing.",
  description:
    "The AI-powered marketing performance platform for agencies, consultants, and founders. Unify your data, spot bottlenecks instantly, and get precise action steps.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />
      <LandingHero />
      <LandingProblem />
      <LandingSolution />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingPricing />
      <LandingFAQ />
      <LandingCTA />
    </div>
  );
}
