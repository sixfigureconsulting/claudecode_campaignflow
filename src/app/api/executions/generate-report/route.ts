import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCampaignReport } from "@/lib/reports/generateCampaignReport";
import { z } from "zod";

const schema = z.object({
  campaignRunId: z.string().uuid(),
  notify: z.boolean().optional().default(true),
  manualStats: z
    .object({
      campaign_name: z.string().optional(),
      emails_sent: z.number().optional(),
      open_count: z.number().optional(),
      reply_count: z.number().optional(),
      bounce_count: z.number().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { campaignRunId, notify, manualStats } = parsed.data;

    // Verify ownership — campaign run must belong to a project owned by this user
    const { data: run } = await supabase
      .from("campaign_runs")
      .select("project_id, projects!inner(clients!inner(user_id))")
      .eq("id", campaignRunId)
      .single();

    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerUserId = (run as any).projects?.clients?.user_id;
    if (ownerUserId !== user.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await generateCampaignReport({
      campaignRunId,
      notify,
      manualStats,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("generate-report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
