import { z } from "zod";

// ── Auth ────────────────────────────────────────────────────────────────────

export const signUpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;

// ── Client ──────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(100),
  industry: z.string().max(100).optional().or(z.literal("")),
  website: z
    .string()
    .url("Must be a valid URL (include https://)")
    .optional()
    .or(z.literal("")),
  primary_offer: z.string().max(500).optional().or(z.literal("")),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ── Project ─────────────────────────────────────────────────────────────────

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  project_type: z.enum(["cold_email", "linkedin", "multi_channel", "cold_call", "custom"]),
  description: z.string().max(500).optional().or(z.literal("")),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// ── Report ───────────────────────────────────────────────────────────────────

export const reportSchema = z.object({
  name: z.string().min(1, "Report name is required").max(100),
  report_type: z.enum(["weekly", "monthly", "custom"]),
  report_date: z.string().min(1, "Report date is required"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ReportFormData = z.infer<typeof reportSchema>;

// ── Metric ───────────────────────────────────────────────────────────────────

export const metricSchema = z.object({
  metric_name: z.string().min(1, "Metric name is required").max(100),
  metric_value: z.coerce.number().min(0, "Value must be non-negative"),
  metric_category: z.enum(["traffic", "leads", "revenue", "cost", "custom"]),
});

export const metricsArraySchema = z.object({
  metrics: z.array(metricSchema).min(1, "At least one metric is required"),
});

export type MetricFormData = z.infer<typeof metricSchema>;
export type MetricsArrayFormData = z.infer<typeof metricsArraySchema>;

// ── AI Config ─────────────────────────────────────────────────────────────────

export const aiConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  api_key: z
    .string()
    .min(10, "API key appears too short")
    .max(500, "API key appears too long"),
  model_preference: z.string().optional().or(z.literal("")),
});

export type AIConfigFormData = z.infer<typeof aiConfigSchema>;

// ── CSV Mapping ───────────────────────────────────────────────────────────────

export const csvMappingSchema = z.object({
  mappings: z.array(
    z.object({
      csvColumn: z.string(),
      metricName: z.string().min(1),
      metricCategory: z.enum(["traffic", "leads", "revenue", "cost", "custom"]),
      include: z.boolean(),
    })
  ),
  aggregation: z.enum(["sum", "average", "last"]).default("sum"),
});

export type CSVMappingFormData = z.infer<typeof csvMappingSchema>;

// ── AI Recommendation Request ──────────────────────────────────────────────────

export const aiRecommendationRequestSchema = z.object({
  reportId: z.string().uuid(),
  provider: z.enum(["openai", "anthropic"]),
});

export type AIRecommendationRequest = z.infer<typeof aiRecommendationRequestSchema>;

// ── Integration Config ────────────────────────────────────────────────────────

export const INTEGRATION_SERVICES = [
  "apollo", "apify", "heyreach", "instantly", "smartlead", "openai", "hubspot", "slack",
  // Lead enrichment
  "hunter", "lusha",
  // Calling platforms
  "retell", "vapi", "bland", "synthflow", "air", "twilio",
] as const;

export const integrationConfigSchema = z.object({
  service: z.enum(INTEGRATION_SERVICES),
  // Allow longer values — calling platforms store JSON with multiple fields
  api_key: z.string().min(1, "Value is required").max(5000, "Value too long"),
});

export type IntegrationConfigFormData = z.infer<typeof integrationConfigSchema>;

// ── Execution Action Requests ─────────────────────────────────────────────────

export const apolloEnrichRequestSchema = z.object({
  projectId: z.string().uuid(),
});

export const sfcSequenceRequestSchema = z.object({
  projectId: z.string().uuid(),
});

export type ApolloEnrichRequest = z.infer<typeof apolloEnrichRequestSchema>;
export type SFCSequenceRequest = z.infer<typeof sfcSequenceRequestSchema>;

// ── Campaign Workflow ─────────────────────────────────────────────────────────

const leadShape = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  company: z.string().optional().default(""),
  title: z.string().optional().default(""),
  linkedin_url: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});


export const fetchApolloLeadsSchema = z.object({
  projectId: z.string().uuid(),
  apolloListId: z.string().optional(),
});

export const fetchHunterLeadsSchema = z.object({
  projectId: z.string().uuid(),
  domain: z.string().min(1, "Domain is required"),
});

export const fetchHubSpotLeadsSchema = z.object({
  projectId: z.string().uuid(),
  listId: z.string().min(1, "HubSpot list ID is required"),
});

export const fetchLushaLeadsSchema = z.object({
  projectId: z.string().uuid(),
  domain: z.string().min(1, "Domain is required"),
});

export const qualifyLeadsSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(leadShape),
  icpDescription: z.string().optional().default(""),
});

export const checkExclusionsSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(leadShape),
});

export const INFLUENCE_TYPES = [
  "reciprocity",
  "commitment",
  "social_proof",
  "liking",
  "authority",
  "scarcity",
  "unity",
] as const;

export type InfluenceType = (typeof INFLUENCE_TYPES)[number];

export const generateSequencesSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(leadShape),
  channels: z.array(z.string()).optional().default(["email"]),
  offerContext: z.string().optional().default(""),
  influenceType: z.enum(INFLUENCE_TYPES).optional().default("reciprocity"),
});

const PUSH_DESTINATIONS = [
  // Outreach
  "instantly", "heyreach", "smartlead", "lemlist", "hubspot", "csv",
  // Automation / webhooks
  "n8n", "make", "zapier", "clay", "http",
  // Calling platforms
  "retell", "vapi", "bland", "synthflow", "air", "twilio",
] as const;

export const pushLeadsSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(z.any()),
  destinations: z.array(z.enum(PUSH_DESTINATIONS)).min(1),
});

export type FetchApolloLeadsRequest = z.infer<typeof fetchApolloLeadsSchema>;
export type QualifyLeadsRequest = z.infer<typeof qualifyLeadsSchema>;
export type CheckExclusionsRequest = z.infer<typeof checkExclusionsSchema>;
export type GenerateSequencesRequest = z.infer<typeof generateSequencesSchema>;
export type PushLeadsRequest = z.infer<typeof pushLeadsSchema>;
