import type { Metadata } from "next";
import { SignUpForm } from "@/components/forms/SignUpForm";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Start Free Trial",
  description: "Create your CampaignFlow Pro account — 7 day free trial, no credit card required.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">CampaignFlow Pro</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Start your free trial</h1>
          <p className="text-brand-300 mt-1">7 days free · No credit card required</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <SignUpForm />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
