"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    question: "Do I need to connect my outbound tools?",
    answer: "No native integrations are required. You simply import a CSV export from Apollo, Instantly, LinkedIn Sales Navigator, or any other tool — or enter metrics manually. Native integrations are on the roadmap.",
  },
  {
    question: "How does the AI recommendation work?",
    answer: "You bring your own OpenAI or Anthropic API key. We construct a structured prompt using your client data, outbound funnel metrics, and period-over-period comparison, then call the AI on your behalf from our server. Your key is AES-256 encrypted at rest.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use Supabase with Row Level Security so each user only ever sees their own data. API keys are encrypted with AES-256. All data is stored in isolated, access-controlled tables.",
  },
  {
    question: "Can I use this for multiple clients?",
    answer: "Absolutely. The platform is designed for agencies running outbound for multiple accounts. You get unlimited clients, each with unlimited campaigns and reports on paid plans.",
  },
  {
    question: "What CSV formats do you support?",
    answer: "Any standard CSV with column headers. You get a visual column mapper to assign each column to the right metric category (prospects, replies, meetings, revenue, cost). It works with Apollo, Instantly, LinkedIn, and custom spreadsheets.",
  },
  {
    question: "Can I export reports?",
    answer: "Yes. Any AI Recommendation Report can be downloaded as a PDF in one click. Great for client deliverables.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, you can cancel your subscription at any time. Your access continues until the end of the billing period.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full text-left py-5 flex items-center justify-between gap-4 group"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <p className="pb-5 text-gray-600 text-sm leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

export function LandingFAQ() {
  return (
    <section id="faq" className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-brand-600 text-sm font-semibold tracking-wide uppercase mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Common questions</h2>
        </div>
        <div className="bg-gray-50 rounded-2xl px-6 divide-y divide-gray-100">
          {FAQS.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
