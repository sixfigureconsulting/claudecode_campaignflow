import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap } from "lucide-react";

export function LandingHero() {
  return (
    <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        <Badge variant="info" className="mb-5 bg-brand-800/50 text-brand-200 border-brand-700">
          <Zap className="h-3 w-3 mr-1" />
          AI-Powered Outbound Intelligence
        </Badge>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
          Stop Guessing.{" "}
          <span className="gradient-text bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">
            Start Booking.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-brand-200 max-w-2xl mx-auto mb-8 leading-relaxed">
          CampaignFlow Pro tracks your outbound sequences, visualizes your entire sales funnel,
          and delivers AI-powered action plans that fill your pipeline — not just reports that collect dust.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/signup">
            <Button size="xl" variant="gradient" className="w-full sm:w-auto">
              Start 7-Day Free Trial
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button
              size="xl"
              variant="outline"
              className="w-full sm:w-auto border-brand-600 text-brand-200 hover:bg-brand-800 hover:text-white bg-transparent"
            >
              See How It Works
            </Button>
          </a>
        </div>

        <p className="text-brand-400 text-sm mb-12">
          No credit card required · 7-day free trial · Cancel anytime
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">3x</p>
            <p className="text-xs text-brand-400 mt-0.5">More Replies</p>
          </div>
          <div className="text-center border-x border-brand-700">
            <p className="text-3xl font-bold text-white">AI</p>
            <p className="text-xs text-brand-400 mt-0.5">Powered Insights</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">100%</p>
            <p className="text-xs text-brand-400 mt-0.5">Data Ownership</p>
          </div>
        </div>
      </div>
    </section>
  );
}
