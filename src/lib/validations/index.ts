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
  project_type: z.enum(["outbound", "seo", "ads", "social", "email", "custom"]),
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

export const INTEGRATION_SERVICES = ["apollo", "heyreach", "instantly", "openai", "hubspot", "slack"] as const;

export const integrationConfigSchema = z.object({
  service: z.enum(INTEGRATION_SERVICES),
  api_key: z.string().min(10, "API key appears too short").max(2000, "API key appears too long"),
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

export const fetchApolloLeadsSchema = z.object({
  projectId: z.string().uuid(),
  apolloListId: z.string().optional(),
});

export const qualifyLeadsSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    company: z.string(),
    title: z.string(),
    linkedin_url: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
  })),
  icpDescription: z.string().min(10, "ICP description too short"),
});

export const checkExclusionsSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(z.object({
    email: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    company: z.string(),
    title: z.string(),
  })),
});

export const generateSequencesSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    company: z.string(),
    title: z.string(),
    linkedin_url: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
  })),
  channels: z.array(z.enum(["linkedin", "email"])).min(1),
  offerContext: z.string().min(10, "Offer context too short"),
});

export const pushLeadsSchema = z.object({
  projectId: z.string().uuid(),
  leads: z.array(z.any()),
  destinations: z.array(z.enum(["instantly", "hubspot", "csv"])).min(1),
});
