// Auto-generated types aligned with Supabase schema

export type ProjectType = "cold_email" | "linkedin" | "multi_channel" | "cold_call" | "custom";

// ── Execution Layer ──────────────────────────────────────────────────────────

export type IntegrationService = "apollo" | "apify" | "heyreach" | "instantly" | "smartlead" | "openai" | "hubspot" | "slack";
export type ExecutionStatus = "pending" | "running" | "completed" | "failed";
export type ActionType = "apollo_enrich" | "sfc_sequence_builder" | "campaign_workflow";

export type CampaignLead = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url?: string | null;
  website?: string | null;
  phone?: string | null;
  qualified?: boolean;
  qualification_reason?: string;
  excluded?: boolean;
  exclusion_reason?: string;
  exclusion_source?: string;
  sequence?: {
    linkedin_step1?: string;
    linkedin_step2?: string;
    email_subject1?: string;
    email_body1?: string;
    email_subject2?: string;
    email_body2?: string;
  };
  push_results?: Record<string, { success: boolean; message: string }>;
};

export interface IntegrationConfig {
  id: string;
  project_id: string;
  service: IntegrationService;
  api_key_encrypted: string;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  project_id: string;
  action_type: ActionType;
  status: ExecutionStatus;
  inputs_summary: string | null;
  outputs_summary: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Original types ───────────────────────────────────────────────────────────
export type ReportType = "weekly" | "monthly" | "custom";
export type MetricCategory = "traffic" | "leads" | "revenue" | "cost" | "custom";
export type AIProvider = "openai" | "anthropic";
export type SubscriptionPlan = "monthly" | "yearly";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  primary_offer: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  project_type: ProjectType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  project_id: string;
  name: string;
  report_type: ReportType;
  report_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportMetric {
  id: string;
  report_id: string;
  metric_name: string;
  metric_value: number;
  metric_category: MetricCategory;
  display_order: number;
  created_at: string;
}

export interface AIConfig {
  id: string;
  user_id: string;
  provider: AIProvider;
  api_key_encrypted: string;
  model_preference: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIRecommendation {
  id: string;
  report_id: string;
  user_id: string;
  provider: AIProvider;
  model_used: string | null;
  executive_summary: string | null;
  kpi_analysis: string | null;
  weakest_metric: string | null;
  bottleneck_explanation: string | null;
  action_steps: string[] | null;
  strategic_improvements: string[] | null;
  raw_response: string | null;
  generated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// Joined types for UI
export interface ClientWithProjects extends Client {
  projects: ProjectWithReports[];
}

export interface ProjectWithReports extends Project {
  reports: ReportWithMetrics[];
}

export interface ReportWithMetrics extends Report {
  report_metrics: ReportMetric[];
}

// Funnel computed metrics
export interface FunnelMetrics {
  traffic: number;
  leads: number;
  opportunities: number;
  customers: number;
  revenue: number;
  spend: number;
  // Computed
  trafficToLeadRate: number;
  leadToOpportunityRate: number;
  opportunityToCustomerRate: number;
  overallConversionRate: number;
  cpl: number;          // Cost per lead
  cac: number;          // Customer acquisition cost
  roi: number;          // Return on investment (%)
  roas: number;         // Return on ad spend
  avgOrderValue: number;
  revenuePerLead: number;
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export type InboxProvider = "gmail" | "linkedin" | "manychat" | "form";
export type InboxClassification = "prospect" | "not_prospect" | "warmup" | "unclassified";
export type MessageDirection = "inbound" | "outbound";

export interface InboxAccount {
  id: string;
  user_id: string;
  provider: InboxProvider;
  account_label: string;
  email: string | null;
  extra_config: Record<string, string> | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxConversation {
  id: string;
  user_id: string;
  account_id: string;
  external_thread_id: string | null;
  subject: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_linkedin_url: string | null;
  contact_company: string | null;
  classification: InboxClassification;
  classification_reason: string | null;
  classification_score: number | null;
  is_read: boolean;
  is_archived: boolean;
  is_blocked: boolean;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  external_message_id: string | null;
  direction: MessageDirection;
  sender_name: string | null;
  sender_email: string | null;
  body: string;
  body_html: string | null;
  sent_at: string;
  created_at: string;
}

export interface InboxSettings {
  id: string;
  user_id: string;
  icp_description: string;
  sales_keywords: string[];
  blocked_senders: string[];
  block_warmup_tools: boolean;
  auto_classify: boolean;
  ai_provider: "anthropic" | "openai";
  created_at: string;
  updated_at: string;
}

// Joined types for UI
export interface InboxConversationWithMessages extends InboxConversation {
  inbox_messages: InboxMessage[];
  inbox_accounts: Pick<InboxAccount, "provider" | "account_label" | "email">;
}

// ── Super AI Agent ───────────────────────────────────────────────────────────

export type SuperAgentStatus = "running" | "awaiting_approval" | "approved" | "launched" | "failed";

export interface SuperAgentSession {
  id: string;
  user_id: string;
  offer: string;
  icp: string;
  goals: string;
  channels: string[];
  status: SuperAgentStatus;
  outreach_plan: OutreachPlan | null;
  created_list_ids: string[];
  created_campaign_ids: string[];
  created_automation_ids: string[];
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  updated_at: string;
}

export type AgentMessageDisplayType =
  | "user_message"
  | "agent_thinking"
  | "tool_start"
  | "tool_result"
  | "agent_text"
  | "plan_ready";

export interface SuperAgentMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant" | "tool_result";
  content: unknown[];  // raw Anthropic ContentBlock[]
  display_type: AgentMessageDisplayType | null;
  display_data: Record<string, unknown>;
  created_at: string;
}

export interface OutreachPlan {
  summary: string;
  icp_analysis: {
    titles: string[];
    company_types: string[];
    company_sizes: string[];
    pain_points: string[];
    best_channels: string[];
  };
  campaigns: OutreachPlanCampaign[];
  automations: OutreachPlanAutomation[];
  what_was_done: string[];
  total_leads: number;
}

export interface OutreachPlanCampaign {
  id: string;
  name: string;
  channel: string;
  list_id: string;
  lead_count: number;
  sequence_preview: string[];
}

export interface OutreachPlanAutomation {
  id: string;
  name: string;
  platform: string;
  keyword: string;
  reply_dm: string;
}

// UI display types for the agent chat
export type AgentUIMessage =
  | { type: "user"; text: string }
  | { type: "agent_thinking"; text: string }
  | { type: "tool_start"; callId: string; name: string; label: string; inputSummary: string }
  | { type: "tool_result"; callId: string; name: string; label: string; success: boolean; resultSummary: string; leadCount?: number }
  | { type: "agent_text"; text: string }
  | { type: "plan_ready"; plan: OutreachPlan };

// Dashboard aggregated stats
export interface DashboardStats {
  totalClients: number;
  totalProjects: number;
  totalReports: number;
  totalRevenue: number;
  totalLeads: number;
  totalSpend: number;
  avgROI: number;
  avgConversionRate: number;
}
