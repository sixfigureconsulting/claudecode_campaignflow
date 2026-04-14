import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";

// POST /api/social/send/reddit
// Sends a private message to a Reddit user using the authenticated user's
// Reddit OAuth token stored in oauth_connections.
//
// Body:
//   campaign_id     — social_campaigns.id (for tracking)
//   lead_id         — social_campaign_leads.id (for status update)
//   reddit_username — recipient Reddit username (no u/ prefix)
//   subject         — PM subject line (max 100 chars)
//   message         — PM body (max 10,000 chars)
//   lead            — optional context for personalisation (not sent to Reddit)

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    campaign_id:     string;
    lead_id:         string;
    reddit_username: string;
    subject:         string;
    message:         string;
  };

  const { campaign_id, lead_id, reddit_username, subject, message } = body;

  if (!reddit_username) return NextResponse.json({ error: "reddit_username is required" }, { status: 400 });
  if (!subject?.trim())  return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!message?.trim())  return NextResponse.json({ error: "message is required" }, { status: 400 });

  // Load the user's Reddit OAuth connection
  const { data: conn, error: connErr } = await supabase
    .from("oauth_connections")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at, platform_username")
    .eq("user_id", user.id)
    .eq("platform", "reddit")
    .single();

  if (connErr || !conn) {
    return NextResponse.json(
      { error: "Reddit account not connected. Go to Settings → Integrations to connect Reddit." },
      { status: 400 }
    );
  }

  // Refresh token if expired (with a 60s buffer)
  let accessToken = decryptApiKey(conn.access_token_encrypted);
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const isExpired = Date.now() > expiresAt - 60_000;

  if (isExpired && conn.refresh_token_encrypted) {
    const clientId     = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (clientId && clientSecret) {
      const refreshRes = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
          "User-Agent": "CampaignFlow Pro/1.0",
        },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          refresh_token: decryptApiKey(conn.refresh_token_encrypted),
        }).toString(),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json() as { access_token: string; expires_in: number };
        accessToken = refreshData.access_token;

        const { encryptApiKey } = await import("@/lib/encryption");
        await supabase
          .from("oauth_connections")
          .update({
            access_token_encrypted: encryptApiKey(accessToken),
            token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq("user_id", user.id)
          .eq("platform", "reddit");
      }
    }
  }

  // Send the private message via Reddit API
  const sendRes = await fetch("https://oauth.reddit.com/api/compose", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "CampaignFlow Pro/1.0",
    },
    body: new URLSearchParams({
      api_type: "json",
      to:       reddit_username,
      subject:  subject.slice(0, 100),
      text:     message.slice(0, 10_000),
    }).toString(),
  });

  let platformMessageId: string | null = null;

  if (!sendRes.ok) {
    const errText = await sendRes.text();

    // Update lead status to failed
    if (lead_id) {
      await supabase
        .from("social_campaign_leads")
        .update({
          status:        "failed",
          error_message: `Reddit API ${sendRes.status}: ${errText.slice(0, 200)}`,
        })
        .eq("id", lead_id);
    }

    return NextResponse.json(
      { error: `Reddit API error: ${sendRes.status}`, detail: errText },
      { status: sendRes.status }
    );
  }

  // Extract message ID from Reddit's response if available
  try {
    const sendData = await sendRes.json() as { json?: { data?: { id?: string } } };
    platformMessageId = sendData?.json?.data?.id ?? null;
  } catch {
    // Reddit's compose endpoint sometimes returns empty body on success — that's fine
  }

  // Update lead status to sent
  if (lead_id) {
    await supabase
      .from("social_campaign_leads")
      .update({
        status:             "sent",
        sent_at:            new Date().toISOString(),
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
