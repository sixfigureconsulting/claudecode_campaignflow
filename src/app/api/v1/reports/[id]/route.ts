import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/validate-key";
import { createServiceClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validations";

async function ownsReport(supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>, id: string, userId: string) {
  const { data } = await supabase
    .from("reports")
    .select("id, projects!inner(clients!inner(user_id))")
    .eq("id", id)
    .eq("projects.clients.user_id", userId)
    .single();
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;
  const supabase = createServiceClient();
  const owned = await ownsReport(supabase, id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data } = await supabase
    .from("reports")
    .select("*, report_metrics(*)")
    .eq("id", id)
    .single();

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = reportSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const owned = await ownsReport(supabase, id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("reports")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;
  const supabase = createServiceClient();
  const owned = await ownsReport(supabase, id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
