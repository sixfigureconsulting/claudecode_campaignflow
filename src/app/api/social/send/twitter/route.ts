import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey, encryptApiKey } from "@/lib/encryption";

// POST /api/social/send/twitter
// Sends a DM to a Twitter user using the authenticated user's Twitter OAuth 2.0 token.
//
// Body:
//   campaign_id        — social_campaigns.id (for tracking)
//   lead_id            — social_campaign_leads.id (for status update)
//   twitter_user_id    — recipient Twitter user ID (preferred over username — avoids extra API call)
//   twitter_username   — recipient Twitter @handle (used if twitter_user_id not provided)
//   message            — DM text (max 10,000 chars)

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    campaign_id:      string;
    lead_id:          string;
    twitter_user_id?: string;
    twitter_username?: string;
    message:          string;
  };

  const { campaign_id, lead_id, message } = body;
  let { twitter_user_id } = body;

  if (!message?.trim()) return NextResponse.json({ error: "message is required" }, { status: 400 });
  if (!twitter_user_id && !body.twitter_username) {
    return NextResponse.json({ error: "twitter_user_id or twitter_username is required" }, { status: 400 });
  }

  // Load the user's Twitter OAuth connection
  const { data: conn, error: connErr } = await supabase
    .from("oauth_connections")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at, platform_user_id")
    .eq("user_id", user.id)
    .eq("platform", "twitter")
    .single();

  if (connErr || !conn) {
    return NextResponse.json(
      { error: "Twitter account not connected. Go to Settings → Integrations to connect Twitter." },
      { status: 400 }
    );
  }

  // Refresh token if expired (60s buffer)
  let accessToken = decryptApiKey(conn.access_token_encrypted);
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const isExpired = Date.now() > expiresAt - 60_000;

  if (isExpired && conn.refresh_token_encrypted) {
    const clientId     = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    if (clientId && clientSecret) {
      const refreshRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          refresh_token: decryptApiKey(conn.refresh_token_encrypted),
          client_id:     clientId,
        }).toString(),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json() as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
        };
        accessToken = refreshData.access_token;

        await supabase
          .from("oauth_connections")
          .update({
            access_token_encrypted:  encryptApiKey(accessToken),
            refresh_token_encrypted: refreshData.refresh_token
              ? encryptApiKey(refreshData.refresh_token)
              : conn.refresh_token_encrypted,
            token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq("user_id", user.id)
          .eq("platform", "twitter");
      }
    }
  }

  // Resolve Twitter user ID from username if not provided
  if (!twitter_user_id && body.twitter_username) {
    const handle = body.twitter_username.replace(/^@/, "");
    const lookupRes = await fetch(`https://api.twitter.com/2/users/by/username/${handle}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (lookupRes.ok) {
      const data = await lookupRes.json() as { data?: { id: string } };
      twitter_user_id = data.data?.id;
    }
    if (!twitter_user_id) {
      const failMsg = `Could not resolve Twitter user ID for @${handle}`;
      if (lead_id) {
        await supabase
          .from("social_campaign_leads")
          .update({ status: "failed", error_message: failMsg })
          .eq("id", lead_id);
      }
      return NextResponse.json({ error: failMsg }, { status: 400 });
    }
  }

  // Send DM via Twitter API v2
  // Creates or reuses a DM conversation with the recipient
  const sendRes = await fetch(
    `https://api.twitter.com/2/dm_conversations/with/${twitter_user_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message.slice(0, 10_000) }),
    }
  );

  if (!sendRes.ok) {
    const errData = await sendRes.json().catch(() => ({})) as { detail?: string };
    const errMsg = errData.detail ?? `Twitter API error ${sendRes.status}`;

    if (lead_id) {
      await supabase
        .from("social_campaign_leads")
        .update({ status: "failed", error_message: errMsg.slice(0, 200) })
        .eq("id", lead_id);
    }

    return NextResponse.json({ error: errMsg }, { status: sendRes.status });
  }

  const sendData = await sendRes.json() as { data?: { dm_event_id?: string } };
  const platformMessageId = sendData?.data?.dm_event_id ?? null;

  // Update lead status
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

  return NextResponse.json({ success: true, dm_event_id: platformMessageId });
}
