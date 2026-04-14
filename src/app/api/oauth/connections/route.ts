import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/oauth/connections — list the user's connected OAuth platforms
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("oauth_connections")
    .select("platform, platform_username, platform_user_id, scopes, token_expires_at, created_at")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connections: data ?? [] });
}

// DELETE /api/oauth/connections?platform=reddit — disconnect a platform
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platform = new URL(request.url).searchParams.get("platform");
  if (!platform) return NextResponse.json({ error: "platform is required" }, { status: 400 });

  const { error } = await supabase
    .from("oauth_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
