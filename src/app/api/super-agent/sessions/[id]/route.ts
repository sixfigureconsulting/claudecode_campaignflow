import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [sessionResult, messagesResult] = await Promise.all([
      supabase
        .from("super_agent_sessions")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("super_agent_messages")
        .select("*")
        .eq("session_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({
      session: sessionResult.data,
      messages: messagesResult.data ?? [],
    });
  } catch (error) {
    console.error("super-agent/sessions/[id] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
