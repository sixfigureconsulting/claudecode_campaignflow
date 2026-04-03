import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/validate-key";
import { createServiceClient } from "@/lib/supabase/server";
import { projectSchema } from "@/lib/validations";
import { z } from "zod";

const createProjectSchema = projectSchema.extend({
  client_id: z.string().uuid("Invalid client_id"),
});

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const clientId = request.nextUrl.searchParams.get("client_id");
  const supabase = createServiceClient();

  let query = supabase
    .from("projects")
    .select("*, clients!inner(user_id)")
    .eq("clients.user_id", userId)
    .order("created_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip the joined clients field from response
  const clean = (data ?? []).map(({ clients: _c, ...p }) => p);
  return NextResponse.json({ data: clean });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify ownership of the client
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data.client_id)
    .eq("user_id", userId)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("projects")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
