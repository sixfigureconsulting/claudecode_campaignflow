import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { computeFunnelMetrics } from "@/lib/funnel";
import { buildRecommendationPrompt } from "@/lib/ai/prompt";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { generateWithAnthropic } from "@/lib/ai/anthropic";
import { aiRecommendationRequestSchema } from "@/lib/validations";
import type { ReportWithMetrics } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate subscription (must be active or trialing)
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("user_id", user.id)
      .single();

    const isAllowed =
      subscription?.status === "active" ||
      (subscription?.status === "trialing" &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) > new Date());

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Subscription required to generate AI recommendations" },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const parsed = aiRecommendationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { reportId, provider } = parsed.data;

    // 4. Fetch report with full context (verify ownership via RLS)
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select(`
        *,
        report_metrics (*),
        projects (
          *,
          clients (*)
        )
      `)
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const client = (report.projects as any).clients;
    const project = report.projects as any;

    // 5. Fetch previous report for comparison
    const { data: previousReports } = await supabase
      .from("reports")
      .select("*, report_metrics (*)")
      .eq("project_id", project.id)
      .lt("report_date", report.report_date)
      .order("report_date", { ascending: false })
      .limit(1);

    const previousReport = previousReports?.[0] as ReportWithMetrics | null;

    // 6. Compute funnel metrics
    const funnelMetrics = computeFunnelMetrics(report.report_metrics ?? []);
    const previousFunnelMetrics = previousReport
      ? computeFunnelMetrics(previousReport.report_metrics ?? [])
      : null;

    // 7. Get user's AI API key
    const { data: aiConfig } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single();

    if (!aiConfig) {
      return NextResponse.json(
        { error: `No ${provider} API key configured. Please add it in Settings.` },
        { status: 400 }
      );
    }

    const apiKey = decryptApiKey(aiConfig.api_key_encrypted);

    // 8. Build prompt
    const { system, user: userPrompt } = buildRecommendationPrompt({
      client,
      project,
      currentReport: report as ReportWithMetrics,
      previousReport,
      funnelMetrics,
      previousFunnelMetrics,
    });

    // 9. Call AI
    let recommendation;
    if (provider === "openai") {
      recommendation = await generateWithOpenAI(
        apiKey,
        system,
        userPrompt,
        aiConfig.model_preference
      );
    } else {
      recommendation = await generateWithAnthropic(
        apiKey,
        system,
        userPrompt,
        aiConfig.model_preference
      );
    }

    // 10. Upsert recommendation (one per report, replaced on re-generation)
    const serviceClient = createServiceClient();
    const { data: saved, error: saveError } = await serviceClient
      .from("ai_recommendations")
      .upsert(
        {
          report_id: reportId,
          user_id: user.id,
          ...recommendation,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "report_id,provider" }
      )
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save recommendation:", saveError);
    }

    return NextResponse.json({ data: saved ?? recommendation }, { status: 200 });
  } catch (error) {
    console.error("AI recommendation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
