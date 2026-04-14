import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey } from "@/lib/encryption";

// GET /api/oauth/reddit/callback
// Reddit redirects here after the user grants (or denies) access.
// Exchanges the authorization code for tokens and stores them in oauth_connections.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings`;

  // User denied access
  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}?reddit_oauth=denied`);
  }

  const clientId     = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?reddit_oauth=error&msg=not_configured`);
  }

  const redirectUri = `${appUrl}/api/oauth/reddit/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "User-Agent": "CampaignFlow Pro/1.0",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${settingsUrl}?reddit_oauth=error&msg=token_exchange_failed`);
  }

  const tokenData = await tokenRes.json() as {
    access_token:  string;
    refresh_token?: string;
    expires_in:    number;
    scope:         string;
  };

  // Fetch the Reddit username for this token
  const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "CampaignFlow Pro/1.0",
    },
  });

  let platformUsername: string | null = null;
  let platformUserId:   string | null = null;

  if (meRes.ok) {
    const me = await meRes.json() as { name: string; id: string };
    platformUsername = me.name;
    platformUserId   = me.id;
  }

  const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  const scopes = tokenData.scope?.split(" ") ?? [];

  // Encrypt tokens before storing
  const accessEncrypted  = encryptApiKey(tokenData.access_token);
  const refreshEncrypted = tokenData.refresh_token ? encryptApiKey(tokenData.refresh_token) : null;

  const { error: upsertErr } = await supabase
    .from("oauth_connections")
    .upsert(
      {
        user_id:                 user.id,
        platform:                "reddit",
        access_token_encrypted:  accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        token_expires_at:        tokenExpiresAt,
        platform_user_id:        platformUserId,
        platform_username:       platformUsername,
        scopes,
        updated_at:              new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );

  if (upsertErr) {
    return NextResponse.redirect(`${settingsUrl}?reddit_oauth=error&msg=db_error`);
  }

  return NextResponse.redirect(`${settingsUrl}?reddit_oauth=success&username=${platformUsername ?? ""}`);
}
