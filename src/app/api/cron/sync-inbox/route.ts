import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Inbox Sync Cron — runs every 20 minutes via Vercel Cron.
 * Iterates all active inbox_accounts + all users with Instantly integration
 * and dispatches per-provider sync calls.
 *
 * Protected by CRON_SECRET env var.
 * vercel.json schedule: every 20 minutes — see vercel.json
 */

export const runtime = "nodejs";
export const maxDuration = 300;

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = getBaseUrl(request);
  const cronHeaders = {
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
    "Content-Type": "application/json",
  };

  const supabase = createServiceClient();
  const summary: Record<string, unknown> = {};

  // ── 1. LinkedIn (Heyreach) ─────────────────────────────────────────────────
  // Collect distinct user IDs that have active LinkedIn inbox accounts
  const { data: linkedinAccounts } = await supabase
    .from("inbox_accounts")
    .select("user_id")
    .eq("provider", "linkedin")
    .eq("is_active", true);

  const linkedinUserIds = [...new Set((linkedinAccounts ?? []).map((a: { user_id: string }) => a.user_id))];

  let linkedinSynced = 0;
  let linkedinErrors = 0;

  for (const uid of linkedinUserIds) {
    try {
      const uidStr = uid as string;
      const res = await fetch(`${base}/api/inbox/sync/linkedin`, {
        headers: {
          Authorization: cronHeaders.Authorization,
          "Content-Type": cronHeaders["Content-Type"],
          "x-cron-user-id": uidStr,
        },
      });
      if (res.ok) {
        const data = await res.json();
        linkedinSynced += data.synced ?? 0;
      } else {
        linkedinErrors++;
      }
    } catch {
      linkedinErrors++;
    }
  }

  summary.linkedin = { users: linkedinUserIds.length, synced: linkedinSynced, errors: linkedinErrors };

  // ── 2. Email (Instantly) ───────────────────────────────────────────────────
  try {
    const emailRes = await fetch(`${base}/api/inbox/sync/email`, {
      headers: cronHeaders,
    });
    if (emailRes.ok) {
      const data = await emailRes.json();
      summary.email = { users: data.users ?? 0, synced: data.synced ?? 0 };
    } else {
      summary.email = { error: `HTTP ${emailRes.status}` };
    }
  } catch (err) {
    summary.email = { error: String(err) };
  }

  // ── 3. Reddit ─────────────────────────────────────────────────────────────
  // Reddit sync not yet implemented — placeholder for future expansion
  summary.reddit = { note: "pending implementation" };

  // ── 4. Twitter / X ────────────────────────────────────────────────────────
  // Twitter inbox sync not yet implemented — placeholder
  summary.twitter = { note: "pending implementation" };

  console.log("sync-inbox cron completed", summary);
  return NextResponse.json({ ok: true, summary });
}
