import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await request.json() as { sessionId: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

    // Verify ownership and current status
    const { data: session, error: sessionError } = await supabase
      .from("super_agent_sessions")
      .select("id, status, created_campaign_ids, created_automation_ids")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (session.status !== "awaiting_approval") {
      return NextResponse.json(
        { error: `Session is in '${session.status}' status — can only approve sessions awaiting_approval.` },
        { status: 409 }
      );
    }

    // Activate all draft campaigns created by this session
    const campaignIds = (session.created_campaign_ids as string[]) ?? [];
    if (campaignIds.length > 0) {
      await supabase
        .from("social_campaigns")
        .update({ status: "active" })
        .in("id", campaignIds)
        .eq("user_id", user.id);
    }

    // Activate all draft automations created by this session
    const automationIds = (session.created_automation_ids as string[]) ?? [];
    if (automationIds.length > 0) {
      await supabase
        .from("comment_automations")
        .update({ status: "active" })
        .in("id", automationIds)
        .eq("user_id", user.id);
    }

    // Mark session as launched
    await supabase
      .from("super_agent_sessions")
      .update({ status: "launched" })
      .eq("id", sessionId);

    return NextResponse.json({
      success: true,
      launchedCampaigns: campaignIds.length,
      launchedAutomations: automationIds.length,
    });
  } catch (error) {
    console.error("super-agent/approve POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
