import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";

// POST /api/social/send/manychat
// Sends an Instagram DM via ManyChat API.
// The recipient must already be a ManyChat subscriber (they've previously
// messaged the connected IG Business account — standard 24hr window).
//
// Body:
//   campaign_id      — social_campaigns.id (for tracking)
//   lead_id          — social_campaign_leads.id (for status update)
//   instagram_handle — recipient Instagram username (with or without @)
//   message          — message text to send

const MANYCHAT_BASE = "https://api.manychat.com";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    campaign_id:      string;
    lead_id:          string;
    instagram_handle: string;
    message:          string;
  };

  const { campaign_id, lead_id, instagram_handle, message } = body;

  if (!instagram_handle?.trim()) return NextResponse.json({ error: "instagram_handle is required" }, { status: 400 });
  if (!message?.trim())          return NextResponse.json({ error: "message is required" }, { status: 400 });

  // Load the user's ManyChat API key from settings
  const config = await getGlobalApiConfig(supabase, user.id, "manychat");
  const apiKey = getApiKey(config);

  if (!apiKey) {
    return NextResponse.json(
      { error: "ManyChat API key not configured. Go to Settings → Integrations to connect ManyChat." },
      { status: 400 }
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const handle = instagram_handle.replace(/^@/, "").trim();

  // Step 1 — find the subscriber in ManyChat by Instagram username
  const findRes = await fetch(
    `${MANYCHAT_BASE}/instagram/subscriber/findByInstagramUserName?username=${encodeURIComponent(handle)}`,
    { headers }
  );

  if (!findRes.ok) {
    const errText = await findRes.text();
    if (lead_id) {
      await supabase
        .from("social_campaign_leads")
        .update({
          status:        "failed",
          error_message: `ManyChat subscriber lookup ${findRes.status}: ${errText.slice(0, 200)}`,
        })
        .eq("id", lead_id);
    }
    return NextResponse.json(
      { error: `ManyChat subscriber lookup failed: ${findRes.status}`, detail: errText },
      { status: findRes.status }
    );
  }

  const findData = await findRes.json() as { status: string; data?: { id: string } };

  if (!findData.data?.id) {
    // Prospect hasn't messaged the IG account yet — not a subscriber
    if (lead_id) {
      await supabase
        .from("social_campaign_leads")
        .update({
          status:        "skipped",
          error_message: "Instagram user is not a ManyChat subscriber (they haven't messaged your IG account yet)",
        })
        .eq("id", lead_id);
    }
    return NextResponse.json(
      { error: "Instagram user not found as a ManyChat subscriber" },
      { status: 404 }
    );
  }

  const subscriberId = findData.data.id;

  // Step 2 — send the message
  const sendRes = await fetch(`${MANYCHAT_BASE}/instagram/sending/sendContent`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subscriber_id: subscriberId,
      data: {
        version: "v2",
        content: {
          messages: [{ type: "text", text: message.slice(0, 1000) }],
        },
      },
    }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    if (lead_id) {
      await supabase
        .from("social_campaign_leads")
        .update({
          status:        "failed",
          error_message: `ManyChat send ${sendRes.status}: ${errText.slice(0, 200)}`,
        })
        .eq("id", lead_id);
    }
    return NextResponse.json(
      { error: `ManyChat send error: ${sendRes.status}`, detail: errText },
      { status: sendRes.status }
    );
  }

  const sendData = await sendRes.json() as { status: string; data?: { message_id?: string } };
  const platformMessageId = sendData.data?.message_id ?? null;

  // Update lead status to sent
  if (lead_id) {
    await supabase
      .from("social_campaign_leads")
      .update({
        status:              "sent",
        sent_at:             new Date().toISOString(),
        platform_message_id: platformMessageId,
      })
      .eq("id", lead_id);
  }

  // Increment campaign sent_count
  if (campaign_id) {
    const { data: camp } = await supabase
      .from("social_campaigns")
      .select("sent_count")
      .eq("id", campaign_id)
      .single();
    if (camp) {
      await supabase
        .from("social_campaigns")
        .update({ sent_count: camp.sent_count + 1 })
        .eq("id", campaign_id);
    }
  }

  return NextResponse.json({ success: true, message_id: platformMessageId });
}
