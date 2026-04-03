import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/validate-key";
import { createServiceClient } from "@/lib/supabase/server";
import { clientSchema } from "@/lib/validations";

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
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
