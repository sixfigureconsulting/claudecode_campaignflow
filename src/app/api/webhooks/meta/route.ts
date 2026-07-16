import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac, timingSafeEqual } from "crypto";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
const APP_SECRET   = process.env.META_APP_SECRET ?? "";

// Verify X-Hub-Signature-256 header against raw body using META_APP_SECRET.
// Returns false if APP_SECRET is not configured or signature doesn't match.
async function verifySignature(req: NextRequest): Promise<{ ok: boolean; rawBody: Buffer }> {
  const rawBody = Buffer.from(await req.arrayBuffer());

  if (!APP_SECRET) {
    console.error("META_APP_SECRET is not set — rejecting webhook");
    return { ok: false, rawBody };
  }

  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  if (!sigHeader.startsWith("sha256=")) return { ok: false, rawBody };

  const expected = createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("hex");

  const providedHex = sigHeader.slice("sha256=".length);

  // timingSafeEqual prevents timing attacks
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(providedHex, "hex");
    if (a.length !== b.length) return { ok: false, rawBody };
    return { ok: timingSafeEqual(a, b), rawBody };
  } catch {
    return { ok: false, rawBody };
  }
}

// Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Incoming comment event
export async function POST(req: NextRequest) {
  const { ok, rawBody } = await verifySignature(req);
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();

  for (const entry of (body.entry as unknown[]) ?? []) {
    const e = entry as Record<string, unknown>;
    const platform: "instagram" | "facebook" = e.instagram ? "instagram" : "facebook";
    const changes = (e.changes as unknown[]) ?? [];

    for (const change of changes) {
      const c = change as Record<string, unknown>;
      if (c.field !== "comments" && c.field !== "feed") continue;

      const value = (c.value ?? {}) as Record<string, unknown>;
      const commentText: string = (
        (value.text as string) ?? (value.message as string) ?? ""
      ).toLowerCase();
      const commenterId: string =
        ((value.from as Record<string, string>)?.id) ??
        ((value.sender as Record<string, string>)?.id) ?? "";
      const postId: string =
        ((value.media as Record<string, string>)?.id) ??
        (value.post_id as string) ?? "";

      if (!commentText || !commenterId) continue;

      const { data: automations } = await supabase
        .from("comment_automations")
        .select("id, user_id, keyword, reply_dm, post_id, trigger_count, dm_sent_count")
        .eq("platform", platform)
        .eq("status", "active");

      for (const auto of automations ?? []) {
        const keywordMatches = commentText.includes(auto.keyword);
        const postMatches = !auto.post_id || auto.post_id === postId;
        if (!keywordMatches || !postMatches) continue;

        await supabase
          .from("comment_automations")
          .update({ trigger_count: (auto.trigger_count ?? 0) + 1 })
          .eq("id", auto.id);

        const { data: conn } = await supabase
          .from("oauth_connections")
          .select("access_token_encrypted")
          .eq("user_id", auto.user_id)
          .eq("platform", "manychat")
          .single();

        if (!conn?.access_token_encrypted) continue;

        try {
          const mcRes = await fetch("https://api.manychat.com/fb/sending/sendContent", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${conn.access_token_encrypted}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subscriber_id: commenterId,
              data: {
                version: "v2",
                content: { messages: [{ type: "text", text: auto.reply_dm }] },
              },
              message_tag: "CONFIRMED_EVENT_UPDATE",
            }),
          });

          if (mcRes.ok) {
            await supabase
              .from("comment_automations")
              .update({ dm_sent_count: (auto.dm_sent_count ?? 0) + 1 })
              .eq("id", auto.id);
          }
        } catch {
          // Silently continue — don't block the webhook response
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
