import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  // Verify ownership
  const { data: report } = await supabase
    .from("reports")
    .select("id, projects!inner(clients!inner(user_id))")
    .eq("id", reportId)
    .single();

  if (!report || (report as any).projects.clients.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("reports")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: report } = await supabase
    .from("reports")
    .select("id, projects!inner(clients!inner(user_id))")
    .eq("id", reportId)
    .single();

  if (!report || (report as any).projects.clients.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("reports").delete().eq("id", reportId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
