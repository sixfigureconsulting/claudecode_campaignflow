import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function validateApiKey(
  request: NextRequest
): Promise<{ userId: string; keyId: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer cfp_")) {
    throw NextResponse.json(
      { error: "Missing or invalid API key. Use Authorization: Bearer cfp_..." },
      { status: 401 }
    );
  }

  const rawKey = authHeader.slice(7); // strip "Bearer "
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const supabase = createServiceClient();
  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, user_id, active")
    .eq("key_hash", keyHash)
    .single();

  if (!apiKey || !apiKey.active) {
    throw NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  // Fire-and-forget last_used_at update
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  return { userId: apiKey.user_id, keyId: apiKey.id };
}
