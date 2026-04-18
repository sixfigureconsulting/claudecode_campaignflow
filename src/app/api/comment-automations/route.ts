import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("comment_automations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, platform, keyword, reply_dm, post_id, post_url, status } = body;

  if (!name || !platform || !keyword || !reply_dm) {
    return NextResponse.json({ error: "name, platform, keyword, and reply_dm are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comment_automations")
    .insert({ user_id: user.id, name, platform, keyword: keyword.trim().toLowerCase(), reply_dm, post_id: post_id || null, post_url: post_url || null, status: status ?? "active" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
