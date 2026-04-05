// Client-safe plan config — no Stripe SDK imports
export const PLAN_CONFIG = {
  monthly: {
    label: "$97/month",
    amount: 9700,
    interval: "month" as const,
  },
  yearly: {
    label: "$497/year",
    amount: 49700,
    interval: "year" as const,
    savingsLabel: "Save $667 vs monthly",
  },
} as const;

export const PLAN_FEATURES = [
  "Unlimited campaigns & reports",
  "CSV lead list import with auto-mapping",
  "Outbound funnel tracking (Sent → Opens → Replies → Meetings)",
  "AI sequence recommendations (OpenAI or Claude)",
  "Visual performance dashboard & charts",
  "Week-over-week comparison",
  "PDF export of AI reports",
  "Bring your own API key (AES-256 encrypted)",
  "Priority support",
];
