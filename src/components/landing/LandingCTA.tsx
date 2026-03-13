import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="py-24 px-4 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-brand-400/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto text-center relative">
        <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-900/50">
          <TrendingUp className="h-7 w-7 text-white" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
          Ready to know exactly what to fix?
        </h2>
        <p className="text-brand-200 text-lg mb-8 leading-relaxed">
          Join agency owners and consultants who've replaced guesswork with data-driven performance intelligence.
          Start your 7-day free trial today.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="xl" variant="gradient" className="w-full sm:w-auto">
              Start Free Trial — No Card Required
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="xl"
              variant="outline"
              className="w-full sm:w-auto border-brand-600 text-brand-200 hover:bg-brand-800 hover:text-white bg-transparent"
            >
              Sign In
            </Button>
          </Link>
        </div>

        <p className="text-brand-400 text-sm mt-6">
          7-day free trial · $19/mo or $97/yr after · Cancel anytime
        </p>
      </div>
    </section>
  );
}
