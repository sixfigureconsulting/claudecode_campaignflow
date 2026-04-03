export const CAMPAIGN_TYPES = [
  { value: "cold_email", label: "Cold Email" },
  { value: "linkedin", label: "LinkedIn Outreach" },
  { value: "multi_channel", label: "Multi-Channel Sequence" },
  { value: "cold_call", label: "Cold Calling" },
  { value: "custom", label: "Custom" },
] as const;

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  cold_email: "Cold Email",
  linkedin: "LinkedIn Outreach",
  multi_channel: "Multi-Channel Sequence",
  cold_call: "Cold Calling",
  custom: "Custom",
  // legacy DB enum values (shown if no subtype prefix found)
  outbound: "Outbound",
  email: "Cold Email",
  seo: "Custom",
  ads: "Custom",
  social: "Custom",
};

export const CAMPAIGN_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  cold_email: { color: "bg-blue-100 text-blue-600", label: "Cold Email" },
  linkedin: { color: "bg-sky-100 text-sky-600", label: "LinkedIn Outreach" },
  multi_channel: { color: "bg-purple-100 text-purple-600", label: "Multi-Channel" },
  cold_call: { color: "bg-green-100 text-green-600", label: "Cold Calling" },
  custom: { color: "bg-gray-100 text-gray-600", label: "Custom" },
  // legacy fallbacks
  outbound: { color: "bg-blue-100 text-blue-600", label: "Outbound" },
  email: { color: "bg-blue-100 text-blue-600", label: "Cold Email" },
  seo: { color: "bg-gray-100 text-gray-600", label: "Custom" },
  ads: { color: "bg-gray-100 text-gray-600", label: "Custom" },
  social: { color: "bg-gray-100 text-gray-600", label: "Custom" },
};

/** Extract the real campaign subtype from the description prefix [type:xxx] */
export function getCampaignSubtype(campaign: { project_type: string; description?: string | null }): string {
  const match = campaign.description?.match(/^\[type:([^\]]+)\]/);
  return match ? match[1] : campaign.project_type;
}

/** Strip the [type:xxx] prefix from description for display */
export function getDisplayDescription(description?: string | null): string {
  if (!description) return "";
  return description.replace(/^\[type:[^\]]+\]\s*/, "");
}
