import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

export function LandingNav() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100 h-16">
      <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo lockup */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{
              background: "linear-gradient(135deg, #8197f8, #4f52e4)",
              boxShadow: "0 4px 10px -4px rgba(79,82,228,0.5)",
            }}
          >
            <TrendingUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div className="font-bold text-[16px] tracking-[-0.01em] text-gray-900">CampaignFlow</div>
            <div className="text-[9px] font-semibold text-brand-600 tracking-[0.1em] uppercase mt-0.5">Pro</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-7 text-[14px] text-gray-600">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="gradient" size="sm">Start Free Trial</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
