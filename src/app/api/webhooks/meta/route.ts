import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

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
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const supabase = await createClient();

  for (const entry of body.entry ?? []) {
    const platform: "instagram" | "facebook" = entry.instagram ? "instagram" : "facebook";
    const changes = entry.changes ?? [];

    for (const change of changes) {
      if (change.field !== "comments" && change.field !== "feed") continue;

      const value = change.value ?? {};
      const commentText: string = (value.text ?? value.message ?? "").toLowerCase();
      const commenterId: string = value.from?.id ?? value.sender?.id ?? "";
      const postId: string = value.media?.id ?? value.post_id ?? "";

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
