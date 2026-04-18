import { TrendingUp, ExternalLink } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-[#0a0f1c] text-gray-400 py-10 px-6 text-[13px]">
      <div className="max-w-[1120px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 text-white">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #8197f8, #4f52e4)" }}
          >
            <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
          <span className="font-semibold">CampaignFlow Pro</span>
        </div>

        {/* Pipeline link */}
        <a
          href="https://sixfigureconsulting.notion.site/340d8f40861b8136855de3219cb2586b?v=346d8f40861b8065b370000c2b2ec73f&pvs=73"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-brand-300 hover:text-white transition-colors font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Pipeline
        </a>

        {/* Copyright */}
        <div>&copy; 2026 CampaignFlow. All rights reserved.</div>
      </div>
    </footer>
  );
}
