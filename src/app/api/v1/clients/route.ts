import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/validate-key";
import { createServiceClient } from "@/lib/supabase/server";
import { clientSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const body = await request.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
