import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your CampaignFlow Pro account",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CampaignFlow Pro</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Set a new password</h1>
          <p className="text-brand-300 mt-1">Choose a strong password for your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
