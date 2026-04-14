import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// GET /api/oauth/reddit — kick off Reddit OAuth 2.0 flow
// Redirects the user to Reddit's authorization page.
// After consent, Reddit redirects to /api/oauth/reddit/callback
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.REDDIT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "REDDIT_CLIENT_ID is not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/oauth/reddit/callback`;

  // CSRF protection: embed user ID in state, sign it
  const stateRaw = `${user.id}:${Date.now()}`;
  const stateSecret = process.env.NEXTAUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "secret";
  const state = crypto
    .createHmac("sha256", stateSecret)
    .update(stateRaw)
    .digest("hex")
    .slice(0, 16) + ":" + Buffer.from(stateRaw).toString("base64");

  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: "code",
    state,
    redirect_uri:  redirectUri,
    duration:      "permanent",
    scope:         "privatemessages identity",
  });

  return NextResponse.redirect(`https://www.reddit.com/api/v1/authorize?${params.toString()}`);
}
