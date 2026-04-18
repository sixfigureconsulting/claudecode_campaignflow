import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCredits, deductCredits } from "@/lib/credits";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { offer, icp, goals, channels } = body as {
      offer: string;
      icp: string;
      goals: string;
      channels: string[];
    };

    if (!offer?.trim()) return NextResponse.json({ error: "Offer is required." }, { status: 400 });
    if (!icp?.trim())   return NextResponse.json({ error: "ICP description is required." }, { status: 400 });
    if (!goals?.trim()) return NextResponse.json({ error: "Goals are required." }, { status: 400 });
    if (!Array.isArray(channels) || channels.length === 0)
      return NextResponse.json({ error: "Select at least one channel." }, { status: 400 });

    // Credit preflight — check before inserting
    const { allowed, balance, required } = await requireCredits(supabase, user.id, "super_agent_session");
    if (!allowed) {
      return NextResponse.json(
        { error: `Insufficient credits. You have ${balance} credits but this requires ${required}. Top up on the Billing page.` },
        { status: 402 }
      );
    }

    // Insert session
    const { data: session, error: insertError } = await supabase
      .from("super_agent_sessions")
      .insert({
        user_id: user.id,
        offer:   offer.trim(),
        icp:     icp.trim(),
        goals:   goals.trim(),
        channels,
        status:  "running",
      })
      .select("id")
      .single();

    if (insertError || !session) {
      console.error("super_agent_sessions insert error:", insertError?.message);
      return NextResponse.json({ error: "Failed to create session." }, { status: 500 });
    }

    // Deduct session credits
    await deductCredits(supabase, user.id, "super_agent_session", 1, { session_id: session.id });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("super-agent/sessions POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
