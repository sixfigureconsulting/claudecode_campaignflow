import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey } from "@/lib/encryption";

// GET /api/oauth/twitter/callback
// Twitter redirects here after the user grants (or denies) access.
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

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}?twitter_oauth=denied`);
  }

  const clientId     = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?twitter_oauth=error&msg=not_configured`);
  }

  // Retrieve code_verifier from cookie
  const codeVerifier = request.cookies.get("tw_cv")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(`${settingsUrl}?twitter_oauth=error&msg=missing_verifier`);
  }

  const redirectUri = `${appUrl}/api/oauth/twitter/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${settingsUrl}?twitter_oauth=error&msg=token_exchange_failed`);
  }

  const tokenData = await tokenRes.json() as {
    access_token:  string;
    refresh_token?: string;
    expires_in:    number;
    scope:         string;
  };

  // Fetch Twitter user info
  const meRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  let platformUsername: string | null = null;
  let platformUserId:   string | null = null;

  if (meRes.ok) {
    const me = await meRes.json() as { data: { id: string; username: string; name: string } };
    platformUserId   = me.data.id;
    platformUsername = me.data.username;
  }

  const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 7200) * 1000).toISOString();
  const scopes = tokenData.scope?.split(" ") ?? [];

  const accessEncrypted  = encryptApiKey(tokenData.access_token);
  const refreshEncrypted = tokenData.refresh_token ? encryptApiKey(tokenData.refresh_token) : null;

  const { error: upsertErr } = await supabase
    .from("oauth_connections")
    .upsert(
      {
        user_id:                 user.id,
        platform:                "twitter",
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
    return NextResponse.redirect(`${settingsUrl}?twitter_oauth=error&msg=db_error`);
  }

  // Clear the code_verifier cookie
  const response = NextResponse.redirect(
    `${settingsUrl}?twitter_oauth=success&username=${platformUsername ?? ""}`
  );
  response.cookies.delete("tw_cv");
  return response;
}
