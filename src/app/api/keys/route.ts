import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: dbError } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, active, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rawKey = "cfp_" + randomBytes(20).toString("hex"); // cfp_ + 40 hex chars
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const serviceClient = createServiceClient();
  const { data, error: dbError } = await serviceClient
    .from("api_keys")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Return the full key ONCE — it cannot be retrieved again
  return NextResponse.json({ ...data, key: rawKey }, { status: 201 });
}
