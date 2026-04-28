import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey } from "@/lib/encryption";
import crypto from "crypto";

// GET /api/oauth/gmail/callback
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const sp     = new URL(request.url).searchParams;
  const code   = sp.get("code");
  const state  = sp.get("state");
  const storedState = request.cookies.get("gmail_state")?.value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/inbox?error=oauth_state_mismatch", appUrl));
  }

  // Verify HMAC
  const [hmacReceived, encodedRaw] = state.split(":");
  const stateRaw = Buffer.from(encodedRaw, "base64").toString();
  const stateSecret = process.env.NEXTAUTH_SECRET;
  if (!stateSecret) {
    return NextResponse.redirect(new URL("/inbox?error=server_misconfiguration", appUrl));
  }
  const hmacExpected = crypto.createHmac("sha256", stateSecret).update(stateRaw).digest("hex").slice(0, 16);
  if (hmacReceived !== hmacExpected) {
    return NextResponse.redirect(new URL("/inbox?error=invalid_state", appUrl));
  }

  const [userId, , encodedLabel] = stateRaw.split(":");
  if (userId !== user.id) {
    return NextResponse.redirect(new URL("/inbox?error=user_mismatch", appUrl));
  }
  const label = decodeURIComponent(encodedLabel ?? "Gmail");

  // Exchange code for tokens
  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri  = `${appUrl}/api/oauth/gmail/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/inbox?error=token_exchange_failed", appUrl));
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string };

  // Fetch Gmail address
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as { email?: string };

  await supabase.from("inbox_accounts").insert({
    user_id:                  user.id,
    provider:                 "gmail",
    account_label:            label,
    email:                    profile.email ?? null,
    access_token_encrypted:   encryptApiKey(tokens.access_token),
    refresh_token_encrypted:  tokens.refresh_token ? encryptApiKey(tokens.refresh_token) : null,
    extra_config:             { email: profile.email ?? "" },
  });

  const response = NextResponse.redirect(new URL("/inbox?connected=gmail", appUrl));
  response.cookies.delete("gmail_state");
  return response;
}
