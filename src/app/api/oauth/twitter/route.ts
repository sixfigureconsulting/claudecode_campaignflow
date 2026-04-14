import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// GET /api/oauth/twitter — initiate Twitter OAuth 2.0 PKCE flow
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "TWITTER_CLIENT_ID is not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/oauth/twitter/callback`;

  // PKCE: generate code_verifier and code_challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // CSRF state: HMAC-signed user_id:timestamp
  const stateRaw = `${user.id}:${Date.now()}`;
  const stateSecret = process.env.NEXTAUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "secret";
  const state =
    crypto.createHmac("sha256", stateSecret).update(stateRaw).digest("hex").slice(0, 16) +
    ":" +
    Buffer.from(stateRaw).toString("base64");

  const params = new URLSearchParams({
    response_type:           "code",
    client_id:               clientId,
    redirect_uri:            redirectUri,
    scope:                   "tweet.read users.read dm.read dm.write offline.access",
    state,
    code_challenge:          codeChallenge,
    code_challenge_method:   "S256",
  });

  const response = NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  );

  // Store code_verifier in an httpOnly cookie for the callback
  response.cookies.set("tw_cv", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}
