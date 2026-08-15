import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function validateApiKey(
  request: NextRequest
): Promise<{ userId: string; keyId: string }> {
  // IP-level rate limit to slow down key brute-forcing — 100 req/min per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipRl = rateLimit(`v1-ip:${ip}`, { limit: 100, windowMs: 60_000 });
  if (!ipRl.success) {
    throw new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((ipRl.resetAt - Date.now()) / 1000)) } }
    );
  }

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

  // Per-key rate limit: 300 req/min (generous for automation, still prevents runaway scripts)
  const keyRl = rateLimit(`v1-key:${apiKey.id}`, { limit: 300, windowMs: 60_000 });
  if (!keyRl.success) {
    throw new Response(
      JSON.stringify({ error: "API key rate limit exceeded. Max 300 requests per minute." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((keyRl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Fire-and-forget last_used_at update
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  return { userId: apiKey.user_id, keyId: apiKey.id };
}
