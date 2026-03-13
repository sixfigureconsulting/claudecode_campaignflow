// Client-safe plan config — no Stripe SDK imports
export const PLAN_CONFIG = {
  monthly: {
    label: "$19/month",
    amount: 1900,
    interval: "month" as const,
  },
  yearly: {
    label: "$97/year",
    amount: 9700,
    interval: "year" as const,
    savingsLabel: "Save $131 vs monthly",
  },
} as const;

export const PLAN_FEATURES = [
  "Unlimited clients",
  "Unlimited projects & reports",
  "CSV upload & auto-mapping",
  "Full funnel engine (CPL, CAC, ROI, ROAS)",
  "AI recommendation reports",
  "Week-over-week comparison",
  "PDF export",
  "OpenAI + Claude support",
  "Priority support",
];
