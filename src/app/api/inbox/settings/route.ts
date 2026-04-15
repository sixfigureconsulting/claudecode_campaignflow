import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/inbox/settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("inbox_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Return defaults if no settings row yet
  const defaults = {
    icp_description: "",
    sales_keywords: ["proposal", "demo", "appointment", "meeting", "pricing", "quote", "interested", "schedule", "call"],
    blocked_senders: [],
    block_warmup_tools: true,
    auto_classify: true,
    ai_provider: "anthropic",
  };

  return NextResponse.json({ settings: data ?? defaults });
}

// POST /api/inbox/settings — upsert settings
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };

  if (typeof body.icp_description     === "string")  updates.icp_description     = body.icp_description;
  if (Array.isArray(body.sales_keywords))             updates.sales_keywords      = body.sales_keywords;
  if (Array.isArray(body.blocked_senders))            updates.blocked_senders     = body.blocked_senders;
  if (typeof body.block_warmup_tools  === "boolean")  updates.block_warmup_tools  = body.block_warmup_tools;
  if (typeof body.auto_classify       === "boolean")  updates.auto_classify       = body.auto_classify;
  if (body.ai_provider === "anthropic" || body.ai_provider === "openai") {
    updates.ai_provider = body.ai_provider;
  }

  const { data, error } = await supabase
    .from("inbox_settings")
    .upsert(updates, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
