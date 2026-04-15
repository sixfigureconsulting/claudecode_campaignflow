import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// GET /api/oauth/gmail?label=Work+Gmail — initiate Gmail OAuth 2.0 flow
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Add GOOGLE_CLIENT_ID to your environment." },
      { status: 500 }
    );
  }

  const label = new URL(request.url).searchParams.get("label") ?? "Gmail";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/oauth/gmail/callback`;

  // CSRF state: HMAC-signed user_id:timestamp:label
  const stateRaw = `${user.id}:${Date.now()}:${encodeURIComponent(label)}`;
  const stateSecret = process.env.NEXTAUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "secret";
  const stateHmac = crypto.createHmac("sha256", stateSecret).update(stateRaw).digest("hex").slice(0, 16);
  const state = `${stateHmac}:${Buffer.from(stateRaw).toString("base64")}`;

  const params = new URLSearchParams({
    response_type:   "code",
    client_id:       clientId,
    redirect_uri:    redirectUri,
    scope:           "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
    access_type:     "offline",
    prompt:          "consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set("gmail_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
