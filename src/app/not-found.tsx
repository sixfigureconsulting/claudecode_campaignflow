import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 to-brand-800 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-brand-700/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <TrendingUp className="h-8 w-8 text-brand-300" />
        </div>
        <p className="text-brand-400 text-6xl font-bold mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-brand-300 mb-8">
          This page doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link href="/dashboard">
          <Button variant="gradient" size="lg">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
