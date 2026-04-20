import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
const APP_SECRET   = process.env.META_APP_SECRET ?? "";

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET || !signatureHeader) return false;
  const expected = `sha256=${createHmac("sha256", APP_SECRET).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
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
  // Verify Meta webhook signature before processing anything
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { entry?: unknown[] };
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: true }); }
  if (!body) return NextResponse.json({ ok: true });

  // Service client — bypasses RLS to read active automations across all users
  const supabase = createServiceClient();

  type MetaEntry  = { instagram?: unknown; changes?: MetaChange[] };
  type MetaChange = { field?: string; value?: Record<string, unknown> };

  for (const rawEntry of body.entry ?? []) {
    const entry = rawEntry as MetaEntry;
    const platform: "instagram" | "facebook" = entry.instagram ? "instagram" : "facebook";
    const changes = entry.changes ?? [];

    for (const change of changes) {
      if (change.field !== "comments" && change.field !== "feed") continue;

      const value = change.value ?? {};
      const commentText: string = ((value.text ?? value.message ?? "") as string).toLowerCase();
      const commenterId: string = (value.from as { id?: string })?.id ?? (value.sender as { id?: string })?.id ?? "";
      const postId: string = (value.media as { id?: string })?.id ?? (value.post_id as string) ?? "";

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

        // Fetch the ManyChat API key from integration_configs (properly decrypted)
        const mcConfig = await getGlobalApiConfig(supabase, auto.user_id, "manychat");
        const mcApiKey = getApiKey(mcConfig);
        if (!mcApiKey) continue;

        const mcEndpoint = platform === "instagram"
          ? "https://api.manychat.com/instagram/sending/sendContent"
          : "https://api.manychat.com/fb/sending/sendContent";

        try {
          const mcRes = await fetch(mcEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${mcApiKey}`,
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
          } else {
            console.error(`ManyChat send failed for automation ${auto.id}: HTTP ${mcRes.status}`);
          }
        } catch (err) {
          console.error(`ManyChat send error for automation ${auto.id}:`, err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
